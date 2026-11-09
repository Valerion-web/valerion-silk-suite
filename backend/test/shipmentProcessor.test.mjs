import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createShipmentProcessor } from '../services/shipmentProcessor.js'

const now = new Date('2026-10-31T12:00:00.000Z')
const leaseToken = 'shipment-test-lease'

const validOrder = () => ({
  id: 99,
  userId: 11,
  storeId: 22,
  idempotencyKey: 'checkout-test-key',
  createdAt: new Date('2026-10-30T10:00:00.000Z'),
  totalPrice: 23,
  currency: 'INR',
  subtotalBeforeDiscount: 25,
  discountAmount: 2.5,
  shippingCost: 0.5,
  shippingAddress: JSON.stringify({
    name: 'Test Recipient',
    line1: '1 Test Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
    phone: '+91 9876543210',
    email: 'recipient@example.test',
  }),
  billingAddress: null,
  user: { email: 'recipient@example.test' },
  items: [
    { quantity: 2, price: 10, product: { name: 'Test Product', sku: 'TEST-1' }, variant: null },
    { quantity: 1, price: 5, product: { name: 'Another Product', sku: 'TEST-2' }, variant: null },
  ],
  payments: [{
    id: 12,
    provider: 'RAZORPAY',
    status: 'AUTHORIZED',
    providerPaymentId: 'pay_test',
    amount: 23,
    currency: 'INR',
  }],
})

const validCodOrder = () => {
  const order = validOrder()
  order.payments = [{
    id: 13,
    orderId: order.id,
    userId: order.userId,
    storeId: order.storeId,
    provider: 'COD',
    status: 'PENDING_COLLECTION',
    amount: order.totalPrice,
    currency: order.currency,
    idempotencyKey: order.idempotencyKey,
    paymentAttemptKey: `cod_${order.idempotencyKey}`,
    providerOrderId: null,
    providerPaymentId: null,
    providerSignature: null,
  }]
  return order
}

const validShipment = () => ({
  id: 5,
  orderId: 99,
  status: 'PENDING',
  attemptCount: 0,
  nextAttemptAt: new Date(now.getTime() - 1_000),
  processingStartedAt: null,
  processingLeaseToken: null,
  shiprocketOrderId: null,
  shiprocketShipmentId: null,
  packageWeightKg: '1.250',
  packageLengthCm: '10.25',
  packageBreadthCm: '8.50',
  packageHeightCm: '3.00',
  packageConfirmedAt: new Date('2026-10-31T11:00:00.000Z'),
  packageConfirmedById: 7,
})

const makeHarness = ({
  order = validOrder(),
  shipment = validShipment(),
  response = { order_id: 501, shipment_id: 701, awb_code: 'AWB-1', courier_name: 'Test Courier', tracking_url: 'https://tracking.example.test/1' },
  providerError = null,
  orderLoadError = null,
  lease = leaseToken,
  beforeOutcomeSave = null,
  failOutcomeSaveCalls = [],
} = {}) => {
  const state = { order, shipment }
  const updateManyCalls = []
  const findUniqueCalls = []
  const providerCalls = []
  let outcomeSaveCalls = 0

  const applyData = (target, data) => {
    for (const [key, value] of Object.entries(data)) {
      target[key] = value && typeof value === 'object' && 'increment' in value
        ? target[key] + value.increment
        : value
    }
  }

  const prismaClient = {
    shipment: {
      updateMany: async (args) => {
        updateManyCalls.push(args)
        const where = args.where
        if (Array.isArray(where.status?.in)) {
          const eligible = state.shipment.id === where.id
            && where.status.in.includes(state.shipment.status)
            && state.shipment.nextAttemptAt <= where.nextAttemptAt.lte
            && state.shipment.processingStartedAt === null
            && state.shipment.processingLeaseToken === null
            && state.shipment.packageConfirmedAt instanceof Date
            && Number.isSafeInteger(state.shipment.packageConfirmedById)
            && state.shipment.packageWeightKg !== null
            && state.shipment.packageLengthCm !== null
            && state.shipment.packageBreadthCm !== null
            && state.shipment.packageHeightCm !== null
          if (!eligible) return { count: 0 }
          applyData(state.shipment, args.data)
          return { count: 1 }
        }

        outcomeSaveCalls += 1
        await beforeOutcomeSave?.({ state, args, saveCall: outcomeSaveCalls })
        if (failOutcomeSaveCalls.includes(outcomeSaveCalls)) {
          throw new Error(`Simulated outcome persistence failure ${outcomeSaveCalls}`)
        }
        const ownsLease = state.shipment.id === where.id
          && state.shipment.status === where.status
          && state.shipment.processingLeaseToken === where.processingLeaseToken
        if (!ownsLease) return { count: 0 }
        applyData(state.shipment, args.data)
        return { count: 1 }
      },
      findUnique: async (args) => {
        findUniqueCalls.push(args)
        if (args.include?.order && orderLoadError) throw orderLoadError
        if (args.select) {
          const { status, processingStartedAt, processingLeaseToken } = state.shipment
          return { status, processingStartedAt, processingLeaseToken }
        }
        return { ...structuredClone(state.shipment), order: structuredClone(state.order) }
      },
    },
  }

  const shiprocketClient = {
    createCustomOrder: async (payload) => {
      providerCalls.push(payload)
      if (providerError) throw providerError
      return response
    },
  }

  const processor = createShipmentProcessor({
    prismaClient,
    shiprocketClient,
    env: { SHIPROCKET_PICKUP_LOCATION: 'Test Pickup' },
    clock: () => new Date(now),
    createLeaseToken: () => lease,
  })

  return { processor, state, updateManyCalls, findUniqueCalls, providerCalls }
}

