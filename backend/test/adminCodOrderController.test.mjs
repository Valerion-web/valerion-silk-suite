import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

let activeState
let failConditionalPaymentUpdate = false

const prismaFacade = {
  order: { findFirst: async () => null },
  $transaction: async (callback) => {
    const snapshot = structuredClone(activeState)
    try {
      return await callback(makeTransactionClient())
    } catch (error) {
      activeState = snapshot
      throw error
    }
  },
}

const makeTransactionClient = () => ({
  order: {
    findFirst: async ({ where }) => (
      where.id === activeState.order.id && where.storeId === activeState.order.storeId
        ? structuredClone(activeState.order)
        : null
    ),
    update: async ({ where, data }) => {
      assert.equal(where.id, activeState.order.id)
      Object.assign(activeState.order, data)
      return { ...structuredClone(activeState.order), items: [], totalPrice: activeState.order.totalPrice }
    },
  },
  payment: {
    updateMany: async ({ where, data }) => {
      if (failConditionalPaymentUpdate) return { count: 0 }
      const payment = activeState.order.payments.find((entry) => (
        entry.id === where.id
        && entry.orderId === where.orderId
        && entry.provider === where.provider
        && entry.status === where.status
      ))
      if (!payment) return { count: 0 }
      Object.assign(payment, data)
      return { count: 1 }
    },
  },
  orderStatusHistory: {
    create: async ({ data }) => {
      activeState.history.push(data)
      return data
    },
  },
})

mock.module(new URL('../lib/prisma.js', import.meta.url).href, {
  defaultExport: prismaFacade,
  namedExports: { prisma: prismaFacade },
})
mock.module(new URL('../middleware/storeMiddleware.js', import.meta.url).href, {
  namedExports: {
    storeWhere: (req, where = {}) => ({ ...where, storeId: req.store.id }),
  },
})
mock.module(new URL('../services/orderDeletion.js', import.meta.url).href, {
  namedExports: { deleteOrderIfUnshipped: async () => false },
})
mock.module(new URL('../services/shipmentPackageMeasurements.js', import.meta.url).href, {
  namedExports: { validateShipmentPackageMeasurements: (value) => value },
})
mock.module(new URL('../services/shipmentOperations.js', import.meta.url).href, {
  namedExports: { createShipmentOperationsService: () => ({}) },
})
mock.module(new URL('../services/adminShipmentManagement.js', import.meta.url).href, {
  namedExports: { createAdminShipmentOperationsHandler: () => async () => {} },
})

const { updateAdminOrderStatus } = await import('../controllers/adminController.js')

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

const makeOrder = (payment) => ({
  id: 21,
  storeId: 8,
  status: 'PLACED',
  totalPrice: 1250.5,
  items: [],
  payments: payment ? [payment] : [],
})

const invoke = async () => {
  const response = makeResponse()
  let nextError = null
  await updateAdminOrderStatus({
    params: { id: '21' },
    body: { status: 'CANCELLED', note: 'Admin cancellation' },
    store: { id: 8 },
    user: { id: 55 },
  }, response, (error) => { nextError = error })
  return { response, nextError }
}

test('cancels the COD payment and order with status history in one transaction', async () => {
  failConditionalPaymentUpdate = false
  activeState = {
    order: makeOrder({
      id: 34,
      orderId: 21,
      provider: 'COD',
      status: 'PENDING_COLLECTION',
    }),
    history: [],
  }

  const { response, nextError } = await invoke()

  assert.equal(nextError, null)
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.status, 'CANCELLED')
  assert.equal(activeState.order.payments[0].status, 'CANCELLED')
  assert.deepEqual(activeState.history, [{
    orderId: 21,
    status: 'CANCELLED',
    note: 'Admin cancellation',
    changedById: 55,
  }])
})

test('repeated COD cancellation does not update the order or add history', async () => {
  const existingHistory = [{
    orderId: 21,
    status: 'CANCELLED',
    note: 'Original cancellation',
    changedById: 55,
  }]
  const cancelledPayment = {
    id: 34,
    orderId: 21,
    provider: 'COD',
    status: 'CANCELLED',
    codCollectedAt: null,
    codCollectedById: null,
  }
  activeState = {
    order: { ...makeOrder(cancelledPayment), status: 'CANCELLED' },
    history: existingHistory,
  }
  const originalPayment = structuredClone(activeState.order.payments[0])

  const { response, nextError } = await invoke()

  assert.equal(nextError, null)
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.status, 'CANCELLED')
  assert.equal(activeState.order.status, 'CANCELLED')
  assert.deepEqual(activeState.order.payments[0], originalPayment)
  assert.deepEqual(activeState.history, existingHistory)
})

test('rejects cancellation after COD collection and rolls back order and history changes', async () => {
  activeState = {
    order: makeOrder({
      id: 34,
      orderId: 21,
      provider: 'COD',
      status: 'COD_COLLECTED',
      codCollectedAt: new Date(),
      codCollectedById: 55,
    }),
    history: [],
  }

  const { response, nextError } = await invoke()

  assert.equal(nextError, null)
  assert.equal(response.statusCode, 409)
  assert.match(response.body.message, /cannot be cancelled without a refund process/)
  assert.equal(activeState.order.status, 'PLACED')
  assert.equal(activeState.order.payments[0].status, 'COD_COLLECTED')
  assert.deepEqual(activeState.history, [])
})

test('conditional payment cancellation prevents order changes after a concurrent transition', async () => {
  failConditionalPaymentUpdate = true
  activeState = {
    order: makeOrder({
      id: 34,
      orderId: 21,
      provider: 'COD',
      status: 'PENDING_COLLECTION',
    }),
    history: [],
  }

  const { response, nextError } = await invoke()

  assert.equal(nextError, null)
  assert.equal(response.statusCode, 409)
  assert.equal(activeState.order.status, 'PLACED')
  assert.equal(activeState.order.payments[0].status, 'PENDING_COLLECTION')
  assert.deepEqual(activeState.history, [])
  failConditionalPaymentUpdate = false
})

test('preserves Razorpay payment state when cancelling a non-COD order', async () => {
  activeState = {
    order: makeOrder({
      id: 35,
      orderId: 21,
      provider: 'RAZORPAY',
      status: 'AUTHORIZED',
    }),
    history: [],
  }

  const { response, nextError } = await invoke()

  assert.equal(nextError, null)
  assert.equal(response.statusCode, 200)
  assert.equal(activeState.order.status, 'CANCELLED')
  assert.equal(activeState.order.payments[0].status, 'AUTHORIZED')
  assert.equal(activeState.history.length, 1)
})
