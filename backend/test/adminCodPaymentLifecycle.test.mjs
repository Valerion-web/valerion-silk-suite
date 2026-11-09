import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  cancelOrderWithCodPayment,
  createAdminCodCollectionHandler,
} from '../services/adminCodPaymentLifecycle.js'

const routesPath = new URL('../routes/adminRoutes.js', import.meta.url)

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

const makeHarness = ({ trackingStatus = 'Delivered', payment = {} } = {}) => {
  const state = {
    order: {
      id: 21,
      storeId: 8,
      currency: 'INR',
      totalPrice: 1250.5,
      shipment: { trackingStatus },
      payments: [{
        id: 34,
        orderId: 21,
        provider: 'COD',
        status: 'PENDING_COLLECTION',
        amount: 1250.5,
        currency: 'INR',
        codCollectedAt: null,
        codCollectedById: null,
        ...payment,
      }],
    },
    updates: 0,
  }
  const database = {
    order: {
      findFirst: async ({ where }) => (
        where.id === state.order.id && where.storeId === state.order.storeId
          ? structuredClone(state.order)
          : null
      ),
    },
    payment: {
      updateMany: async ({ where, data }) => {
        const target = state.order.payments.find((entry) => (
          entry.id === where.id
          && entry.orderId === where.orderId
          && entry.provider === where.provider
          && entry.status === where.status
          && (where.amount === undefined || entry.amount === where.amount)
          && (where.codCollectedAt === undefined || entry.codCollectedAt === where.codCollectedAt)
          && (where.codCollectedById === undefined || entry.codCollectedById === where.codCollectedById)
        ))
        if (!target) return { count: 0 }
        Object.assign(target, data)
        state.updates += 1
        return { count: 1 }
      },
    },
    $transaction: (callback) => callback(database, { isolationLevel: 'Serializable' }),
  }
  const handler = createAdminCodCollectionHandler({
    prismaClient: database,
    storeScope: (req, where = {}) => ({ ...where, storeId: req.store.id }),
    clock: () => new Date('2026-11-09T06:00:00.000Z'),
  })
  return { database, handler, state }
}

const invoke = async (handler, request) => {
  const response = makeResponse()
  let nextError = null
  await handler(request, response, (error) => { nextError = error })
  return { response, nextError }
}

const makeRequest = ({ storeId = 8, adminId = 55, body = {} } = {}) => ({
  params: { id: '21' },
  store: { id: storeId },
  user: adminId ? { id: adminId } : null,
  body: { confirmCashReconciled: true, reconciledAmount: 1250.5, ...body },
})

test('COD collection route requires authenticated admin, orders capability, and concrete-store scope', async () => {
  const source = await readFile(routesPath, 'utf8')
  assert.match(source, /router\.use\(protect,\s*requireAdmin\)/)
  assert.match(
    source,
    /router\.post\('\/orders\/:id\/cod-collection',\s*requireCapability\('orders'\),\s*requireConcreteStore,\s*collectAdminCodPayment\)/,
  )
})

test('confirms reconciled COD cash only for a delivered shipment and records admin audit metadata', async () => {
  const { handler, state } = makeHarness()
  const { response, nextError } = await invoke(handler, makeRequest())

  assert.equal(nextError, null)
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.paymentStatus, 'COD_COLLECTED')
  assert.equal(state.order.payments[0].status, 'COD_COLLECTED')
  assert.equal(state.order.payments[0].codCollectedAt.toISOString(), '2026-11-09T06:00:00.000Z')
  assert.equal(state.order.payments[0].codCollectedById, 55)
  assert.equal(state.updates, 1)
})