test('claims an eligible verified prepaid shipment and records provider IDs and tracking data', async () => {
  const harness = makeHarness()

  const result = await harness.processor.processShipment(5)

  assert.deepEqual(result, {
    outcome: 'CREATED',
    shipmentId: 5,
    shiprocketOrderId: '501',
    shiprocketShipmentId: '701',
    paymentId: 12,
  })
  assert.equal(harness.providerCalls.length, 1)
  assert.equal(harness.state.shipment.status, 'CREATED')
  assert.equal(harness.state.shipment.shiprocketOrderId, '501')
  assert.equal(harness.state.shipment.shiprocketShipmentId, '701')
  assert.equal(harness.state.shipment.awbCode, 'AWB-1')
  assert.equal(harness.state.shipment.courierName, 'Test Courier')
  assert.equal(harness.state.shipment.trackingUrl, 'https://tracking.example.test/1')
  assert.equal(harness.state.shipment.processingStartedAt, null)
  assert.equal(harness.state.shipment.processingLeaseToken, null)
})

test('atomically claims with eligibility predicates and saves outcome only with its lease token', async () => {
  const harness = makeHarness()

  await harness.processor.processShipment(5)

  assert.deepEqual(harness.updateManyCalls[0], {
    where: {
      id: 5,
      status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
      nextAttemptAt: { lte: now },
      processingLeaseToken: null,
      processingStartedAt: null,
      packageConfirmedAt: { not: null },
      packageConfirmedById: { not: null },
      packageWeightKg: { not: null },
      packageLengthCm: { not: null },
      packageBreadthCm: { not: null },
      packageHeightCm: { not: null },
    },
    data: {
      status: 'PROCESSING',
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      processingStartedAt: now,
      processingLeaseToken: leaseToken,
    },
  })
  assert.deepEqual(harness.updateManyCalls[1].where, {
    id: 5,
    status: 'PROCESSING',
    processingLeaseToken: leaseToken,
  })
})

test('supports a single CAPTURED Razorpay payment as verified prepaid eligibility', async () => {
  const order = validOrder()
  order.payments[0].status = 'CAPTURED'
  const harness = makeHarness({ order })

  const result = await harness.processor.processShipment(5)

  assert.equal(result.outcome, 'CREATED')
  assert.equal(harness.providerCalls.length, 1)
})

test('creates a COD Shiprocket order with the outstanding collection amount and leaves it unpaid', async () => {
  const order = validOrder()
  order.payments = [{
    id: 13,
    orderId: order.id,
    userId: order.userId,
    storeId: order.storeId,
    provider: 'COD',
    status: 'PENDING_COLLECTION',
    amount: order.totalPrice,
    currency: order.currency,
    idempotencyKey: order.idempotencyKey,
    paymentAttemptKey: `cod_${order.idempotencyKey}`,
    providerOrderId: null,
    providerPaymentId: null,
  }]
  const harness = makeHarness({ order })

  const result = await harness.processor.processShipment(5)

  assert.equal(result.outcome, 'CREATED')
  assert.equal(harness.providerCalls.length, 1)
  assert.equal(harness.providerCalls[0].payment_method, 'COD')
  assert.equal(harness.providerCalls[0].cod_amount, 23)
  assert.equal(harness.providerCalls[0].sub_total, 22.5)
  assert.equal(harness.state.order.payments[0].status, 'PENDING_COLLECTION')
  assert.equal(harness.state.order.payments[0].providerPaymentId, null)
})

