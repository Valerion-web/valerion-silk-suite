import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createOrderTrackingHandler } from '../services/customerOrderTracking.js'

const createResponse = () => ({
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

test('returns customer tracking only for the authenticated customer order and omits private shipment fields', async () => {
  let query
  const handler = createOrderTrackingHandler({
    prismaClient: {
      order: {
        findFirst: async (args) => {
          query = args
          return {
            id: 21,
            status: 'SHIPPED',
            createdAt: new Date('2026-11-07T10:00:00Z'),
            currency: 'INR',
            statusHistory: [{ id: 1, status: 'SHIPPED', createdAt: new Date('2026-11-08T10:00:00Z') }],
            shipment: {
              awbCode: 'AWB-21',
              courierName: 'Courier',
              trackingStatus: 'In Transit',
              trackingStatusAt: new Date('2026-11-08T09:00:00Z'),
              estimatedDeliveryAt: new Date('2026-11-10T00:00:00Z'),
              labelUrl: 'https://private.example.test/label.pdf',
              trackingUrl: 'https://private.example.test/tracking',
              operations: [{ lastErrorMessage: 'private operation error' }],
              trackingEvents: [{
                id: 5,
                status: 'In Transit',
                activity: 'Departed hub',
                location: 'Mumbai',
                occurredAt: new Date('2026-11-08T09:00:00Z'),
                providerOrderId: 'private-provider-id',
              }],
            },
          }
        },
      },
    },
  })
  const response = createResponse()
  await handler({
    params: { id: '21' },
    user: { id: 7 },
    store: { id: 3 },
  }, response, (error) => {
    throw error
  })

  assert.deepEqual(query.where, { id: 21, userId: 7, storeId: 3 })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.shipment, {
    awbCode: 'AWB-21',
    courierName: 'Courier',
    currentStatus: 'In Transit',
    currentStatusAt: new Date('2026-11-08T09:00:00Z'),
    estimatedDeliveryAt: new Date('2026-11-10T00:00:00Z'),
    events: [{
      id: 5,
      status: 'In Transit',
      activity: 'Departed hub',
      location: 'Mumbai',
      occurredAt: new Date('2026-11-08T09:00:00Z'),
    }],
  })
  assert.equal(JSON.stringify(response.body).includes('private.example.test'), false)
  assert.equal(JSON.stringify(response.body).includes('private operation error'), false)
  assert.equal(JSON.stringify(response.body).includes('private-provider-id'), false)
})

test('returns 404 for orders outside the authenticated customer scope', async () => {
  const handler = createOrderTrackingHandler({
    prismaClient: { order: { findFirst: async () => null } },
  })
  const response = createResponse()
  await handler({ params: { id: '21' }, user: { id: 7 }, store: { id: 3 } }, response, () => {})
  assert.equal(response.statusCode, 404)
  assert.deepEqual(response.body, { message: 'Order not found' })
})

test('rejects invalid customer tracking order identifiers', async () => {
  let queried = false
  const handler = createOrderTrackingHandler({
    prismaClient: { order: { findFirst: async () => { queried = true } } },
  })
  const response = createResponse()
  await handler({ params: { id: '0' }, user: { id: 7 }, store: { id: 3 } }, response, () => {})
  assert.equal(response.statusCode, 400)
  assert.equal(queried, false)
})
