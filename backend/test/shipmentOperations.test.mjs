import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createShipmentOperationsService } from '../services/shipmentOperations.js'

const initialTime = new Date('2026-11-08T12:00:00.000Z')

const createShipment = (overrides = {}) => ({
  id: 5,
  orderId: 99,
  storeId: 2,
  status: 'CREATED',
  shiprocketOrderId: 'order-501',
  shiprocketShipmentId: 'shipment-701',
  awbCode: null,
  courierName: null,
  courierCompanyId: null,
  labelUrl: null,
  labelGeneratedAt: null,
  pickupRequestedAt: null,
  pickupEstimatedAt: null,
  pickupProviderReference: null,
  ...overrides,
})

const createHarness = ({
  shipments = [createShipment()],
  clock = () => new Date(initialTime),
  responses = {},
} = {}) => {
  const state = {
    shipments: new Map(shipments.map((shipment) => [shipment.id, structuredClone(shipment)])),
    operations: new Map(),
    manifests: new Map(),
    manifestItems: new Map(),
  }
  const providerCalls = []
  let operationId = 1
  let manifestId = 1
  let manifestItemId = 1

  const copy = (value) => structuredClone(value)
  const applyData = (target, data) => {
    for (const [key, value] of Object.entries(data)) {
      target[key] = value && typeof value === 'object' && 'increment' in value
        ? (target[key] || 0) + value.increment
        : value
    }
  }
  const matches = (target, where) => Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') return condition.every((part) => matches(target, part))
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('in' in condition && !condition.in.includes(target[key])) return false
      if ('lte' in condition && target[key] > condition.lte) return false
      if ('not' in condition && target[key] === condition.not) return false
      return true
    }
    return target[key] === condition
  })

  const database = {
    shipment: {
      findUnique: async ({ where, include, select }) => {
        const shipment = state.shipments.get(where.id)
        if (!shipment) return null
        if (include?.operations) {
          const filter = include.operations.where || {}
          return {
            ...copy(shipment),
            operations: [...state.operations.values()]
              .filter((operation) => operation.shipmentId === shipment.id && matches(operation, filter))
              .map((operation) => copy(operation)),
          }
        }
        if (select?.operations) {
          return {
            ...copy(shipment),
            operations: [...state.operations.values()]
              .filter((operation) => operation.shipmentId === shipment.id)
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((operation) => copy(operation)),
          }
        }
        return copy(shipment)
      },
      findFirst: async ({ where }) => state.shipments.get(where.id) || null,
      findMany: async ({ where, include }) => [...state.shipments.values()]
        .filter((shipment) => where.id.in.includes(shipment.id) && shipment.storeId === where.order.storeId)
        .map((shipment) => ({
          ...copy(shipment),
          operations: [...state.operations.values()]
            .filter((operation) => operation.shipmentId === shipment.id
              && operation.operationType === include.operations.where.operationType
              && operation.status === include.operations.where.status)
            .map((operation) => copy(operation)),
          manifestItems: [...state.manifestItems.values()]
            .filter((item) => item.shipmentId === shipment.id)
            .map((item) => ({ id: item.id })),
        })),
      updateMany: async ({ where, data }) => {
        const shipment = state.shipments.get(where.id)
        if (!shipment || !matches(shipment, where)) return { count: 0 }
        applyData(shipment, data)
        return { count: 1 }
      },
    },
    shipmentOperation: {
      upsert: async ({ where, create }) => {
        let operation = [...state.operations.values()].find((item) => item.identityKey === where.identityKey)
        if (!operation) {
          operation = {
            id: operationId++,
            ...copy(create),
            status: 'PENDING',
            requestSubmissionStage: 'NOT_SUBMITTED',
            attemptCount: 0,
            nextAttemptAt: new Date(clock()),
            processingStartedAt: null,
            processingLeaseToken: null,
            createdAt: new Date(clock()),
            updatedAt: new Date(clock()),
          }
          state.operations.set(operation.id, operation)
        }
        return copy(operation)
      },
      create: async ({ data }) => {
        const operation = {
          id: operationId++,
          ...copy(data),
          status: 'PENDING',
          requestSubmissionStage: 'NOT_SUBMITTED',
          attemptCount: 0,
          nextAttemptAt: new Date(clock()),
          processingStartedAt: null,
          processingLeaseToken: null,
          createdAt: new Date(clock()),
          updatedAt: new Date(clock()),
        }
        state.operations.set(operation.id, operation)
        return copy(operation)
      },
      findUnique: async ({ where }) => [...state.operations.values()]
        .find((item) => item.id === where.id || item.identityKey === where.identityKey) || null,
      updateMany: async ({ where, data }) => {
        const operation = state.operations.get(where.id)
        if (!operation || !matches(operation, where)) return { count: 0 }
        applyData(operation, data)
        operation.updatedAt = new Date(clock())
        return { count: 1 }
      },
    },
    shipmentManifest: {
      findUnique: async ({ where, include, select }) => {
        const manifest = [...state.manifests.values()]
          .find((item) => item.id === where.id || item.requestKey === where.requestKey)
        if (!manifest) return null
        const result = copy(manifest)
        if (include?.operations || select?.operations) {
          result.operations = [...state.operations.values()]
            .filter((operation) => operation.manifestId === manifest.id)
            .map((operation) => copy(operation))
        }
        if (include?.items || select?.items) {
          result.items = [...state.manifestItems.values()]
            .filter((item) => item.manifestId === manifest.id)
            .sort((a, b) => a.id - b.id)
            .map((item) => copy(item))
        }
        return result
      },
      create: async ({ data }) => {
        const manifest = {
          id: manifestId++,
          ...copy(data),
          status: 'PENDING',
          printUrl: null,
          printedAt: null,
          requestSubmissionStage: 'NOT_SUBMITTED',
          attemptCount: 0,
          nextAttemptAt: new Date(clock()),
          processingStartedAt: null,
          processingLeaseToken: null,
          createdAt: new Date(clock()),
          updatedAt: new Date(clock()),
        }
        state.manifests.set(manifest.id, manifest)
        for (const item of data.items.create) {
          state.manifestItems.set(manifestItemId, {
            id: manifestItemId++,
            manifestId: manifest.id,
            ...copy(item),
          })
        }
        return copy(manifest)
      },
      findFirst: async () => null,
      updateMany: async ({ where, data }) => {
        const manifest = state.manifests.get(where.id)
        if (!manifest || !matches(manifest, where)) return { count: 0 }
        applyData(manifest, data)
        manifest.updatedAt = new Date(clock())
        return { count: 1 }
      },
    },
    shipmentManifestItem: {
      findMany: async ({ where }) => [...state.manifestItems.values()]
        .filter((item) => item.manifestId === where.manifestId)
        .sort((a, b) => a.id - b.id)
        .map((item) => copy(item)),
    },
    $transaction: async (callback) => callback(database),
  }

  const getResponse = async (name, args) => {
    providerCalls.push([name, copy(args)])
    const response = responses[name]
    if (response instanceof Error) throw response
    if (typeof response === 'function') return response(...args)
    return response
  }
  const client = {
    assignAwb: (input) => getResponse('assignAwb', [input]),
    generateLabel: (shipmentId) => getResponse('generateLabel', [shipmentId]),
    requestPickup: (shipmentId) => getResponse('requestPickup', [shipmentId]),
    generateManifest: (shipmentIds) => getResponse('generateManifest', [shipmentIds]),
    printManifest: (orderIds) => getResponse('printManifest', [orderIds]),
  }
  const service = createShipmentOperationsService({
    prismaClient: database,
    shiprocketClient: client,
    clock,
    createLeaseToken: () => `lease-${operationId}-${providerCalls.length}`,
  })

  return { service, state, providerCalls }
}