test('accepts a COD total of ₹49,999.99 but rejects ₹50,000', async (t) => {
  for (const [amount, expectedOutcome] of [
    [49_999.99, 'CREATED'],
    [50_000, 'FAILED'],
  ]) {
    await t.test(String(amount), async () => {
      const order = validOrder()
      order.totalPrice = amount
      order.subtotalBeforeDiscount = amount
      order.discountAmount = 0
      order.shippingCost = 0
      order.items = [{
        quantity: 1,
        price: amount,
        product: { name: 'Test Product', sku: 'TEST-1' },
        variant: null,
      }]
      order.payments[0] = {
        ...order.payments[0],
        provider: 'COD',
        status: 'PENDING_COLLECTION',
        amount,
        paymentAttemptKey: 'cod_test_key',
        providerOrderId: null,
        providerPaymentId: null,
        providerSignature: null,
      }
      const harness = makeHarness({ order })

      const result = await harness.processor.processShipment(5)

      assert.equal(result.outcome, expectedOutcome)
      assert.equal(harness.providerCalls.length, expectedOutcome === 'CREATED' ? 1 : 0)
      if (expectedOutcome === 'CREATED') assert.equal(harness.providerCalls[0].cod_amount, amount)
    })
  }
})

test('rejects invalid COD amount, state, and provider identifiers before submission', async (t) => {
  for (const [name, update] of [
    ['missing amount', (payment) => { payment.amount = null }],
    ['negative amount', (payment) => { payment.amount = -1 }],
    ['amount above the COD cap', (payment, order) => {
      payment.amount = 50_000
      order.totalPrice = 50_000
    }],
    ['amount inconsistent with the order', (payment) => { payment.amount = 22 }],
    ['wrong currency', (payment) => { payment.currency = 'USD' }],
    ['wrong state', (payment) => { payment.status = 'CAPTURED' }],
    ['already collected', (payment) => { payment.status = 'COD_COLLECTED' }],
    ['Razorpay identifiers on a COD payment', (payment) => { payment.providerPaymentId = 'pay_test' }],
  ]) {
    await t.test(name, async () => {
      const order = validOrder()
      const payment = {
        ...order.payments[0],
        provider: 'COD',
        status: 'PENDING_COLLECTION',
        amount: order.totalPrice,
        paymentAttemptKey: 'cod_test_key',
        providerOrderId: null,
        providerPaymentId: null,
        providerSignature: null,
      }
      update(payment, order)
      order.payments = [payment]
      const harness = makeHarness({ order })

      const result = await harness.processor.processShipment(5)

      assert.equal(result.outcome, 'FAILED')
      assert.equal(harness.providerCalls.length, 0)
      assert.equal(harness.state.shipment.status, 'FAILED')
    })
  }
})

test('rejects missing payment and payments without an accepted verified status', async (t) => {
  for (const [name, payments] of [
    ['missing payment', []],
    ['created payment', [{ ...validOrder().payments[0], status: 'CREATED' }]],
    ['missing provider payment ID', [{ ...validOrder().payments[0], providerPaymentId: null }]],
    ['wrong provider', [{ ...validOrder().payments[0], provider: 'OTHER' }]],
  ]) {
    await t.test(name, async () => {
      const order = validOrder()
      order.payments = payments
      const harness = makeHarness({ order })

      const result = await harness.processor.processShipment(5)

      assert.equal(result.outcome, 'FAILED')
      assert.match(result.error, /single verified prepaid payment/)
      assert.equal(harness.providerCalls.length, 0)
      assert.equal(harness.state.shipment.status, 'FAILED')
    })
  }
})

test('rejects a payment amount or currency that does not match the finalized order', async () => {
  const order = validOrder()
  order.payments[0].amount = 22
  const harness = makeHarness({ order })

  const result = await harness.processor.processShipment(5)

  assert.equal(result.outcome, 'FAILED')
  assert.match(result.error, /payment details do not match/)
  assert.equal(harness.providerCalls.length, 0)
})

