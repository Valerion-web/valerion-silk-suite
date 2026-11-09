import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createCourierTrackingWebhookHandler } from '../services/courierTrackingWebhook.js'
import { queueShipment } from '../services/shipmentQueue.js'

const expectedDatabase = 'haston_shiprocket_feature_test'
const expectedUser = 'haston_shiprocket_test_runner'
const expectedPostgresVersion = '14.24'
const expectedPostgresPort = '55433'
const fixturePrefix = `pg-integration-${randomUUID()}`

const fixtureIds = {
  tenant: [],
  store: [],
  user: [],
  order: [],
  payment: [],
  shipment: [],
  operation: [],
  manifest: [],
}

let prisma
let testStoreId
let testUserId

const ensureLoopbackDatabaseUrl = (connectionString) => {
  let url
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL connection URL')
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '::1'].includes(hostname)
    || url.port !== expectedPostgresPort
  ) {
    throw new Error('TEST_DATABASE_URL must target the configured loopback PostgreSQL endpoint')
  }
}

const createOrderAndShipment = async () => {
  let order
  let shipment

  await prisma.$transaction(async (transaction) => {
    order = await transaction.order.create({
      data: {
        userId: testUserId,
        storeId: testStoreId,
        totalPrice: 1,
      },
    })
    fixtureIds.order.push(order.id)

    shipment = await queueShipment(transaction, order.id)
    fixtureIds.shipment.push(shipment.id)
  })

  return { order, shipment }
}

const createManifest = (suffix) => prisma.shipmentManifest.create({
  data: { requestKey: `${fixturePrefix}-manifest-${suffix}` },
}).then((manifest) => {
  fixtureIds.manifest.push(manifest.id)
  return manifest
})

const sendWebhook = async (handler, body) => {
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
    headers: { 'x-api-key': `${fixturePrefix}-webhook-token` },
    get(name) {
      return name.toLowerCase() === 'x-api-key'
        ? this.headers['x-api-key']
        : undefined
    },
  }, response)
  return response
}

before(async () => {
  const connectionString = process.env.TEST_DATABASE_URL
  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL is required; DATABASE_URL is not used')
  }
  ensureLoopbackDatabaseUrl(connectionString)

  prisma = new PrismaClient({
    adapter: new PrismaPg(connectionString),
  })

  let identity
  try {
    await prisma.$connect()
    const identities = await prisma.$queryRaw`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        current_setting('server_version') AS server_version
    `
    identity = identities[0]
  } catch {
    await prisma.$disconnect()
    throw new Error('Could not verify the PostgreSQL test database identity')
  }

  assert.equal(identity.database_name, expectedDatabase, 'Unexpected test database')
  assert.equal(identity.database_user, expectedUser, 'Unexpected test database user')
  assert.equal(
    identity.server_version.split(' ')[0],
    expectedPostgresVersion,
    'Unexpected PostgreSQL version'
  )

  const tenant = await prisma.tenant.create({
    data: {
      name: `${fixturePrefix} tenant`,
      slug: `${fixturePrefix}-tenant`,
      stores: {
        create: {
          name: `${fixturePrefix} store`,
          slug: `${fixturePrefix}-store`,
          users: {
            create: {
              email: `${fixturePrefix}@integration.invalid`,
              name: `${fixturePrefix} user`,
              password: 'integration-fixture-not-a-login',
            },
          },
        },
      },
    },
    include: { stores: { include: { users: true } } },
  })

  const store = tenant.stores[0]
  const user = store.users[0]
  fixtureIds.tenant.push(tenant.id)
  fixtureIds.store.push(store.id)
  fixtureIds.user.push(user.id)
  testStoreId = store.id
  testUserId = user.id
})

