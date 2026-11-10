import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

let activeHarness
let failShipmentQueue = false

const prismaFacade = {
  $transaction: (callback) => activeHarness.transaction(callback),
  payment: {
    findMany: (args) => activeHarness.paymentFindMany(args),
  },
}

mock.module(new URL('../lib/prisma.js', import.meta.url).href, {
  defaultExport: prismaFacade,
  namedExports: { prisma: prismaFacade },
})
mock.module(new URL('../services/customerOrderTracking.js', import.meta.url).href, {
  namedExports: { createOrderTrackingHandler: () => async () => {} },
})
mock.module(new URL('../services/shipmentQueue.js', import.meta.url).href, {
  namedExports: {
    queueShipment: async (tx, orderId) => tx.shipment.upsert({
      where: { orderId },
      create: { orderId },
      update: {},
    }),
  },
})

const { createCodOrder, getCodEligibility } = await import('../controllers/customerCommerceController.js')

const makeState = (price = 100, stock = 5) => ({
  nextCartId: 1,
  nextCartItemId: 1,
  nextOrderId: 1,
  nextPaymentId: 1,
  cart: null,
  cartItems: [],
  orders: [],
  payments: [],
  shipments: [],
  stockHistory: [],
  products: [{
    id: 8,
    storeId: 22,
    slug: 'test-product',
    name: 'Test Product',
    sku: 'TEST-SKU',
    price,
    countInStock: stock,
    status: 'ACTIVE',
    category: null,
    brandRelation: null,
    imagesList: [],
    variants: [{
      id: 18,
      productId: 8,
      sku: 'TEST-VARIANT-SKU',
      size: 'M',
      color: 'Navy',
      colorCode: '#071120',
      priceOverride: null,
      quantityOnHand: stock,
      status: 'ACTIVE',
    }],
  }],
})

