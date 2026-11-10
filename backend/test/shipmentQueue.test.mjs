import assert from 'node:assert/strict'
import { test } from 'node:test'
import { queueShipment } from '../services/shipmentQueue.js'

const makeTransactionClient = () => {
  const shipmentsByOrderId = new Map()
  const calls = []
  let nextId = 1

  const transactionClient = {
    shipment: {
      upsert: async (args) => {
        calls.push(args)
        const existing = shipmentsByOrderId.get(args.where.orderId)
        if (existing) {
          Object.assign(existing, args.update)
          return existing
        }

        const created = { id: nextId++, ...args.create }
        shipmentsByOrderId.set(args.create.orderId, created)
        return created
      },
    },
  }

  return { transactionClient, calls, shipmentsByOrderId }
}

test('creates a Shipment for a valid order using the supplied transaction client', async () => {
  const { transactionClient, calls, shipmentsByOrderId } = makeTransactionClient()

  const shipment = await queueShipment(transactionClient, 42)

  assert.deepEqual(shipment, { id: 1, orderId: 42 })
  assert.deepEqual(calls, [{
    where: { orderId: 42 },
    create: { orderId: 42 },
    update: {},
  }])
  assert.equal(shipmentsByOrderId.size, 1)
})

test('uses the unique orderId in the upsert and an empty update for idempotency', async () => {
  const { transactionClient, calls } = makeTransactionClient()

  await queueShipment(transactionClient, 7)

  assert.deepEqual(calls[0], {
    where: { orderId: 7 },
    create: { orderId: 7 },
    update: {},
  })
})

test('repeated queue requests return the same Shipment without creating duplicates', async () => {
  const { transactionClient, calls, shipmentsByOrderId } = makeTransactionClient()

  const first = await queueShipment(transactionClient, 101)
  const second = await queueShipment(transactionClient, 101)

  assert.deepEqual(second, first)
  assert.equal(calls.length, 2)
  assert.equal(shipmentsByOrderId.size, 1)
  assert.equal(shipmentsByOrderId.get(101), first)
})

test('uses the transaction client passed to each queue request', async () => {
  const firstClient = makeTransactionClient()
  const secondClient = makeTransactionClient()

  await queueShipment(firstClient.transactionClient, 1)
  await queueShipment(secondClient.transactionClient, 2)

  assert.equal(firstClient.calls.length, 1)
  assert.equal(secondClient.calls.length, 1)
  assert.deepEqual([...firstClient.shipmentsByOrderId.keys()], [1])
  assert.deepEqual([...secondClient.shipmentsByOrderId.keys()], [2])
})

test('rejects missing transaction clients and invalid order IDs', () => {
  assert.throws(() => queueShipment(null, 1), {
    name: 'TypeError',
    message: 'A transaction client and valid order ID are required',
  })
  assert.throws(() => queueShipment({}, 1), {
    name: 'TypeError',
    message: 'A transaction client and valid order ID are required',
  })

  for (const orderId of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
    assert.throws(() => queueShipment({ shipment: { upsert() {} } }, orderId), {
      name: 'TypeError',
      message: 'A transaction client and valid order ID are required',
    })
  }
})