test('assigns AWB and records courier information', async () => {
  const harness = createHarness({
    responses: { assignAwb: { awb_code: 'AWB-1', courier_company_id: 7, courier_name: 'Courier One' } },
  })
  const result = await harness.service.assignAwb(5, 7)
  assert.equal(result.outcome, 'SUCCEEDED')
  assert.equal(harness.state.shipments.get(5).awbCode, 'AWB-1')
  assert.equal(harness.state.shipments.get(5).courierCompanyId, '7')
  assert.deepEqual(harness.providerCalls, [['assignAwb', [{ shipmentId: 'shipment-701', courierId: 7 }]]])
})

test('does not assign a duplicate AWB', async () => {
  const harness = createHarness({
    responses: { assignAwb: { awb_code: 'AWB-1' } },
  })
  assert.equal((await harness.service.assignAwb(5)).outcome, 'SUCCEEDED')
  assert.equal((await harness.service.assignAwb(5)).outcome, 'AWB_ALREADY_ASSIGNED')
  assert.equal(harness.providerCalls.length, 1)
})

test('rejects label generation until an AWB exists', async () => {
  const harness = createHarness()
  assert.equal((await harness.service.generateLabel(5)).outcome, 'AWB_REQUIRED')
  assert.equal(harness.providerCalls.length, 0)
})