const createHarness = (price = 100, stock = 5) => {
  let state = makeState(price, stock)
  let transactionTail = Promise.resolve()
  let checkoutLockCalls = 0

  const productForItem = (item) => state.products.find((product) => product.id === item.productId)
  const variantForItem = (item) => productForItem(item)?.variants.find((variant) => variant.id === item.variantId) ?? null
  const cartWithItems = () => ({
    ...state.cart,
    items: state.cartItems.map((item) => ({
      ...item,
      product: productForItem(item),
      variant: variantForItem(item),
    })),
  })

  const makeTransactionClient = () => ({
    $queryRaw: async () => {
      checkoutLockCalls += 1
      return []
    },
    product: {
      findMany: async ({ where }) => state.products.filter((product) => (
        product.storeId === where.storeId
        && product.status === where.status
        && where.slug.in.includes(product.slug)
      )),
      updateMany: async ({ where, data }) => {
        const product = state.products.find((entry) => entry.id === where.id && entry.storeId === where.storeId)
        if (!product || product.countInStock < where.countInStock.gte) return { count: 0 }
        product.countInStock -= data.countInStock.decrement
        return { count: 1 }
      },
    },
    productVariant: {
      updateMany: async ({ where, data }) => {
        const product = state.products.find((entry) => entry.id === where.productId)
        const variant = product?.variants.find((entry) => entry.id === where.id)
        if (!variant || variant.quantityOnHand < where.quantityOnHand.gte) return { count: 0 }
        variant.quantityOnHand -= data.quantityOnHand.decrement
        return { count: 1 }
      },
    },
    cart: {
      upsert: async ({ create }) => {
        if (!state.cart) state.cart = { id: state.nextCartId++, ...create }
        return state.cart
      },
      findUnique: async () => state.cart ? cartWithItems() : null,
    },
    cartItem: {
      deleteMany: async ({ where }) => {
        const before = state.cartItems.length
        state.cartItems = state.cartItems.filter((item) => item.cartId !== where.cartId)
        return { count: before - state.cartItems.length }
      },
      createMany: async ({ data }) => {
        for (const item of data) state.cartItems.push({ id: state.nextCartItemId++, ...item })
        return { count: data.length }
      },
    },
    coupon: { findFirst: async () => null },
    couponProduct: { findMany: async () => [] },
    couponCategory: { findMany: async () => [] },
    couponUsage: {
      count: async () => 0,
      create: async () => {},
    },
    order: {
      findUnique: async ({ where }) => state.orders.find((order) => (
        order.userId === where.userId_storeId_idempotencyKey.userId
        && order.storeId === where.userId_storeId_idempotencyKey.storeId
        && order.idempotencyKey === where.userId_storeId_idempotencyKey.idempotencyKey
      )) ?? null,
      create: async ({ data }) => {
        if (state.orders.some((order) => (
          order.userId === data.userId
          && order.storeId === data.storeId
          && order.idempotencyKey === data.idempotencyKey
        ))) {
          throw Object.assign(new Error('Unique order key conflict'), { code: 'P2002' })
        }
        const order = {
          id: state.nextOrderId++,
          ...data,
          items: data.items.create,
          statusHistory: [data.statusHistory.create],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }
        state.orders.push(order)
        return order
      },
    },
    stockHistory: { create: async ({ data }) => state.stockHistory.push(data) },
    payment: {
      findFirst: async ({ where }) => state.payments.find((payment) => (
        payment.userId === where.userId
        && payment.storeId === where.storeId
        && (where.id?.not === undefined || payment.id !== where.id.not)
        && where.OR.some((condition) => (
          payment.provider === condition.provider
          && (typeof condition.status === 'string'
            ? payment.status === condition.status
            : condition.status.in.includes(payment.status))
          && (condition.orderId === undefined || payment.orderId === condition.orderId)
        ))
      )) ?? null,
      findMany: async ({ where }) => state.payments.filter((payment) => (
        payment.userId === where.userId
        && payment.storeId === where.storeId
        && payment.idempotencyKey === where.idempotencyKey
      )),
      create: async ({ data }) => {
        if (state.payments.some((payment) => payment.paymentAttemptKey === data.paymentAttemptKey)) {
          throw Object.assign(new Error('Unique payment attempt conflict'), { code: 'P2002' })
        }
        const payment = { id: state.nextPaymentId++, ...data }
        state.payments.push(payment)
        return payment
      },
    },
    shipment: {
      upsert: async ({ where, create }) => {
        if (failShipmentQueue) throw new Error('Shipment queue failure')
        const existing = state.shipments.find((shipment) => shipment.orderId === where.orderId)
        if (existing) return existing
        const shipment = { id: state.shipments.length + 1, ...create }
        state.shipments.push(shipment)
        return shipment
      },
    },
  })

  return {
    transaction(callback) {
      const current = transactionTail.then(async () => {
        const snapshot = structuredClone(state)
        try {
          return await callback(makeTransactionClient())
        } catch (error) {
          state = snapshot
          throw error
        }
      })
      transactionTail = current.catch(() => {})
      return current
    },
    paymentFindMany: ({ where }) => state.payments.filter((payment) => (
      payment.userId === where.userId
      && payment.storeId === where.storeId
      && payment.idempotencyKey === where.idempotencyKey
    )),
    get state() {
      return state
    },
    get checkoutLockCalls() {
      return checkoutLockCalls
    },
  }
}

const shippingAddress = {
  name: 'Test Recipient',
  phone: '+91 9876543210',
  email: 'recipient@example.test',
  line1: '1 Test Street',
  line2: null,
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
  country: 'India',
}

const makeRequest = ({ idempotencyKey = 'cod-test-key', quantity = 1 } = {}) => ({
  user: { id: 11 },
  store: { id: 22 },
  body: {
    idempotencyKey,
    items: [{ slug: 'test-product', size: 'M', color: '#071120', quantity }],
    totalPrice: 0,
    amount: 0,
    shippingAddress: structuredClone(shippingAddress),
    billingAddress: structuredClone(shippingAddress),
  },
  get: () => null,
})

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  },
})

const invoke = async (handler, request) => {
  const response = makeResponse()
  let nextError = null
  await handler(request, response, (error) => { nextError = error })
  return { response, nextError }
}

