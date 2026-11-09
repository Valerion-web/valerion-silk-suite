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

const prismaFacade = {
  payment: {
    findFirst: async ({ where } = {}) => {
      const payment = activeState.payment
      return payment && ['id', 'userId', 'storeId'].every((field) => where?.[field] === undefined || payment[field] === where[field]) ? payment : null
    },
    updateMany: async ({ data }) => {
      Object.assign(activeState.payment, data)
      return { count: 1 }
    },
  },
  $transaction: async (callback) => {
    const snapshot = structuredClone(activeState)
    activeState.transactionCalls += 1
    const tx = {
      payment: {
        findFirst: async ({ where } = {}) => {
          const payment = activeState.payment
          return payment && ['id', 'userId', 'storeId'].every((field) => where?.[field] === undefined || payment[field] === where[field]) ? payment : null
        },
        updateMany: async ({ data }) => {
          Object.assign(activeState.payment, data)
          return { count: 1 }
        },
        findUnique: async ({ where } = {}) => (
          where?.userId_storeId_paymentAttemptKey
            ? null
            : activeState.payment
        ),
        update: async ({ data }) => {
          Object.assign(activeState.payment, data)
          return activeState.payment
        },
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
      activeState.ordersFinalized = snapshot.ordersFinalized
      activeState.shipments = snapshot.shipments
      activeState.rolledBackTransactions += 1
      throw error
    }
  },
}

mock.module(new URL('../lib/prisma.js', import.meta.url).href, {
  defaultExport: prismaFacade,
  namedExports: { prisma: prismaFacade },
})
mock.module(new URL('../controllers/customerCommerceController.js', import.meta.url).href, {
  namedExports: {
    assertPaymentCheckoutSnapshotMatchesRequest: async () => {},
    calculateTotals: async () => ({}),
    createPaymentCheckoutSnapshot: () => ({}),
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
    createRazorpayOrder: async () => {},
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
  },
})

const prepare = ({ failQueue = false, queueFailures = 0 } = {}) => {
  activeState = {
    payment: initialPayment(),
    ordersFinalized: 0,
    shipments: [],
    shipmentQueueCalls: [],
    transactionCalls: 0,
    rolledBackTransactions: 0,
  }
  queueFailuresRemaining = failQueue ? Number.POSITIVE_INFINITY : queueFailures
  signatureValid = true
  finalizedOrderCreated = true
  signatureVerificationCalls = 0
}

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
