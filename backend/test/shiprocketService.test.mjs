import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createShiprocketClient } from '../services/shiprocketService.js'

test('uses the shared Shiprocket client for fulfillment endpoints and expected payloads', async () => {
  const calls = []
  const client = createShiprocketClient({
    env: { SHIPROCKET_EMAIL: 'test@example.test', SHIPROCKET_PASSWORD: 'test-password' },
    fetchImpl: async (url, options) => {
      const requestUrl = String(url)
      calls.push({
        path: new URL(requestUrl).pathname,
        method: options.method,
        body: options.body ? JSON.parse(options.body) : undefined,
      })
      return {
        ok: true,
        status: 200,
        json: async () => (requestUrl.endsWith('/auth/login') ? { token: 'mock-token' } : { ok: true }),
      }
    },
    timeoutSignal: () => undefined,
  })

  await client.assignAwb({ shipmentId: 'shipment-1', courierId: 7 })
  await client.generateLabel('shipment-1')
  await client.requestPickup('shipment-1')
  await client.generateManifest(['shipment-1', 'shipment-2'])
  await client.printManifest(['order-1', 'order-2'])

  assert.deepEqual(calls.map(({ path, method, body }) => ({ path, method, body })), [
    { path: '/v1/external/auth/login', method: 'POST', body: { email: 'test@example.test', password: 'test-password' } },
    { path: '/v1/external/courier/assign/awb', method: 'POST', body: { shipment_id: 'shipment-1', courier_id: 7 } },
    { path: '/v1/external/courier/generate/label', method: 'POST', body: { shipment_id: ['shipment-1'] } },
    { path: '/v1/external/courier/generate/pickup', method: 'POST', body: { shipment_id: ['shipment-1'] } },
    { path: '/v1/external/manifests/generate', method: 'POST', body: { shipment_id: ['shipment-1', 'shipment-2'] } },
    { path: '/v1/external/manifests/print', method: 'POST', body: { order_ids: ['order-1', 'order-2'] } },
  ])
})