test('server quote accepts ₹49,999.99 and rejects ₹50,000 using database prices', async (t) => {
  for (const [price, eligible] of [[49_999.99, true], [50_000, false]]) {
    await t.test(String(price), async () => {
      activeHarness = createHarness(price)
      const { response, nextError } = await invoke(getCodEligibility, makeRequest())
      assert.equal(nextError, null)
      assert.equal(response.statusCode, 200)
      assert.equal(response.body.total, price)
      assert.equal(response.body.eligible, eligible)
      assert.equal(activeHarness.state.orders.length, 0)
      assert.equal(activeHarness.state.cart, null)
    })
  }
})

test('rejects a client total bypass and rolls back cart, order, stock, payment, and shipment changes', async () => {
  activeHarness = createHarness(25_000, 2)
  const { response, nextError } = await invoke(createCodOrder, makeRequest({ quantity: 2 }))
  assert.equal(nextError, null)
  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /below ₹50,000/)
  assert.equal(activeHarness.state.orders.length, 0)
  assert.equal(activeHarness.state.payments.length, 0)
  assert.equal(activeHarness.state.shipments.length, 0)
  assert.equal(activeHarness.state.cart, null)
  assert.equal(activeHarness.state.products[0].variants[0].quantityOnHand, 2)
})

test('persists an order with a server-computed total of ₹49,999.99', async () => {
  activeHarness = createHarness(49_999.99, 2)
  const { response, nextError } = await invoke(createCodOrder, makeRequest())
  assert.equal(nextError, null)
  assert.equal(response.statusCode, 201)
  assert.equal(response.body.amount, 49_999.99)
  assert.equal(activeHarness.state.payments[0].status, 'PENDING_COLLECTION')
  assert.equal(activeHarness.state.orders.length, 1)
  assert.equal(activeHarness.state.shipments.length, 1)
})

test('persists an unpaid COD order and queues its shipment atomically', async () => {
  activeHarness = createHarness(100, 2)
  const { response, nextError } = await invoke(createCodOrder, makeRequest())
  assert.equal(nextError, null)
  assert.equal(response.statusCode, 201)
  assert.equal(response.body.success, true)
  assert.equal(response.body.paymentStatus, 'PENDING_COLLECTION')
  assert.equal(response.body.amount, 600)
  assert.equal(activeHarness.state.orders.length, 1)
  assert.equal(activeHarness.state.payments.length, 1)
  assert.deepEqual(activeHarness.state.payments[0], {
    id: 1,
    userId: 11,
    storeId: 22,
    orderId: 1,
    provider: 'COD',
    status: 'PENDING_COLLECTION',
    amount: 600,
    currency: 'INR',
    idempotencyKey: 'cod-test-key',
    paymentAttemptKey: 'cod_cod-test-key',
    checkoutSnapshot: {
      version: 1,
      type: 'COD',
      requestFingerprint: activeHarness.state.payments[0].checkoutSnapshot.requestFingerprint,
    },
  })
  assert.equal(activeHarness.state.products[0].variants[0].quantityOnHand, 1)
  assert.deepEqual(activeHarness.state.shipments, [{ id: 1, orderId: 1 }])
})

test('same-key replays and concurrent requests create one order, payment, and shipment', async () => {
  activeHarness = createHarness(100, 3)
  const [first, concurrent] = await Promise.all([
    invoke(createCodOrder, makeRequest()),
    invoke(createCodOrder, makeRequest()),
  ])
  assert.equal(first.response.statusCode, 201)
  assert.equal(concurrent.response.statusCode, 200)
  assert.equal(first.response.body.orderId, concurrent.response.body.orderId)
  assert.equal(activeHarness.state.orders.length, 1)
  assert.equal(activeHarness.state.payments.length, 1)
  assert.equal(activeHarness.state.shipments.length, 1)
  const replay = await invoke(createCodOrder, makeRequest())
  assert.equal(replay.response.statusCode, 200)
  assert.equal(activeHarness.state.orders.length, 1)
})

test('rejects reusing a COD idempotency key with changed cart data', async () => {
  activeHarness = createHarness(100, 5)
  await invoke(createCodOrder, makeRequest())
  const changedRequest = makeRequest({ idempotencyKey: 'cod-test-key', quantity: 2 })
  const { response, nextError } = await invoke(createCodOrder, changedRequest)
  assert.equal(nextError, null)
  assert.equal(response.statusCode, 409)
  assert.equal(activeHarness.state.orders.length, 1)
  assert.equal(activeHarness.state.payments.length, 1)
})

