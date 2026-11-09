import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCourierTrackingWebhookHandler } from '../services/courierTrackingWebhook.js'

const webhookToken = 'mock-courier-key'

const createHarness = ({ failPersistence = false, shipments } = {}) => {
  const state = {
    shipments: (shipments || [{
      id: 12,
      orderId: 99,
      awbCode: 'AWB-001',
      awbNormalized: 'AWB-001',
      shiprocketOrderId: 'sr-order-501',
      courierName: null,
      trackingStatus: null,
      trackingStatusId: null,
      trackingStatusAt: null,
      estimatedDeliveryAt: null,
    }]).map((shipment) => structuredClone(shipment)),
    events: [],
  }
  const applyData = (target, data) => Object.assign(target, data)
  const shipmentMatches = (shipment, where) => {
    if (shipment.id !== where.id) return false
    if (where.courierName === null && shipment.courierName !== null) return false
    if (where.OR) {
      return where.OR.some((condition) => {
        if (condition.trackingStatusAt === null) return shipment.trackingStatusAt === null
        return condition.trackingStatusAt?.lt
          && shipment.trackingStatusAt instanceof Date
          && shipment.trackingStatusAt < condition.trackingStatusAt.lt
      })
    }
    return true
  }
  const database = {
    shipment: {
      findMany: async ({ where }) => state.shipments
        .filter((shipment) => shipment.awbNormalized === where.awbNormalized)
        .map((shipment) => structuredClone(shipment)),
      updateMany: async ({ where, data }) => {
        const shipment = state.shipments.find((item) => shipmentMatches(item, where))
        if (!shipment) return { count: 0 }
        applyData(shipment, data)
        return { count: 1 }
      },
    },
    shipmentTrackingEvent: {
      createMany: async ({ data }) => {
        const known = new Set(state.events.map((event) => event.eventHash))
        let count = 0
        for (const event of data) {
          if (known.has(event.eventHash)) continue
          known.add(event.eventHash)
          state.events.push(structuredClone(event))
          count += 1
        }
        return { count }
      },
    },
    $transaction: async (callback) => {
      if (failPersistence) throw new Error('simulated database failure')
      return callback(database)
    },
  }
  const handler = createCourierTrackingWebhookHandler({ prismaClient: database, webhookToken })
  return { handler, state }
}

const payload = (overrides = {}) => ({
  awb: ' awb-001 ',
  courier_name: 'Courier One',
  current_status: 'In Transit',
  current_status_id: 6,
  shipment_status: 'Shipped',
  shipment_status_id: 3,
  current_timestamp: '2026-11-08T10:00:00Z',
  order_id: 99,
  sr_order_id: 'sr-order-501',
  etd: '2026-11-12',
  scans: [{
    date: '2026-11-08T09:30:00Z',
    status: 'In Transit',
    activity: 'Shipment departed facility',
    location: 'Mumbai',
    'sr-status': 6,
    'sr-status-label': 'In Transit',
  }],
  ...overrides,
})

const send = async (handler, body, apiKey = webhookToken) => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(value) {
      this.body = value
      return this
    },
  }
  await handler({
    body,
    headers: apiKey === null ? {} : { 'x-api-key': apiKey },
    get(name) {
      return name.toLowerCase() === 'x-api-key' ? this.headers['x-api-key'] : undefined
    },
  }, response)
  return response
}

test('authenticates and stores valid courier scans matched by normalized AWB', async () => {
  const harness = createHarness()
  const response = await send(harness.handler, payload())

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { received: 1, recorded: 1, duplicates: 0 })
  assert.equal(harness.state.events[0].shipmentId, 12)
  assert.equal(harness.state.events[0].awbNormalized, 'AWB-001')
  assert.equal(harness.state.events[0].location, 'Mumbai')
  assert.equal(harness.state.events[0].occurredAt.toISOString(), '2026-11-08T09:30:00.000Z')
  assert.equal(harness.state.shipments[0].trackingStatus, 'In Transit')
  assert.equal(harness.state.shipments[0].courierName, 'Courier One')
})

test('rejects missing and invalid API keys', async () => {
  const harness = createHarness()
  assert.equal((await send(harness.handler, payload(), null)).statusCode, 401)
  assert.equal((await send(harness.handler, payload(), 'wrong-key')).statusCode, 401)
  assert.equal(harness.state.events.length, 0)
})

