import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deleteOrderIfUnshipped } from '../services/orderDeletion.js'
import { validateShipmentPackageMeasurements } from '../services/shipmentPackageMeasurements.js'

test('rejects invalid package measurements before confirmation can be persisted', () => {
  assert.throws(() => validateShipmentPackageMeasurements({
    packageWeightKg: '0',
    packageLengthCm: '10',
    packageBreadthCm: '8',
    packageHeightCm: '3',
  }), /must be greater than zero/)

  assert.throws(() => validateShipmentPackageMeasurements({
    packageWeightKg: '1',
    packageLengthCm: '0.5',
    packageBreadthCm: '8',
    packageHeightCm: '3',
  }), /must be greater than 0.5 cm/)
})

test('does not delete order items or the order when a shipment exists', async () => {
  const calls = []
  const transactionClient = {
    shipment: {
      findUnique: async (args) => {
        calls.push(['shipment.findUnique', args])
        return { id: 55 }
      },
    },
    orderItem: {
      deleteMany: async (args) => calls.push(['orderItem.deleteMany', args]),
    },
    order: {
      delete: async (args) => calls.push(['order.delete', args]),
    },
  }

  const deleted = await deleteOrderIfUnshipped(transactionClient, 44)

  assert.equal(deleted, false)
  assert.deepEqual(calls, [[
    'shipment.findUnique',
    { where: { orderId: 44 }, select: { id: true } },
  ]])
})

test('deletes order items and order together when no shipment exists', async () => {
  const calls = []
  const transactionClient = {
    shipment: { findUnique: async () => null },
    orderItem: {
      deleteMany: async (args) => calls.push(['orderItem.deleteMany', args]),
    },
    order: {
      delete: async (args) => calls.push(['order.delete', args]),
    },
  }

  const deleted = await deleteOrderIfUnshipped(transactionClient, 44)

  assert.equal(deleted, true)
  assert.deepEqual(calls, [
    ['orderItem.deleteMany', { where: { orderId: 44 } }],
    ['order.delete', { where: { id: 44 } }],
  ])
})