test('rejects unauthorized, unconfirmed, mismatched, and undelivered COD collection attempts', async (t) => {
  await t.test('missing admin identity', async () => {
    const { handler, state } = makeHarness()
    const { response } = await invoke(handler, makeRequest({ adminId: null }))
    assert.equal(response.statusCode, 401)
    assert.equal(state.updates, 0)
  })

  await t.test('missing explicit reconciliation confirmation', async () => {
    const { handler, state } = makeHarness()
    const { response } = await invoke(handler, makeRequest({ body: { confirmCashReconciled: false } }))
    assert.equal(response.statusCode, 400)
    assert.equal(state.updates, 0)
  })

  await t.test('reconciled amount differs from outstanding amount', async () => {
    const { handler, state } = makeHarness()
    const { response } = await invoke(handler, makeRequest({ body: { reconciledAmount: 1250 } }))
    assert.equal(response.statusCode, 409)
    assert.equal(state.updates, 0)
  })

  await t.test('shipment is not delivered', async () => {
    const { handler, state } = makeHarness({ trackingStatus: 'In Transit' })
    const { response } = await invoke(handler, makeRequest())
    assert.equal(response.statusCode, 409)
    assert.equal(state.updates, 0)
  })

  await t.test('wrong store scope', async () => {
    const { handler, state } = makeHarness()
    const { response } = await invoke(handler, makeRequest({ storeId: 9 }))
    assert.equal(response.statusCode, 404)
    assert.equal(state.updates, 0)
  })
})

test('rejects COD collection for Razorpay and finalized payments', async (t) => {
  for (const payment of [
    { provider: 'RAZORPAY', status: 'AUTHORIZED' },
    { status: 'COD_COLLECTED', codCollectedAt: new Date(), codCollectedById: 55 },
    { status: 'CANCELLED' },
  ]) {
    await t.test(`${payment.provider ?? 'COD'} ${payment.status}`, async () => {
      const { handler, state } = makeHarness({ payment })
      const before = structuredClone(state.order.payments[0])
      const { response } = await invoke(handler, makeRequest())
      assert.equal(response.statusCode, 409)
      assert.deepEqual(state.order.payments[0], before)
      assert.equal(state.updates, 0)
    })
  }
})

test('duplicate and concurrent collection confirmations cannot both transition the payment', async () => {
  const { handler, state } = makeHarness()
  const [first, concurrent] = await Promise.all([
    invoke(handler, makeRequest()),
    invoke(handler, makeRequest()),
  ])
  assert.deepEqual([first.response.statusCode, concurrent.response.statusCode].sort(), [200, 409])
  assert.equal(state.order.payments[0].status, 'COD_COLLECTED')
  assert.equal(state.updates, 1)

  const replay = await invoke(handler, makeRequest())
  assert.equal(replay.response.statusCode, 409)
  assert.equal(state.updates, 1)
})

test('cancels an uncollected COD payment, order, and history using the same transaction client', async () => {
  const payment = {
    id: 34,
    orderId: 21,
    provider: 'COD',
    status: 'PENDING_COLLECTION',
  }
  const calls = []
  const transaction = {
    payment: {
      updateMany: async (args) => {
        calls.push(['payment.updateMany', args])
        return { count: 1 }
      },
    },
    order: {
      update: async (args) => {
        calls.push(['order.update', args])
        return { id: 21, status: 'CANCELLED' }
      },
    },
    orderStatusHistory: {
      create: async (args) => {
        calls.push(['orderStatusHistory.create', args])
      },
    },
  }
  const order = { id: 21, payments: [payment] }
  const result = await cancelOrderWithCodPayment(transaction, order, {
    note: 'Order cancelled by admin',
    adminId: 55,
  })

  assert.deepEqual(result, { id: 21, status: 'CANCELLED' })
  assert.deepEqual(calls.map(([name]) => name), [
    'payment.updateMany',
    'order.update',
    'orderStatusHistory.create',
  ])
  assert.deepEqual(calls[0][1], {
    where: { id: 34, orderId: 21, provider: 'COD', status: 'PENDING_COLLECTION' },
    data: { status: 'CANCELLED' },
  })
  assert.equal(calls[1][1].data.status, 'CANCELLED')
  assert.deepEqual(calls[2][1].data, {
    orderId: 21,
    status: 'CANCELLED',
    note: 'Order cancelled by admin',
    changedById: 55,
  })
})

