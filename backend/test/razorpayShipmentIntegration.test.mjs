import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

const initialPayment = () => ({
  id: 33,
  userId: 11,
  storeId: 22,
  provider: 'RAZORPAY',
  providerOrderId: 'order_test',
  providerPaymentId: null,
  providerSignature: null,
  orderId: null,
  status: 'CREATED',
  amount: 23,
  currency: 'INR',
  idempotencyKey: 'checkout-test-key',
  paymentAttemptKey: 'checkout-test-attempt',
  checkoutSnapshot: { total: 23, currency: 'INR', cartId: 66 },
})

let activeState
let signatureValid = true
let finalizedOrderCreated = true
let signatureVerificationCalls = 0
let queueFailuresRemaining = 0
let providerOrderCalls = 0
let checkoutLockCalls = 0
let transactionTail = Promise.resolve()

const matchesPaymentWhere = (payment, where = {}) => {
  if (!payment) return false
  for (const field of ['id', 'userId', 'storeId', 'provider', 'idempotencyKey', 'orderId']) {
    if (where[field] !== undefined && payment[field] !== where[field]) return false
  }
  if (where.id?.not !== undefined && payment.id === where.id.not) return false
  if (where.paymentAttemptKey !== undefined && payment.paymentAttemptKey !== where.paymentAttemptKey) return false
  if (where.status !== undefined) {
    const matchesStatus = Array.isArray(where.status.in)
      ? where.status.in.includes(payment.status)
      : payment.status === where.status
    if (!matchesStatus) return false
  }
  if (where.OR && !where.OR.some((condition) => matchesPaymentWhere(payment, condition))) return false
  return true
}

const findPayment = (where) => (
  [activeState.codPayment, activeState.payment].find((payment) => matchesPaymentWhere(payment, where)) ?? null
)

const prismaFacade = {
  payment: {
    findFirst: async ({ where } = {}) => structuredClone(findPayment(where)),
    findUnique: async ({ where } = {}) => {
      if (where?.userId_storeId_paymentAttemptKey) {
        const key = where.userId_storeId_paymentAttemptKey.paymentAttemptKey
        return structuredClone([activeState.codPayment, activeState.payment]
          .find((payment) => payment?.paymentAttemptKey === key) ?? null)
      }
      return structuredClone(activeState.payment)
    },
    updateMany: async ({ where = {}, data }) => {
      const payment = findPayment(where)
      if (!payment) return { count: 0 }
      Object.assign(payment, data)
      return { count: 1 }
    },
  },
  $transaction: (callback) => {
    const current = transactionTail.then(async () => {
      const snapshot = structuredClone(activeState)
      activeState.transactionCalls += 1
      const tx = {
        $queryRaw: async () => [],
        payment: {
          findFirst: async ({ where } = {}) => findPayment(where),
          updateMany: async ({ where = {}, data }) => {
            const payment = findPayment(where)
            if (!payment) return { count: 0 }
            Object.assign(payment, data)
            return { count: 1 }
          },
          findUnique: async ({ where } = {}) => (
            where?.userId_storeId_paymentAttemptKey
              ? ([activeState.codPayment, activeState.payment]
                .find((payment) => payment?.paymentAttemptKey === where.userId_storeId_paymentAttemptKey.paymentAttemptKey) ?? null)
              : activeState.payment
          ),
          create: async ({ data }) => {
            if ([activeState.codPayment, activeState.payment]
              .some((payment) => payment?.paymentAttemptKey === data.paymentAttemptKey)) {
              throw Object.assign(new Error('Unique payment attempt conflict'), { code: 'P2002' })
            }
            const payment = { id: 35, ...data }
            activeState.payment = payment
            return payment
          },
          update: async ({ data }) => {
            Object.assign(activeState.payment, data)
            return activeState.payment
          },
        },
        order: {
          findUnique: async () => null,
        },
        shipment: {
          upsert: async (args) => {
            activeState.shipmentQueueCalls.push(args)
            if (queueFailuresRemaining > 0) {
              queueFailuresRemaining -= 1
              throw new Error('Shipment queue unavailable')
            }
            const existing = activeState.shipments.find((shipment) => shipment.orderId === args.where.orderId)
            if (existing) return existing
            const shipment = { id: activeState.shipments.length + 1, ...args.create }
            activeState.shipments.push(shipment)
            return shipment
          },
          order: { findUnique: async () => null },
        },
      }

      try {
        return await callback(tx)
      } catch (error) {
        activeState.payment = snapshot.payment
        activeState.codPayment = snapshot.codPayment
        activeState.ordersFinalized = snapshot.ordersFinalized
        activeState.shipments = snapshot.shipments
        activeState.rolledBackTransactions += 1
        throw error
      }
    })
    transactionTail = current.catch(() => {})
    return current
  },
}