test('does not switch from an unresolved Razorpay attempt to COD', async () => {
  activeHarness = createHarness(100, 5)
  activeHarness.state.payments.push({
    id: 4,
    userId: 11,
    storeId: 22,
    provider: 'RAZORPAY',
    status: 'CREATED',
    idempotencyKey: 'another-checkout-key',
    paymentAttemptKey: 'razorpay-attempt',
    orderId: null,
  })
  const { response, nextError } = await invoke(createCodOrder, makeRequest())
  assert.equal(nextError, null)
  assert.equal(response.statusCode, 409)
  assert.equal(activeHarness.state.orders.length, 0)
  assert.equal(activeHarness.state.payments.length, 1)
  assert.equal(activeHarness.state.shipments.length, 0)
})

test('blocks concurrent COD checkouts with different idempotency keys', async () => {
  activeHarness = createHarness(100, 5)
  const [first, concurrent] = await Promise.all([
    invoke(createCodOrder, makeRequest({ idempotencyKey: 'cod-first-session' })),
    invoke(createCodOrder, makeRequest({ idempotencyKey: 'cod-second-session' })),
  ])
  assert.equal(first.response.statusCode, 201)
  assert.equal(concurrent.response.statusCode, 409)
  assert.match(concurrent.response.body.message, /previous payment attempt is unresolved/)
  assert.equal(activeHarness.checkoutLockCalls, 2)
  assert.equal(activeHarness.state.orders.length, 1)
  assert.equal(activeHarness.state.payments.length, 1)
})

test('allows another COD checkout after collection is terminally completed', async () => {
  activeHarness = createHarness(100, 5)
  activeHarness.state.payments.push({
    id: 8,
    userId: 11,
    storeId: 22,
    provider: 'COD',
    status: 'COD_COLLECTED',
    idempotencyKey: 'completed-checkout',
    paymentAttemptKey: 'cod_completed-checkout',
    orderId: 7,
  })
  const { response, nextError } = await invoke(
    createCodOrder,
    makeRequest({ idempotencyKey: 'next-checkout' }),
  )
  assert.equal(nextError, null)
  assert.equal(response.statusCode, 201)
  assert.equal(activeHarness.state.orders.length, 1)
  assert.equal(activeHarness.state.payments.at(-1).status, 'PENDING_COLLECTION')
})

test('rejects unavailable options, missing shipment SKU, and invalid address details', async (t) => {
  await t.test('unavailable variant', async () => {
    activeHarness = createHarness()
    const request = makeRequest()
    request.body.items[0].size = 'XXL'
    const { response, nextError } = await invoke(createCodOrder, request)
    assert.equal(nextError, null)
    assert.equal(response.statusCode, 409)
    assert.equal(activeHarness.state.orders.length, 0)
  })

  await t.test('missing SKU', async () => {
    activeHarness = createHarness()
    activeHarness.state.products[0].sku = null
    activeHarness.state.products[0].variants[0].sku = null
    const { response, nextError } = await invoke(createCodOrder, makeRequest())
    assert.equal(nextError, null)
    assert.equal(response.statusCode, 409)
    assert.equal(activeHarness.state.orders.length, 0)
  })

  await t.test('invalid recipient contact', async () => {
    activeHarness = createHarness()
    const request = makeRequest()
    request.body.shippingAddress.phone = '123'
    const { response, nextError } = await invoke(createCodOrder, request)
    assert.equal(nextError, null)
    assert.equal(response.statusCode, 400)
    assert.equal(activeHarness.state.orders.length, 0)
  })
})

test('shipment queue failure rolls back the COD order, payment, and inventory decrement', async () => {
  activeHarness = createHarness(100, 2)
  failShipmentQueue = true
  try {
    const { response, nextError } = await invoke(createCodOrder, makeRequest())
    assert.ok(nextError)
    assert.equal(activeHarness.state.orders.length, 0)
    assert.equal(activeHarness.state.payments.length, 0)
    assert.equal(activeHarness.state.shipments.length, 0)
    assert.equal(activeHarness.state.products[0].variants[0].quantityOnHand, 2)
    assert.equal(activeHarness.state.cart, null)
  } finally {
    failShipmentQueue = false
  }
})