test('repeated COD cancellation is a no-op', async () => {
  const payment = {
    id: 34,
    orderId: 21,
    provider: 'COD',
    status: 'CANCELLED',
    codCollectedAt: null,
    codCollectedById: null,
  }
  const calls = []
  const order = { id: 21, status: 'CANCELLED', payments: [payment] }
  const transaction = {
    payment: { updateMany: async (...args) => { calls.push(['payment.updateMany', ...args]) } },
    order: { update: async (...args) => { calls.push(['order.update', ...args]) } },
    orderStatusHistory: { create: async (...args) => { calls.push(['orderStatusHistory.create', ...args]) } },
  }

  const result = await cancelOrderWithCodPayment(transaction, order, {
    note: 'Repeated cancellation',
    adminId: 55,
  })

  assert.equal(result, order)
  assert.deepEqual(payment, {
    id: 34,
    orderId: 21,
    provider: 'COD',
    status: 'CANCELLED',
    codCollectedAt: null,
    codCollectedById: null,
  })
  assert.deepEqual(calls, [])
})

test('rejects cancellation of a refunded COD payment without changing order, payment, or history', async () => {
  const refundedAt = new Date('2026-11-08T12:00:00.000Z')
  const refundedBy = 41
  const payment = {
    id: 34,
    orderId: 21,
    provider: 'COD',
    status: 'REFUNDED',
    updatedAt: refundedAt,
    codCollectedAt: refundedAt,
    codCollectedById: refundedBy,
  }
  const calls = []
  const order = { id: 21, status: 'CANCELLED', payments: [payment] }
  const transaction = {
    payment: { updateMany: async (...args) => { calls.push(['payment.updateMany', ...args]) } },
    order: { update: async (...args) => { calls.push(['order.update', ...args]) } },
    orderStatusHistory: { create: async (...args) => { calls.push(['orderStatusHistory.create', ...args]) } },
  }
  const originalPayment = structuredClone(payment)
  const originalOrder = structuredClone(order)

  await assert.rejects(
    cancelOrderWithCodPayment(transaction, order, {
      note: 'Attempt to cancel refunded order',
      adminId: 55,
    }),
    { statusCode: 409 },
  )

  assert.deepEqual(payment, originalPayment)
  assert.deepEqual(order, originalOrder)
  assert.deepEqual(calls, [])
})

test('rejects cancellation after collection and leaves Razorpay payment rows unchanged', async (t) => {
  await t.test('collected COD', async () => {
    let updates = 0
    await assert.rejects(
      cancelOrderWithCodPayment({
        payment: { updateMany: async () => { updates += 1; return { count: 1 } } },
        order: { update: async () => { updates += 1; return {} } },
        orderStatusHistory: { create: async () => { updates += 1 } },
      }, {
        id: 21,
        payments: [{ id: 34, provider: 'COD', status: 'COD_COLLECTED' }],
      }, { note: 'cancel', adminId: 55 }),
      { statusCode: 409 },
    )
    assert.equal(updates, 0)
  })

  await t.test('Razorpay payment is not mutated', async () => {
    let paymentUpdates = 0
    const calls = []
    await cancelOrderWithCodPayment({
      payment: { updateMany: async () => { paymentUpdates += 1; return { count: 1 } } },
      order: { update: async () => { calls.push('order'); return {} } },
      orderStatusHistory: { create: async () => { calls.push('history') } },
    }, {
      id: 21,
      payments: [{ id: 35, provider: 'RAZORPAY', status: 'AUTHORIZED' }],
    }, { note: 'cancel', adminId: 55 })
    assert.equal(paymentUpdates, 0)
    assert.deepEqual(calls, ['order', 'history'])
  })
})