after(async () => {
  if (!prisma) return

  const hasFixtures = Object.values(fixtureIds).some((ids) => ids.length > 0)
  try {
    if (hasFixtures) {
      await prisma.$transaction(async (transaction) => {
        if (fixtureIds.operation.length) {
          await transaction.shipmentOperation.deleteMany({
            where: { id: { in: fixtureIds.operation } },
          })
        }
        if (fixtureIds.manifest.length) {
          await transaction.shipmentManifestItem.deleteMany({
            where: { manifestId: { in: fixtureIds.manifest } },
          })
        }
        if (fixtureIds.shipment.length) {
          await transaction.shipmentTrackingEvent.deleteMany({
            where: { shipmentId: { in: fixtureIds.shipment } },
          })
          await transaction.shipmentManifestItem.deleteMany({
            where: { shipmentId: { in: fixtureIds.shipment } },
          })
        }
        if (fixtureIds.manifest.length) {
          await transaction.shipmentManifest.deleteMany({
            where: { id: { in: fixtureIds.manifest } },
          })
        }
        if (fixtureIds.shipment.length) {
          await transaction.shipment.deleteMany({
            where: { id: { in: fixtureIds.shipment } },
          })
        }
        if (fixtureIds.payment.length) {
          await transaction.payment.deleteMany({
            where: { id: { in: fixtureIds.payment } },
          })
        }
        if (fixtureIds.order.length) {
          await transaction.orderStatusHistory.deleteMany({
            where: { orderId: { in: fixtureIds.order } },
          })
        }
        if (fixtureIds.order.length) {
          await transaction.order.deleteMany({
            where: { id: { in: fixtureIds.order } },
          })
        }
        if (fixtureIds.user.length) {
          await transaction.user.deleteMany({
            where: { id: { in: fixtureIds.user } },
          })
        }
        if (fixtureIds.store.length) {
          await transaction.store.deleteMany({
            where: { id: { in: fixtureIds.store } },
          })
        }
        if (fixtureIds.tenant.length) {
          await transaction.tenant.deleteMany({
            where: { id: { in: fixtureIds.tenant } },
          })
        }
      })
    }
  } catch {
    throw new Error(`Fixture cleanup failed; exact fixture identifiers: ${JSON.stringify(fixtureIds)}`)
  } finally {
    await prisma.$disconnect()
  }
})

test('creates an Order and queues one Shipment idempotently in a transaction', async () => {
  const { order, shipment } = await createOrderAndShipment()
  const repeatedShipment = await prisma.$transaction((transaction) => (
    queueShipment(transaction, order.id)
  ))

  assert.equal(shipment.orderId, order.id)
  assert.equal(repeatedShipment.id, shipment.id)
  assert.equal(
    await prisma.shipment.count({ where: { orderId: order.id } }),
    1,
  )
})

test('enforces the Phase 2 COD payment state and rejects Razorpay references', async () => {
  const { order } = await createOrderAndShipment()
  const makePayment = (status, suffix, extra = {}) => ({
    userId: testUserId,
    storeId: testStoreId,
    orderId: order.id,
    provider: 'COD',
    status,
    amount: 1,
    currency: 'INR',
    idempotencyKey: `${fixturePrefix}-${suffix}`,
    paymentAttemptKey: `${fixturePrefix}-${suffix}`,
    ...extra,
  })

  const payment = await prisma.payment.create({
    data: makePayment('PENDING_COLLECTION', 'phase2-valid'),
  })
  fixtureIds.payment.push(payment.id)

  for (const status of ['CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'CANCELLED']) {
    await assert.rejects(prisma.payment.create({
      data: makePayment(status, `phase2-invalid-${status}`),
    }))
  }

  for (const [field, value] of [
    ['providerOrderId', `${fixturePrefix}-phase2-razorpay-order`],
    ['providerPaymentId', `${fixturePrefix}-phase2-razorpay-payment`],
  ]) {
    await assert.rejects(prisma.payment.create({
      data: makePayment('PENDING_COLLECTION', `phase2-invalid-${field}`, { [field]: value }),
    }))
  }
})

test('persists valid package confirmation and rejects invalid or incomplete package data', async () => {
  const { shipment } = await createOrderAndShipment()
  const confirmedAt = new Date()
  const confirmed = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      packageWeightKg: '1.234',
      packageLengthCm: '10.25',
      packageBreadthCm: '8.50',
      packageHeightCm: '3.00',
      packageConfirmedAt: confirmedAt,
      packageConfirmedById: testUserId,
    },
  })

  assert.equal(confirmed.packageWeightKg.toString(), '1.234')
  assert.equal(confirmed.packageConfirmedAt.getTime(), confirmedAt.getTime())
  assert.equal(confirmed.packageConfirmedById, testUserId)

  const invalidFixture = await createOrderAndShipment()
  await assert.rejects(prisma.shipment.update({
    where: { id: invalidFixture.shipment.id },
    data: { packageWeightKg: '-1' },
  }))

  const incompleteFixture = await createOrderAndShipment()
  await assert.rejects(prisma.shipment.update({
    where: { id: incompleteFixture.shipment.id },
    data: { packageConfirmedAt: new Date(), packageConfirmedById: testUserId },
  }))

  const unchanged = await prisma.shipment.findUnique({
    where: { id: incompleteFixture.shipment.id },
  })
  assert.equal(unchanged.packageConfirmedAt, null)
  assert.equal(unchanged.packageConfirmedById, null)
})