test('rejects missing shipping address and recipient contact details', async (t) => {
  for (const [name, updateOrder] of [
    ['missing shipping address', (order) => { order.shippingAddress = null }],
    ['missing phone', (order) => {
      const address = JSON.parse(order.shippingAddress)
      delete address.phone
      order.shippingAddress = JSON.stringify(address)
    }],
    ['missing email', (order) => {
      const address = JSON.parse(order.shippingAddress)
      delete address.email
      order.shippingAddress = JSON.stringify(address)
      order.user.email = null
    }],
  ]) {
    await t.test(name, async () => {
      const order = validOrder()
      updateOrder(order)
      const harness = makeHarness({ order })

      const result = await harness.processor.processShipment(5)

      assert.equal(result.outcome, 'FAILED')
      assert.equal(harness.providerCalls.length, 0)
    })
  }
})

test('rejects an item with a missing SKU before provider submission', async () => {
  const order = validOrder()
  order.items[0].product.sku = null
  const harness = makeHarness({ order })

  const result = await harness.processor.processShipment(5)

  assert.equal(result.outcome, 'FAILED')
  assert.match(result.error, /SKU is missing/)
  assert.equal(harness.providerCalls.length, 0)
})

test('unconfirmed or incomplete package data cannot be processed', async (t) => {
  const unconfirmed = validShipment()
  unconfirmed.packageConfirmedAt = null
  const missingMeasurement = validShipment()
  missingMeasurement.packageWeightKg = null
  const invalidDimensions = validShipment()
  invalidDimensions.packageLengthCm = '0.50'
  const invalidWeight = validShipment()
  invalidWeight.packageWeightKg = '0'

  for (const [name, shipment, expectedOutcome] of [
    ['unconfirmed package is not claimable', unconfirmed, 'INELIGIBLE'],
    ['missing package measurement is not claimable', missingMeasurement, 'INELIGIBLE'],
    ['invalid confirmed dimension fails validation', invalidDimensions, 'FAILED'],
    ['invalid confirmed weight fails validation', invalidWeight, 'FAILED'],
  ]) {
    await t.test(name, async () => {
      const harness = makeHarness({ shipment })

      const result = await harness.processor.processShipment(5)

      assert.equal(result.outcome, expectedOutcome)
      assert.equal(harness.providerCalls.length, 0)
    })
  }
})

test('COD orders remain gated on administrator package confirmation', async () => {
  const shipment = validShipment()
  shipment.packageConfirmedAt = null
  const harness = makeHarness({ order: validCodOrder(), shipment })

  const result = await harness.processor.processShipment(5)

  assert.equal(result.outcome, 'INELIGIBLE')
  assert.equal(harness.providerCalls.length, 0)
  assert.equal(harness.state.order.payments[0].status, 'PENDING_COLLECTION')
})

test('builds a rupee payload from stored rupee amounts at paise precision', async () => {
  const harness = makeHarness()

  await harness.processor.processShipment(5)

  const payload = harness.providerCalls[0]
  assert.deepEqual(payload.order_items, [
    { name: 'Test Product', sku: 'TEST-1', units: 2, selling_price: 10 },
    { name: 'Another Product', sku: 'TEST-2', units: 1, selling_price: 5 },
  ])
  assert.equal(payload.sub_total, 22.5)
  assert.equal(payload.total_discount, 2.5)
  assert.equal(payload.shipping_charges, 0.5)
  assert.equal(payload.payment_method, 'Prepaid')
  assert.equal(Object.hasOwn(payload, 'cod_amount'), false)
  assert.equal(payload.sub_total + payload.shipping_charges, 23)
  assert.equal(payload.sub_total + payload.total_discount, 25)
  assert.equal(
    payload.order_items.reduce((sum, item) => sum + item.selling_price * item.units, 0),
    25,
  )
  assert.equal(payload.order_items.some((item) => 'discount' in item), false)
  assert.equal(payload.weight, 1.25)
  assert.equal(payload.length, 10.25)
  assert.equal(payload.breadth, 8.5)
  assert.equal(payload.height, 3)
})