test('generates and stores a protected label URL only once', async () => {
  const harness = createHarness({
    shipments: [createShipment({ awbCode: 'AWB-1' })],
    responses: { generateLabel: { label_url: 'https://docs.example.test/label.pdf' } },
  })
  const result = await harness.service.generateLabel(5)
  assert.equal(result.outcome, 'SUCCEEDED')
  assert.equal(harness.state.shipments.get(5).labelUrl, 'https://docs.example.test/label.pdf')
  assert.equal((await harness.service.generateLabel(5)).outcome, 'ALREADY_SUCCEEDED')
  assert.equal(harness.providerCalls.length, 1)
})

test('rejects pickup requests until an AWB exists', async () => {
  const harness = createHarness()
  assert.equal((await harness.service.requestPickup(5)).outcome, 'AWB_REQUIRED')
  assert.equal(harness.providerCalls.length, 0)
})

test('does not retry a pickup whose submission outcome is uncertain', async () => {
  const harness = createHarness({
    shipments: [createShipment({ awbCode: 'AWB-1' })],
    responses: {
      requestPickup: Object.assign(new Error('network timeout'), { code: 'SHIPROCKET_REQUEST_UNAVAILABLE' }),
    },
  })
  assert.equal((await harness.service.requestPickup(5)).outcome, 'RECONCILIATION_REQUIRED')
  assert.equal((await harness.service.requestPickup(5)).outcome, 'RECONCILIATION_REQUIRED')
  assert.equal(harness.providerCalls.length, 1)
})

test('schedules safe pre-submission retry after auth failure', async () => {
  let currentTime = new Date(initialTime)
  let attempts = 0
  const harness = createHarness({
    shipments: [createShipment({ awbCode: 'AWB-1' })],
    clock: () => new Date(currentTime),
    responses: {
      requestPickup: () => {
        attempts += 1
        if (attempts === 1) {
          throw Object.assign(new Error('auth unavailable'), { code: 'SHIPROCKET_AUTH_UNAVAILABLE' })
        }
        return { pickup_status: 1, response: [{ pickup_id: 'pickup-1' }] }
      },
    },
  })
  assert.equal((await harness.service.requestPickup(5)).outcome, 'RETRY_SCHEDULED')
  currentTime = new Date(currentTime.getTime() + 60_001)
  assert.equal((await harness.service.requestPickup(5)).outcome, 'SUCCEEDED')
  assert.equal(harness.state.shipments.get(5).pickupProviderReference, 'pickup-1')
  assert.equal(harness.providerCalls.length, 2)
})

test('requires a successful pickup before manifest generation', async () => {
  const harness = createHarness()
  assert.equal((await harness.service.createManifest([5], 2)).outcome, 'PICKUP_REQUIRED')
  assert.equal(harness.providerCalls.length, 0)
})

test('generates and prints a manifest using Shiprocket order IDs without duplicate submissions', async () => {
  const harness = createHarness({
    shipments: [createShipment({ awbCode: 'AWB-1' })],
    responses: {
      generateManifest: { manifest_id: 'manifest-4', manifest_url: 'https://docs.example.test/manifest.pdf' },
      printManifest: { print_url: 'https://docs.example.test/manifest-print.pdf' },
    },
  })
  harness.state.operations.set(10, {
    id: 10,
    identityKey: 'shipment:5:REQUEST_PICKUP',
    shipmentId: 5,
    operationType: 'REQUEST_PICKUP',
    status: 'SUCCEEDED',
    requestSubmissionStage: 'PROVIDER_ACCEPTED',
    attemptCount: 1,
    nextAttemptAt: new Date(initialTime),
    processingStartedAt: null,
    processingLeaseToken: null,
    createdAt: new Date(initialTime),
    updatedAt: new Date(initialTime),
  })

  const generated = await harness.service.createManifest([5], 2)
  assert.equal(generated.outcome, 'SUCCEEDED')
  assert.equal(generated.manifestUrl, 'https://docs.example.test/manifest.pdf')
  const manifest = [...harness.state.manifests.values()][0]
  assert.equal(manifest.status, 'GENERATED')
  const printed = await harness.service.printManifest(manifest.id)
  assert.equal(printed.outcome, 'SUCCEEDED', JSON.stringify({
    operation: printed.operation,
    manifest,
    operations: [...harness.state.operations.values()],
  }))
  assert.deepEqual(harness.providerCalls, [
    ['generateManifest', [['shipment-701']]],
    ['printManifest', [['order-501']]],
  ])
  assert.equal((await harness.service.createManifest([5], 2)).outcome, 'ALREADY_SUCCEEDED')
  assert.equal((await harness.service.printManifest(manifest.id)).outcome, 'ALREADY_SUCCEEDED')
  assert.equal(harness.providerCalls.length, 2)
})