test('database trigger prevents package changes and provider identifier clearing after processing', async () => {
  const { shipment } = await createOrderAndShipment()
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      packageWeightKg: '1.234',
      packageLengthCm: '10.25',
      packageBreadthCm: '8.50',
      packageHeightCm: '3.00',
      packageConfirmedAt: new Date(),
      packageConfirmedById: testUserId,
    },
  })
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      attemptCount: 1,
      status: 'PROCESSING',
      shiprocketOrderId: `${fixturePrefix}-provider-order`,
      shiprocketShipmentId: `${fixturePrefix}-provider-shipment`,
    },
  })

  await assert.rejects(prisma.shipment.update({
    where: { id: shipment.id },
    data: { packageWeightKg: '2.345' },
  }))
  await assert.rejects(prisma.shipment.update({
    where: { id: shipment.id },
    data: { shiprocketOrderId: null },
  }))
})

test('persists operation uniqueness, lease ownership, and state transitions', async () => {
  const [first, second, third] = await Promise.all([
    createOrderAndShipment(),
    createOrderAndShipment(),
    createOrderAndShipment(),
  ])
  const firstOperation = await prisma.shipmentOperation.create({
    data: {
      identityKey: `${fixturePrefix}-operation-identity`,
      shipmentId: first.shipment.id,
      operationType: 'ASSIGN_AWB',
    },
  })
  fixtureIds.operation.push(firstOperation.id)

  await assert.rejects(prisma.shipmentOperation.create({
    data: {
      identityKey: `${fixturePrefix}-operation-identity`,
      shipmentId: second.shipment.id,
      operationType: 'ASSIGN_AWB',
    },
  }))

  const leaseToken = `${fixturePrefix}-unique-lease`
  const leaseOperation = await prisma.shipmentOperation.create({
    data: {
      identityKey: `${fixturePrefix}-lease-operation`,
      shipmentId: second.shipment.id,
      operationType: 'GENERATE_LABEL',
      processingLeaseToken: leaseToken,
    },
  })
  fixtureIds.operation.push(leaseOperation.id)

  await assert.rejects(prisma.shipmentOperation.create({
    data: {
      identityKey: `${fixturePrefix}-duplicate-lease-operation`,
      shipmentId: third.shipment.id,
      operationType: 'GENERATE_LABEL',
      processingLeaseToken: leaseToken,
    },
  }))

  const claimable = await prisma.shipmentOperation.create({
    data: {
      identityKey: `${fixturePrefix}-claim-operation`,
      shipmentId: third.shipment.id,
      operationType: 'REQUEST_PICKUP',
    },
  })
  fixtureIds.operation.push(claimable.id)

  const claimTokens = [
    `${fixturePrefix}-claim-a`,
    `${fixturePrefix}-claim-b`,
  ]
  const claims = await Promise.all(claimTokens.map((processingLeaseToken) => (
    prisma.shipmentOperation.updateMany({
      where: {
        id: claimable.id,
        status: 'PENDING',
        processingLeaseToken: null,
      },
      data: {
        status: 'PROCESSING',
        attemptCount: { increment: 1 },
        processingStartedAt: new Date(),
        processingLeaseToken,
      },
    })
  )))

  assert.equal(claims.reduce((sum, claim) => sum + claim.count, 0), 1)
  const processing = await prisma.shipmentOperation.findUnique({
    where: { id: claimable.id },
  })
  assert.equal(processing.status, 'PROCESSING')
  assert.equal(processing.attemptCount, 1)
  assert.ok(claimTokens.includes(processing.processingLeaseToken))

  const transitioned = await prisma.shipmentOperation.updateMany({
    where: {
      id: claimable.id,
      status: 'PROCESSING',
      processingLeaseToken: processing.processingLeaseToken,
    },
    data: {
      status: 'SUCCEEDED',
      processingStartedAt: null,
      processingLeaseToken: null,
    },
  })
  assert.equal(transitioned.count, 1)
  const succeeded = await prisma.shipmentOperation.findUnique({
    where: { id: claimable.id },
  })
  assert.equal(succeeded.status, 'SUCCEEDED')
  assert.equal(succeeded.processingLeaseToken, null)
})

test('allows a Shipment in multiple manifests and rejects duplicate membership per manifest', async () => {
  const { shipment } = await createOrderAndShipment()
  const [firstManifest, secondManifest] = await Promise.all([
    createManifest('first'),
    createManifest('second'),
  ])
  const membership = (manifestId) => ({
    manifestId,
    shipmentId: shipment.id,
    shiprocketOrderId: `${fixturePrefix}-provider-order`,
    shiprocketShipmentId: `${fixturePrefix}-provider-shipment`,
  })

  await prisma.shipmentManifestItem.create({ data: membership(firstManifest.id) })
  await prisma.shipmentManifestItem.create({ data: membership(secondManifest.id) })
  await assert.rejects(prisma.shipmentManifestItem.create({
    data: membership(firstManifest.id),
  }))

  assert.equal(
    await prisma.shipmentManifestItem.count({ where: { shipmentId: shipment.id } }),
    2,
  )
})