test('rejects incomplete, inconsistent or unsupported order financial data', async (t) => {
  for (const [name, updateOrder, expectedMessage] of [
    ['missing discount data', (order) => { order.discountAmount = null }, /Stored discount is missing or invalid/],
    ['item price with sub-paise precision', (order) => { order.items[0].price = 10.001 }, /more than two decimal places/],
    ['payment currency mismatch', (order) => { order.payments[0].currency = 'USD' }, /payment details do not match/],
    ['finalized total mismatch', (order) => {
      order.totalPrice = 24
      order.payments[0].amount = 24
    }, /item, discount, shipping, and order totals do not reconcile/],
  ]) {
    await t.test(name, async () => {
      const order = validOrder()
      updateOrder(order)
      const harness = makeHarness({ order })

      const result = await harness.processor.processShipment(5)

      assert.equal(result.outcome, 'FAILED')
      assert.match(result.error, expectedMessage)
      assert.equal(harness.providerCalls.length, 0)
    })
  }
})

test('does not claim a shipment that is already processing', async () => {
  const shipment = validShipment()
  shipment.status = 'PROCESSING'
  shipment.processingStartedAt = new Date(now)
  shipment.processingLeaseToken = 'existing-lease'
  const harness = makeHarness({ shipment })

  const result = await harness.processor.processShipment(5)

  assert.deepEqual(result, { outcome: 'ALREADY_CLAIMED', shipmentId: 5 })
  assert.equal(harness.updateManyCalls.length, 1)
  assert.equal(harness.providerCalls.length, 0)
})

test('retryable provider failures schedule the exponential retry delay', async () => {
  const shipment = validShipment()
  shipment.attemptCount = 1
  const providerError = Object.assign(new Error('rate limited'), {
    code: 'SHIPROCKET_REQUEST_FAILED',
    statusCode: 429,
  })
  const harness = makeHarness({ shipment, providerError })

  const result = await harness.processor.processShipment(5)

  assert.equal(result.outcome, 'RETRY_SCHEDULED')
  assert.equal(harness.state.shipment.status, 'RETRY_SCHEDULED')
  assert.equal(harness.state.shipment.attemptCount, 2)
  assert.equal(harness.state.shipment.nextAttemptAt.getTime(), now.getTime() + 120_000)
  assert.equal(harness.state.shipment.processingLeaseToken, null)
})

test('uncertain provider outcomes require reconciliation instead of automatic retry', async () => {
  const providerError = Object.assign(new Error('connection lost'), {
    code: 'SHIPROCKET_REQUEST_UNAVAILABLE',
  })
  const harness = makeHarness({ providerError })

  const result = await harness.processor.processShipment(5)

  assert.equal(result.outcome, 'RECONCILIATION_REQUIRED')
  assert.equal(harness.state.shipment.status, 'RECONCILIATION_REQUIRED')
  assert.equal(harness.state.shipment.nextAttemptAt.getTime(), validShipment().nextAttemptAt.getTime())
  assert.equal(harness.state.shipment.processingLeaseToken, null)
})

test('COD provider retries keep payment pending and uncertain submissions require reconciliation', async (t) => {
  await t.test('rate limits can retry the same unpaid COD obligation', async () => {
    const shipment = validShipment()
    shipment.attemptCount = 1
    const providerError = Object.assign(new Error('rate limited'), {
      code: 'SHIPROCKET_REQUEST_FAILED',
      statusCode: 429,
    })
    const harness = makeHarness({ order: validCodOrder(), shipment, providerError })
    const result = await harness.processor.processShipment(5)

    assert.equal(result.outcome, 'RETRY_SCHEDULED')
    assert.equal(harness.providerCalls[0].payment_method, 'COD')
    assert.equal(harness.state.order.payments[0].status, 'PENDING_COLLECTION')
    assert.equal(harness.state.order.payments[0].providerPaymentId, null)
  })

  await t.test('uncertain submissions are not automatically retried', async () => {
    const providerError = Object.assign(new Error('connection lost'), {
      code: 'SHIPROCKET_REQUEST_UNAVAILABLE',
    })
    const harness = makeHarness({ order: validCodOrder(), providerError })
    const result = await harness.processor.processShipment(5)

    assert.equal(result.outcome, 'RECONCILIATION_REQUIRED')
    assert.equal(harness.state.shipment.status, 'RECONCILIATION_REQUIRED')
    assert.equal(harness.state.order.payments[0].status, 'PENDING_COLLECTION')
  })
})