test('allows a shipment to appear in manifests with different memberships', async () => {
  const harness = createHarness({
    shipments: [
      createShipment({ id: 5, awbCode: 'AWB-1' }),
      createShipment({ id: 6, awbCode: 'AWB-2', shiprocketOrderId: 'order-502', shiprocketShipmentId: 'shipment-702' }),
      createShipment({ id: 7, awbCode: 'AWB-3', shiprocketOrderId: 'order-503', shiprocketShipmentId: 'shipment-703' }),
    ],
    responses: {
      generateManifest: { manifest_id: 'provider-manifest', manifest_url: 'https://docs.example.test/manifest.pdf' },
    },
  })
  for (const shipmentId of [5, 6, 7]) {
    harness.state.operations.set(shipmentId + 10, {
      id: shipmentId + 10,
      identityKey: `shipment:${shipmentId}:REQUEST_PICKUP`,
      shipmentId,
      operationType: 'REQUEST_PICKUP',
      status: 'SUCCEEDED',
      requestSubmissionStage: 'PROVIDER_ACCEPTED',
      attemptCount: 1,
      nextAttemptAt: new Date(initialTime),
      processingStartedAt: null,
      processingLeaseToken: null,
      createdAt: new Date(initialTime),
      updatedAt: new Date(initialTime),
    })
  }

  assert.equal((await harness.service.createManifest([5, 6], 2)).outcome, 'SUCCEEDED')
  assert.equal((await harness.service.createManifest([5, 7], 2)).outcome, 'SUCCEEDED')
  assert.deepEqual(
    [...harness.state.manifestItems.values()]
      .filter((item) => item.shipmentId === 5)
      .map((item) => item.manifestId),
    [1, 2],
  )
  assert.equal(harness.providerCalls.filter(([name]) => name === 'generateManifest').length, 2)
})

test('rejects duplicate shipment membership in one manifest request', async () => {
  const harness = createHarness()
  assert.equal((await harness.service.createManifest([5, 5], 2)).outcome, 'INVALID_REQUEST')
  assert.equal(harness.providerCalls.length, 0)
})

test('prevents concurrent AWB assignment submissions with an operation lease', async () => {
  let releaseRequest
  const requestStarted = new Promise((resolve) => {
    releaseRequest = resolve
  })
  let finishRequest
  const blockedRequest = new Promise((resolve) => {
    finishRequest = resolve
  })
  const harness = createHarness({
    responses: {
      assignAwb: async () => {
        releaseRequest()
        await blockedRequest
        return { awb_code: 'AWB-1' }
      },
    },
  })
  const first = harness.service.assignAwb(5)
  await requestStarted
  assert.equal((await harness.service.assignAwb(5)).outcome, 'PROCESSING')
  finishRequest()
  assert.equal((await first).outcome, 'SUCCEEDED')
  assert.equal(harness.providerCalls.length, 1)
})

test('marks incomplete provider responses as requiring reconciliation and blocks retries', async () => {
  const harness = createHarness({ responses: { assignAwb: { status: 'accepted' } } })
  assert.equal((await harness.service.assignAwb(5)).outcome, 'RECONCILIATION_REQUIRED')
  assert.equal((await harness.service.assignAwb(5)).outcome, 'RECONCILIATION_REQUIRED')
  assert.equal(harness.providerCalls.length, 1)
})