test('persists, deduplicates, and orders tracking events without regressing latest status', async () => {
  const { order, shipment } = await createOrderAndShipment()
  const payment = await prisma.payment.create({
    data: {
      userId: testUserId,
      storeId: testStoreId,
      orderId: order.id,
      provider: 'COD',
      status: 'PENDING_COLLECTION',
      amount: order.totalPrice,
      currency: 'INR',
      idempotencyKey: `${fixturePrefix}-webhook-cod`,
      paymentAttemptKey: `${fixturePrefix}-webhook-cod`,
    },
  })
  fixtureIds.payment.push(payment.id)
  const awbCode = `${fixturePrefix}-awb`
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      awbCode,
      awbNormalized: awbCode.toUpperCase(),
      shiprocketOrderId: `${fixturePrefix}-provider-order`,
    },
  })

  const handler = createCourierTrackingWebhookHandler({
    prismaClient: prisma,
    webhookToken: `${fixturePrefix}-webhook-token`,
  })
  const body = {
    awb: awbCode,
    current_status: 'Delivered',
    current_status_id: 7,
    shipment_status: 'Delivered',
    shipment_status_id: 7,
    current_timestamp: '2026-11-08T12:00:00Z',
    order_id: order.id,
    sr_order_id: `${fixturePrefix}-provider-order`,
    scans: [
      {
        date: '2026-11-08T12:00:00Z',
        status: 'Delivered',
        activity: 'Fixture delivery event',
      },
      {
        date: '2026-11-08T10:00:00Z',
        status: 'In Transit',
        activity: 'Fixture transit event',
      },
    ],
  }

  const firstResponse = await sendWebhook(handler, body)
  assert.equal(firstResponse.statusCode, 200)
  assert.deepEqual(firstResponse.body, { received: 2, recorded: 2, duplicates: 0 })

  const duplicateResponse = await sendWebhook(handler, body)
  assert.equal(duplicateResponse.statusCode, 200)
  assert.deepEqual(duplicateResponse.body, { received: 2, recorded: 0, duplicates: 2 })

  const staleResponse = await sendWebhook(handler, {
    ...body,
    scans: [{
      date: '2026-11-08T09:00:00Z',
      status: 'Picked Up',
      activity: 'Fixture older event',
    }],
  })
  assert.equal(staleResponse.statusCode, 200)
  assert.equal(staleResponse.body.recorded, 1)

  const events = await prisma.shipmentTrackingEvent.findMany({
    where: { shipmentId: shipment.id },
    orderBy: { occurredAt: 'asc' },
  })
  assert.equal(events.length, 3)
  assert.deepEqual(events.map((event) => event.status), ['Picked Up', 'In Transit', 'Delivered'])
  await assert.rejects(prisma.shipmentTrackingEvent.create({
    data: {
      shipmentId: shipment.id,
      eventHash: events[0].eventHash,
      awbNormalized: awbCode.toUpperCase(),
      source: 'INTEGRATION_TEST',
    },
  }))

  const latestShipment = await prisma.shipment.findUnique({
    where: { id: shipment.id },
  })
  assert.equal(latestShipment.trackingStatus, 'Delivered')
  assert.equal(latestShipment.trackingStatusAt.toISOString(), '2026-11-08T12:00:00.000Z')
  const unchangedPayment = await prisma.payment.findUnique({ where: { id: payment.id } })
  assert.equal(unchangedPayment.status, 'PENDING_COLLECTION')
})

test('rolls back an Order and queued Shipment together', async () => {
  let rolledBackOrderId
  let rolledBackShipmentId
  const rollbackError = new Error('intentional integration fixture rollback')

  await assert.rejects(prisma.$transaction(async (transaction) => {
    const order = await transaction.order.create({
      data: {
        userId: testUserId,
        storeId: testStoreId,
        totalPrice: 1,
      },
    })
    rolledBackOrderId = order.id
    fixtureIds.order.push(order.id)

    const shipment = await queueShipment(transaction, order.id)
    rolledBackShipmentId = shipment.id
    fixtureIds.shipment.push(shipment.id)
    throw rollbackError
  }), (error) => error.message === rollbackError.message)

  assert.equal(await prisma.order.findUnique({ where: { id: rolledBackOrderId } }), null)
  assert.equal(await prisma.shipment.findUnique({ where: { id: rolledBackShipmentId } }), null)
})