mock.module(new URL('../lib/prisma.js', import.meta.url).href, {
  defaultExport: prismaFacade,
  namedExports: { prisma: prismaFacade },
})
mock.module(new URL('../controllers/customerCommerceController.js', import.meta.url).href, {
  namedExports: {
    assertPaymentCheckoutSnapshotMatchesRequest: async () => {},
    lockCustomerCheckout: async () => {
      checkoutLockCalls += 1
    },
    assertNoUnresolvedCheckoutPayment: async (_tx, req, exceptPaymentId = null) => {
      const unresolved = [activeState.codPayment, activeState.payment].find((payment) => (
        payment
        && payment.userId === req.user.id
        && payment.storeId === req.store.id
        && payment.id !== exceptPaymentId
        && ((payment.provider === 'COD' && payment.status === 'PENDING_COLLECTION')
          || (payment.provider === 'RAZORPAY'
            && payment.orderId == null
            && ['CREATED', 'AUTHORIZED', 'CAPTURED'].includes(payment.status)))
      ))
      if (unresolved) throw Object.assign(new Error('A previous payment attempt is unresolved'), { statusCode: 409 })
    },
    calculateTotals: async () => ({
      cart: {
        id: 66,
        items: [{ id: 70, productId: 8, variantId: 18, quantity: 1 }],
      },
      total: 23,
    }),
    createPaymentCheckoutSnapshot: () => ({
      version: 1,
      total: 23,
      currency: 'INR',
      cartId: 66,
      items: [{ cartItemId: 70, productId: 8, variantId: 18, quantity: 1 }],
    }),
    finalizeOrderFromCart: async () => {
      if (finalizedOrderCreated) activeState.ordersFinalized += 1
      return {
        order: { id: 44 },
        created: finalizedOrderCreated,
      }
    },
  },
})
mock.module(new URL('../services/razorpayService.js', import.meta.url).href, {
  namedExports: {
    createRazorpayOrder: async ({ amountInPaise, currency, receipt }) => {
      providerOrderCalls += 1
      return { id: 'order_created', amount: amountInPaise, currency, receipt }
    },
    findRazorpayOrderByReceipt: async () => null,
    verifyRazorpaySignature: () => {
      signatureVerificationCalls += 1
      return signatureValid
    },
  },
})

const { createRazorpayOrder, verifyRazorpayPayment } = await import('../controllers/razorpayController.js')

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

const invokeOrder = async (request = makeRazorpayOrderRequest()) => {
  const response = makeResponse()
  let nextError = null
  await createRazorpayOrder(request, response, (error) => { nextError = error })
  return { response, nextError }
}

const makeRequest = () => ({
  user: { id: 11 },
  store: { id: 22 },
  body: {
    paymentId: 33,
    razorpay_payment_id: 'pay_test',
    razorpay_order_id: 'order_test',
    razorpay_signature: 'a'.repeat(64),
  },
})

const makeRazorpayOrderRequest = () => ({
  user: { id: 11 },
  store: { id: 22 },
  body: {
    idempotencyKey: 'checkout-test-key',
    paymentAttemptKey: 'razorpay-new-attempt',
    expectedCart: [{ productId: 8, variantId: 18, quantity: 1 }],
  },
})

const prepare = ({ failQueue = false, queueFailures = 0, orderCreation = false } = {}) => {
  activeState = {
    payment: orderCreation ? null : initialPayment(),
    codPayment: null,
    ordersFinalized: 0,
    shipments: [],
    shipmentQueueCalls: [],
    transactionCalls: 0,
    rolledBackTransactions: 0,
  }
  transactionTail = Promise.resolve()
  queueFailuresRemaining = failQueue ? Number.POSITIVE_INFINITY : queueFailures
  signatureValid = true
  finalizedOrderCreated = true
  signatureVerificationCalls = 0
  providerOrderCalls = 0
  checkoutLockCalls = 0
}