test('fails closed when the webhook token is not configured', async () => {
  const harness = createHarness()
  const handler = createCourierTrackingWebhookHandler({
    prismaClient: {
      shipment: { findMany: async () => [] },
      shipmentTrackingEvent: { createMany: async () => ({ count: 0 }) },
      $transaction: async (callback) => callback({
        shipmentTrackingEvent: { createMany: async () => ({ count: 0 }) },
        shipment: { updateMany: async () => ({ count: 0 }) },
      }),
    },
    webhookToken: () => '',
  })
  const response = await send(handler, payload())
  assert.equal(response.statusCode, 503)
})

test('rejects malformed payload and scan fields', async () => {
  const harness = createHarness()
  assert.equal((await send(harness.handler, { ...payload(), awb: 4 })).statusCode, 400)
  assert.equal((await send(harness.handler, payload({ scans: [{ date: 'not-a-date' }] }))).statusCode, 400)
  assert.equal(harness.state.events.length, 0)
})

test('rejects mismatched provider order identities', async () => {
  const harness = createHarness()
  assert.equal((await send(harness.handler, payload({ sr_order_id: 'other-provider-order' }))).statusCode, 409)
  assert.equal((await send(harness.handler, payload({ order_id: 100 }))).statusCode, 409)
  assert.equal(harness.state.events.length, 0)
})

test('deduplicates repeated webhook events by canonical scan identity', async () => {
  const harness = createHarness()
  assert.equal((await send(harness.handler, payload())).body.recorded, 1)
  const repeated = payload({ awb: 'AWB-001' })
  assert.deepEqual((await send(harness.handler, repeated)).body, {
    received: 1,
    recorded: 0,
    duplicates: 1,
  })
  assert.equal(harness.state.events.length, 1)
})

test('preserves multiple scans from one webhook', async () => {
  const harness = createHarness()
  const response = await send(harness.handler, payload({
    scans: [
      { date: '2026-11-08T08:00:00Z', status: 'Picked Up', activity: 'Picked up', location: 'Pune' },
      { date: '2026-11-08T09:30:00Z', status: 'In Transit', activity: 'Departed', location: 'Mumbai' },
    ],
  }))
  assert.equal(response.body.recorded, 2)
  assert.equal(harness.state.events.length, 2)
  assert.equal(harness.state.shipments[0].trackingStatus, 'In Transit')
})

test('does not let out-of-order scans replace a newer shipment status', async () => {
  const harness = createHarness()
  await send(harness.handler, payload())
  await send(harness.handler, payload({
    current_status: 'Picked Up',
    scans: [{
      date: '2026-11-08T08:00:00Z',
      status: 'Picked Up',
      activity: 'Collected',
      location: 'Pune',
    }],
  }))
  assert.equal(harness.state.events.length, 2)
  assert.equal(harness.state.shipments[0].trackingStatus, 'In Transit')
  assert.equal(harness.state.shipments[0].trackingStatusAt.toISOString(), '2026-11-08T09:30:00.000Z')
})

test('stores scans without event timestamps without changing latest status time', async () => {
  const harness = createHarness()
  await send(harness.handler, payload())
  const response = await send(harness.handler, payload({
    scans: [{ status: 'Out for Delivery', activity: 'Courier assigned' }],
  }))
  assert.equal(response.statusCode, 200)
  assert.equal(harness.state.events.length, 2)
  assert.equal(harness.state.events[1].occurredAt, null)
  assert.equal(harness.state.shipments[0].trackingStatus, 'In Transit')
})

test('does not acknowledge persistence failures as successful webhook delivery', async () => {
  const harness = createHarness({ failPersistence: true })
  const response = await send(harness.handler, payload())
  assert.equal(response.statusCode, 503)
  assert.equal(harness.state.events.length, 0)
})

test('rejects ambiguous normalized AWB identities', async () => {
  const duplicate = {
    id: 13,
    orderId: 100,
    awbCode: ' awb-001 ',
    awbNormalized: 'AWB-001',
    shiprocketOrderId: 'sr-order-502',
    courierName: null,
    trackingStatusAt: null,
  }
  const harness = createHarness({ shipments: [...createHarness().state.shipments, duplicate] })
  const response = await send(harness.handler, payload())
  assert.equal(response.statusCode, 409)
  assert.equal(harness.state.events.length, 0)
})