test('existing provider identifiers are preserved and do not trigger another submission', async () => {
  const shipment = validShipment()
  shipment.shiprocketOrderId = 'previous-order'
  shipment.shiprocketShipmentId = 'previous-shipment'
  const harness = makeHarness({ shipment })

  const result = await harness.processor.processShipment(5)

  assert.equal(result.outcome, 'RECONCILIATION_REQUIRED')
  assert.equal(harness.providerCalls.length, 0)
  assert.equal(harness.state.shipment.shiprocketOrderId, 'previous-order')
  assert.equal(harness.state.shipment.shiprocketShipmentId, 'previous-shipment')
})

test('partial existing provider identifiers require reconciliation without overwrite or resubmission', async (t) => {
  for (const [name, identifiers] of [
    ['order identifier only', { shiprocketOrderId: 'previous-order', shiprocketShipmentId: null }],
    ['shipment identifier only', { shiprocketOrderId: null, shiprocketShipmentId: 'previous-shipment' }],
  ]) {
    await t.test(name, async () => {
      const shipment = validShipment()
      Object.assign(shipment, identifiers)
      const harness = makeHarness({ shipment })

      const result = await harness.processor.processShipment(5)

      assert.equal(result.outcome, 'RECONCILIATION_REQUIRED')
      assert.equal(harness.providerCalls.length, 0)
      assert.equal(harness.state.shipment.shiprocketOrderId, identifiers.shiprocketOrderId)
      assert.equal(harness.state.shipment.shiprocketShipmentId, identifiers.shiprocketShipmentId)
    })
  }
})

test('duplicate qualifying payments fail eligibility without selecting one for provider submission', async () => {
  const order = validOrder()
  order.payments.push({
    ...order.payments[0],
    id: 13,
    providerPaymentId: 'pay_test_duplicate',
  })
  const harness = makeHarness({ order })

  const result = await harness.processor.processShipment(5)

  assert.equal(result.outcome, 'FAILED')
  assert.match(result.error, /single verified prepaid payment/)
  assert.equal(harness.providerCalls.length, 0)
  assert.equal(harness.state.shipment.status, 'FAILED')
})

test('incomplete provider response enters reconciliation without inventing identifiers', async () => {
  const harness = makeHarness({ response: { order_id: 501 } })

  const result = await harness.processor.processShipment(5)

  assert.deepEqual(result, {
    outcome: 'RECONCILIATION_REQUIRED',
    shipmentId: 5,
    error: 'SHIPROCKET_RESPONSE_INCOMPLETE',
  })
  assert.equal(harness.providerCalls.length, 1)
  assert.equal(harness.state.shipment.status, 'RECONCILIATION_REQUIRED')
  assert.equal(harness.state.shipment.shiprocketOrderId, '501')
  assert.equal(harness.state.shipment.shiprocketShipmentId, null)
  assert.equal(harness.state.shipment.awbCode, undefined)
  assert.equal(harness.state.shipment.courierName, undefined)
  assert.equal(harness.state.shipment.trackingUrl, undefined)
})

test('lease lost after provider response does not overwrite another worker shipment data', async () => {
  const harness = makeHarness({
    beforeOutcomeSave: ({ state, saveCall }) => {
      if (saveCall !== 1) return
      state.shipment.status = 'PROCESSING'
      state.shipment.processingLeaseToken = 'another-worker-lease'
      state.shipment.shiprocketOrderId = 'other-worker-order'
      state.shipment.shiprocketShipmentId = 'other-worker-shipment'
      state.shipment.lastError = 'other worker state'
    },
  })

  const result = await harness.processor.processShipment(5)

  assert.deepEqual(result, { outcome: 'LEASE_LOST', shipmentId: 5 })
  assert.equal(harness.providerCalls.length, 1)
  assert.equal(harness.state.shipment.status, 'PROCESSING')
  assert.equal(harness.state.shipment.processingLeaseToken, 'another-worker-lease')
  assert.equal(harness.state.shipment.shiprocketOrderId, 'other-worker-order')
  assert.equal(harness.state.shipment.shiprocketShipmentId, 'other-worker-shipment')
  assert.equal(harness.state.shipment.lastError, 'other worker state')
})