test('does not create a Razorpay payment attempt for a COD-reserved checkout key', async () => {
  prepare()
  activeState.codPayment = {
    id: 34,
    userId: 11,
    storeId: 22,
    provider: 'COD',
    status: 'PENDING_COLLECTION',
    idempotencyKey: 'checkout-test-key',
  }
  const response = makeResponse()
  let nextError = null

  await createRazorpayOrder(makeRazorpayOrderRequest(), response, (error) => { nextError = error })

  assert.equal(nextError?.statusCode, 409)
  assert.match(nextError.message, /reserved for cash on delivery/)
  assert.equal(activeState.transactionCalls, 1)
  assert.equal(activeState.shipments.length, 0)
  assert.equal(activeState.ordersFinalized, 0)
})

test('does not switch from an unresolved COD payment across checkout keys', async () => {
  prepare({ orderCreation: true })
  activeState.codPayment = {
    id: 34,
    userId: 11,
    storeId: 22,
    provider: 'COD',
    status: 'PENDING_COLLECTION',
    idempotencyKey: 'cod-from-another-session',
    paymentAttemptKey: 'cod_cod-from-another-session',
    orderId: 44,
  }
  const request = makeRazorpayOrderRequest()
  request.body.idempotencyKey = 'razorpay-from-this-session'
  const { response, nextError } = await invokeOrder(request)
  assert.equal(nextError?.statusCode, 409)
  assert.match(nextError.message, /previous payment attempt is unresolved/)
  assert.equal(response.statusCode, 200)
  assert.equal(activeState.payment, null)
  assert.equal(providerOrderCalls, 0)
})

test('rejects Razorpay creation when the backend cart changed after synchronization', async () => {
  prepare({ orderCreation: true })
  const request = makeRazorpayOrderRequest()
  request.body.expectedCart[0].quantity = 2
  const { response, nextError } = await invokeOrder(request)
  assert.equal(nextError?.statusCode, 409)
  assert.match(nextError.message, /cart changed after synchronization/)
  assert.equal(activeState.payment, null)
  assert.equal(providerOrderCalls, 0)
})

test('serializes competing Razorpay attempts from separate sessions', async () => {
  prepare({ orderCreation: true })
  const firstRequest = makeRazorpayOrderRequest()
  firstRequest.body.idempotencyKey = 'checkout-first-session'
  firstRequest.body.paymentAttemptKey = 'attempt-first-session'
  const secondRequest = makeRazorpayOrderRequest()
  secondRequest.body.idempotencyKey = 'checkout-second-session'
  secondRequest.body.paymentAttemptKey = 'attempt-second-session'

  const [first, second] = await Promise.all([
    invokeOrder(firstRequest),
    invokeOrder(secondRequest),
  ])
  assert.equal(first.response.statusCode, 201)
  assert.equal(first.nextError, null)
  assert.equal(second.nextError?.statusCode, 409)
  assert.match(second.nextError.message, /previous payment attempt is unresolved/)
  assert.equal(checkoutLockCalls, 2)
  assert.equal(activeState.payment.paymentAttemptKey, 'attempt-first-session')
  assert.equal(providerOrderCalls, 1)
})

test('replays an identical Razorpay request without creating another payment order', async () => {
  prepare({ orderCreation: true })
  const first = await invokeOrder()
  const replay = await invokeOrder()
  assert.equal(first.nextError, null)
  assert.equal(first.response.statusCode, 201)
  assert.equal(replay.nextError, null)
  assert.equal(replay.response.statusCode, 200)
  assert.equal(replay.response.body.paymentId, first.response.body.paymentId)
  assert.equal(providerOrderCalls, 1)
})

test('allows a new Razorpay attempt after a terminal or finalized prior payment', async (t) => {
  for (const [name, previousPayment] of [
    ['terminal failure', {
      status: 'FAILED',
      orderId: null,
      providerOrderId: null,
      providerPaymentId: null,
    }],
    ['completed order', {
      status: 'AUTHORIZED',
      orderId: 44,
      providerOrderId: 'order_completed',
      providerPaymentId: 'pay_completed',
    }],
  ]) {
    await t.test(name, async () => {
      prepare({ orderCreation: true })
      activeState.payment = {
        ...initialPayment(),
        ...previousPayment,
        paymentAttemptKey: 'previous-attempt',
        idempotencyKey: 'previous-checkout',
      }
      const request = makeRazorpayOrderRequest()
      request.body.idempotencyKey = name === 'terminal failure' ? 'previous-checkout' : 'new-checkout'
      request.body.paymentAttemptKey = 'new-attempt'
      const { response, nextError } = await invokeOrder(request)
      assert.equal(nextError, null)
      assert.equal(response.statusCode, 201)
      assert.equal(activeState.payment.paymentAttemptKey, 'new-attempt')
      assert.equal(providerOrderCalls, 1)
    })
  }
})

test('payment lookup mock enforces COD user and store filters', async (t) => {
  for (const field of ['userId', 'storeId']) {
    await t.test(`mismatched ${field}`, async () => {
      prepare()
      activeState.codPayment = {
        id: 34,
        userId: 11,
        storeId: 22,
        provider: 'COD',
        status: 'PENDING_COLLECTION',
        idempotencyKey: 'checkout-test-key',
      }
      const where = {
        id: 34,
        userId: 11,
        storeId: 22,
        idempotencyKey: 'checkout-test-key',
        provider: 'COD',
      }
      assert.equal(findPayment(where), activeState.codPayment)
      assert.equal(findPayment({ ...where, [field]: 99 }), null)
    })
  }
})

test('queues one shipment after successful Razorpay order finalization', async () => {
  prepare()
  const response = makeResponse()

  await verifyRazorpayPayment(makeRequest(), response)

  assert.equal(response.statusCode, 200)
  assert.equal(activeState.payment.orderId, 44)
  assert.equal(activeState.payment.status, 'AUTHORIZED')
  assert.deepEqual(activeState.shipments, [{ id: 1, orderId: 44 }])
  assert.equal(activeState.shipmentQueueCalls.length, 1)
  assert.deepEqual(activeState.shipmentQueueCalls[0], {
    where: { orderId: 44 },
    create: { orderId: 44 },
    update: {},
  })
})

test('rolls back payment and order transaction when shipment queueing fails', async () => {
  prepare({ failQueue: true })
  const response = makeResponse()

  await verifyRazorpayPayment(makeRequest(), response)

  assert.equal(response.statusCode, 500)
  assert.equal(activeState.rolledBackTransactions, 1)
  assert.equal(activeState.payment.status, 'CREATED')
  assert.equal(activeState.payment.providerPaymentId, null)
  assert.equal(activeState.payment.orderId, null)
  assert.deepEqual(activeState.shipments, [])
  assert.equal(activeState.shipmentQueueCalls.length, 1)
})

test('retry after queue failure finalizes one order and queues one shipment', async () => {
  prepare({ queueFailures: 1 })

  const firstResponse = makeResponse()
  await verifyRazorpayPayment(makeRequest(), firstResponse)

  assert.equal(firstResponse.statusCode, 500)
  assert.equal(activeState.rolledBackTransactions, 1)
  assert.equal(activeState.payment.status, 'CREATED')
  assert.equal(activeState.payment.providerPaymentId, null)
  assert.equal(activeState.payment.orderId, null)
  assert.equal(activeState.ordersFinalized, 0)
  assert.deepEqual(activeState.shipments, [])

  const retryResponse = makeResponse()
  await verifyRazorpayPayment(makeRequest(), retryResponse)

  assert.equal(retryResponse.statusCode, 200)
  assert.equal(activeState.rolledBackTransactions, 1)
  assert.equal(activeState.transactionCalls, 2)
  assert.equal(signatureVerificationCalls, 2)
  assert.equal(activeState.payment.status, 'AUTHORIZED')
  assert.equal(activeState.payment.providerPaymentId, 'pay_test')
  assert.equal(activeState.payment.orderId, 44)
  assert.equal(activeState.ordersFinalized, 1)
  assert.equal(activeState.shipmentQueueCalls.length, 2)
  assert.deepEqual(activeState.shipments, [{ id: 1, orderId: 44 }])
})

test('does not queue an order when Razorpay verification fails', async () => {
  prepare()
  signatureValid = false
  const response = makeResponse()

  await verifyRazorpayPayment(makeRequest(), response)

  assert.equal(response.statusCode, 400)
  assert.equal(activeState.transactionCalls, 0)
  assert.equal(activeState.shipmentQueueCalls.length, 0)
  assert.deepEqual(activeState.shipments, [])
})