test('provider response persistence failure enters reconciliation and is not resubmitted', async () => {
  const harness = makeHarness({ failOutcomeSaveCalls: [1] })

  const firstResult = await harness.processor.processShipment(5)
  const secondResult = await harness.processor.processShipment(5)

  assert.deepEqual(firstResult, {
    outcome: 'RECONCILIATION_REQUIRED',
    shipmentId: 5,
    error: 'SHIPMENT_SUCCESS_PERSISTENCE_FAILED',
  })
  assert.equal(harness.state.shipment.status, 'RECONCILIATION_REQUIRED')
  assert.equal(harness.state.shipment.lastError, 'SHIPMENT_SUCCESS_PERSISTENCE_FAILED')
  assert.equal(harness.state.shipment.shiprocketOrderId, '501')
  assert.equal(harness.state.shipment.shiprocketShipmentId, '701')
  assert.equal(secondResult.outcome, 'INELIGIBLE')
  assert.equal(harness.providerCalls.length, 1)
})

test('failed reconciliation persistence propagates a marked error and retains the processing lease', async () => {
  const harness = makeHarness({ failOutcomeSaveCalls: [1, 2] })

  await assert.rejects(
    harness.processor.processShipment(5),
    (error) => (
      error.code === 'SHIPMENT_SUCCESS_PERSISTENCE_FAILED'
      && error.message === 'Provider acceptance requires shipment reconciliation; persistence failed.'
    ),
  )

  assert.equal(harness.state.shipment.status, 'PROCESSING')
  assert.equal(harness.state.shipment.processingLeaseToken, leaseToken)
  assert.equal(harness.state.shipment.shiprocketOrderId, null)
  assert.equal(harness.state.shipment.shiprocketShipmentId, null)
  assert.equal(harness.providerCalls.length, 1)

  const secondResult = await harness.processor.processShipment(5)

  assert.deepEqual(secondResult, { outcome: 'ALREADY_CLAIMED', shipmentId: 5 })
  assert.equal(harness.state.shipment.status, 'PROCESSING')
  assert.equal(harness.state.shipment.processingLeaseToken, leaseToken)
  assert.equal(harness.providerCalls.length, 1)
})

test('provider order creation is called only after a successful claim and validation', async () => {
  const harness = makeHarness()

  await harness.processor.processShipment(5)
  assert.equal(harness.providerCalls.length, 1)

  const secondResult = await harness.processor.processShipment(5)
  assert.equal(secondResult.outcome, 'INELIGIBLE')
  assert.equal(harness.providerCalls.length, 1)
})

test('rejects invalid shipment IDs before database access', async () => {
  const harness = makeHarness()

  await assert.rejects(harness.processor.processShipment(0), {
    name: 'TypeError',
    message: 'A valid shipment ID is required',
  })
  assert.equal(harness.updateManyCalls.length, 0)
  assert.equal(harness.providerCalls.length, 0)
})

test('only marks shipping as billing when address and recipient contact details match', async (t) => {
  for (const [name, updateBilling, expectedShippingContact] of [
    ['different recipient name', (billing) => { billing.name = 'Billing Recipient' }, {
      shipping_customer_name: 'Test',
      shipping_last_name: 'Recipient',
    }],
    ['different recipient phone', (billing) => { billing.phone = '+91 1111111111' }, {
      shipping_phone: '+91 9876543210',
    }],
    ['different recipient email', (billing) => { billing.email = 'billing@example.test' }, {
      shipping_email: 'recipient@example.test',
    }],
    ['matching address and contact details', () => {}, null],
  ]) {
    await t.test(name, async () => {
      const order = validOrder()
      const billing = JSON.parse(order.shippingAddress)
      updateBilling(billing)
      order.billingAddress = JSON.stringify(billing)
      const harness = makeHarness({ order })

      await harness.processor.processShipment(5)

      const payload = harness.providerCalls[0]
      assert.equal(payload.shipping_is_billing, expectedShippingContact === null)
      if (expectedShippingContact) {
        for (const [field, value] of Object.entries(expectedShippingContact)) {
          assert.equal(payload[field], value)
        }
      } else {
        assert.equal(Object.hasOwn(payload, 'shipping_customer_name'), false)
        assert.equal(Object.hasOwn(payload, 'shipping_email'), false)
        assert.equal(Object.hasOwn(payload, 'shipping_phone'), false)
      }
    })
  }
})
