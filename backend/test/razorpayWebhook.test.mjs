import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { test } from 'node:test'
import {
  WEBHOOK_PROCESSING_LEASE_MS,
  createRazorpayWebhookHandler,
  createWebhookProcessor,
} from '../controllers/razorpayWebhookController.js'
import { verifyRazorpayWebhookSignature } from '../services/razorpayService.js'

const testSecret = 'webhook-test-secret'

const makePayload = ({ event = 'payment.authorized', orderId = 'order_test', paymentId = 'pay_test' } = {}) => event === 'order.paid'
  ? { event, payload: { order: { entity: { id: orderId } } } }
  : { event, payload: { payment: { entity: { id: paymentId, order_id: orderId } } } }

const sign = (body) => crypto.createHmac('sha256', testSecret).update(body).digest('hex')

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

const makeRequest = (body, options = {}) => ({
  body,
  get(name) {
    const headers = {
      'x-razorpay-signature': Object.prototype.hasOwnProperty.call(options, 'signature') ? options.signature : sign(body),
      'x-razorpay-event-id': Object.prototype.hasOwnProperty.call(options, 'eventId') ? options.eventId : 'evt_test',
    }
    return headers[name.toLowerCase()]
  },
})

const makeFakePrisma = ({ payments = [], events = [] } = {}) => {
  const state = {
    payments: [...payments],
    events: [...events],
    nextEventId: events.reduce((highest, event) => Math.max(highest, event.id), 0) + 1,
    commerceWrites: [],
  }

  const matchesPayment = (payment, where) => payment.provider === where.provider && (
    (where.providerOrderId === undefined || payment.providerOrderId === where.providerOrderId) &&
    (where.providerPaymentId === undefined || payment.providerPaymentId === where.providerPaymentId)
  )

  const matchesEvent = (event, where) => {
    if (where.id !== undefined && event.id !== where.id) return false
    if (where.status !== undefined && event.status !== where.status) return false
    if (where.provider !== undefined && event.provider !== where.provider) return false
    if (where.providerEventId !== undefined && event.providerEventId !== where.providerEventId) return false
    if (where.processingLeaseToken !== undefined && event.processingLeaseToken !== where.processingLeaseToken) return false
    if (where.processingStartedAt?.lt && !(event.processingStartedAt && event.processingStartedAt < where.processingStartedAt.lt)) return false
    return true
  }

  const fakePrisma = {
    payment: {
      findFirst: async ({ where, select }) => {
        const payment = state.payments.find((candidate) => matchesPayment(candidate, where))
        return payment ? { id: payment.id, ...(select?.id ? {} : payment) } : null
      },
    },
    paymentWebhookEvent: {
      create: async ({ data }) => {
        if (state.events.some((event) => event.provider === data.provider && event.providerEventId === data.providerEventId)) {
          throw Object.assign(new Error('duplicate'), { code: 'P2002' })
        }
        const event = { id: state.nextEventId++, ...data }
        state.events.push(event)
        return event
      },
      findUnique: async ({ where }) => state.events.find((event) => event.provider === where.provider_providerEventId.provider && event.providerEventId === where.provider_providerEventId.providerEventId) || null,
      updateMany: async ({ where, data }) => {
        const baseWhere = { ...where }
        delete baseWhere.OR
        const event = state.events.find((candidate) => matchesEvent(candidate, baseWhere) && (!where.OR || where.OR.some((condition) => matchesEvent(candidate, condition))))
        if (!event) return { count: 0 }
        Object.assign(event, data)
        return { count: 1 }
      },
      update: async ({ where, data }) => {
        const event = state.events.find((candidate) => candidate.id === where.id)
        if (!event) throw new Error('missing event')
        Object.assign(event, data)
        return event
      },
    },
    get state() {
      return state
    },
  }

  return fakePrisma
}

const withWebhookSecret = async (callback) => {
  const previous = process.env.RAZORPAY_WEBHOOK_SECRET
  process.env.RAZORPAY_WEBHOOK_SECRET = testSecret
  try {
    return await callback()
  } finally {
    if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET
    else process.env.RAZORPAY_WEBHOOK_SECRET = previous
  }
}

const makeHandler = (fakePrisma) => createRazorpayWebhookHandler({
  processor: createWebhookProcessor({ prismaClient: fakePrisma, clock: () => new Date('2026-09-16T12:00:00.000Z') }),
})

test('valid signature is accepted', async () => withWebhookSecret(async () => {
  const body = Buffer.from(JSON.stringify(makePayload()))
  const response = makeResponse()
  await makeHandler(makeFakePrisma())(makeRequest(body), response)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { received: true })
}))

test('modified body is rejected', async () => withWebhookSecret(async () => {
  const original = Buffer.from(JSON.stringify(makePayload()))
  const response = makeResponse()
  await makeHandler(makeFakePrisma())(makeRequest(Buffer.from(JSON.stringify(makePayload({ paymentId: 'pay_changed' }))), { signature: sign(original) }), response)
  assert.equal(response.statusCode, 400)
}))

test('modified signature is rejected', async () => withWebhookSecret(async () => {
  const body = Buffer.from(JSON.stringify(makePayload()))
  const response = makeResponse()
  await makeHandler(makeFakePrisma())(makeRequest(body, { signature: sign(Buffer.from('different')) }), response)
  assert.equal(response.statusCode, 400)
}))

test('missing signature is rejected', async () => withWebhookSecret(async () => {
  const body = Buffer.from(JSON.stringify(makePayload()))
  const response = makeResponse()
  await makeHandler(makeFakePrisma())(makeRequest(body, { signature: undefined }), response)
  assert.equal(response.statusCode, 400)
}))

test('missing webhook secret fails safely', async () => {
  const previous = process.env.RAZORPAY_WEBHOOK_SECRET
  delete process.env.RAZORPAY_WEBHOOK_SECRET
  try {
    assert.equal(verifyRazorpayWebhookSignature({ rawBody: Buffer.from('{}'), signature: 'bad' }), false)
  } finally {
    if (previous !== undefined) process.env.RAZORPAY_WEBHOOK_SECRET = previous
  }
})

test('incorrect signature length is rejected', async () => withWebhookSecret(async () => {
  assert.equal(verifyRazorpayWebhookSignature({ rawBody: Buffer.from('{}'), signature: 'short' }), false)
}))

test('missing event ID is rejected', async () => withWebhookSecret(async () => {
  const body = Buffer.from(JSON.stringify(makePayload()))
  const response = makeResponse()
  await makeHandler(makeFakePrisma())(makeRequest(body, { eventId: undefined }), response)
  assert.equal(response.statusCode, 400)
}))

test('valid event ID is accepted and recorded', async () => withWebhookSecret(async () => {
  const fakePrisma = makeFakePrisma()
  const body = Buffer.from(JSON.stringify(makePayload()))
  const response = makeResponse()
  await makeHandler(fakePrisma)(makeRequest(body, { eventId: 'evt_valid' }), response)
  assert.equal(response.statusCode, 200)
  assert.equal(fakePrisma.state.events.length, 1)
  assert.equal(fakePrisma.state.events[0].providerEventId, 'evt_valid')
}))

test('duplicate event creates only one event row', async () => {
  const fakePrisma = makeFakePrisma()
  const processor = createWebhookProcessor({ prismaClient: fakePrisma, clock: () => new Date('2026-09-16T12:00:00.000Z') })
  await processor.receive({ providerEventId: 'evt_duplicate', eventType: 'payment.authorized', providerOrderId: 'order_test' })
  await processor.receive({ providerEventId: 'evt_duplicate', eventType: 'payment.authorized', providerOrderId: 'order_test' })
  assert.equal(fakePrisma.state.events.length, 1)
})

test('concurrent duplicate delivery creates one event row', async () => {
  const fakePrisma = makeFakePrisma()
  const processor = createWebhookProcessor({ prismaClient: fakePrisma, clock: () => new Date('2026-09-16T12:00:00.000Z') })
  await Promise.all(Array.from({ length: 10 }, () => processor.receive({ providerEventId: 'evt_concurrent', eventType: 'payment.authorized', providerOrderId: 'order_test' })))
  assert.equal(fakePrisma.state.events.length, 1)
})

test('local Payment resolves by provider order reference first', async () => {
  const fakePrisma = makeFakePrisma({ payments: [{ id: 7, provider: 'RAZORPAY', providerOrderId: 'order_test', providerPaymentId: 'pay_test' }] })
  await createWebhookProcessor({ prismaClient: fakePrisma }).receive({ providerEventId: 'evt_order_lookup', eventType: 'payment.authorized', providerOrderId: 'order_test', providerPaymentId: 'pay_test' })
  assert.equal(fakePrisma.state.events[0].paymentId, 7)
})

test('local Payment resolves by provider payment reference as fallback', async () => {
  const fakePrisma = makeFakePrisma({ payments: [{ id: 8, provider: 'RAZORPAY', providerOrderId: null, providerPaymentId: 'pay_test' }] })
  await createWebhookProcessor({ prismaClient: fakePrisma }).receive({ providerEventId: 'evt_payment_lookup', eventType: 'payment.authorized', providerPaymentId: 'pay_test' })
  assert.equal(fakePrisma.state.events[0].paymentId, 8)
})

test('unknown provider object is recorded without creating a Payment', async () => {
  const fakePrisma = makeFakePrisma()
  await createWebhookProcessor({ prismaClient: fakePrisma }).receive({ providerEventId: 'evt_unknown', eventType: 'payment.failed', providerOrderId: 'order_unknown' })
  assert.equal(fakePrisma.state.events[0].paymentId, null)
  assert.equal(fakePrisma.state.payments.length, 0)
})

test('cross-provider object is not associated', async () => {
  const fakePrisma = makeFakePrisma({ payments: [{ id: 9, provider: 'OTHER', providerOrderId: 'order_other', providerPaymentId: 'pay_other' }] })
  await createWebhookProcessor({ prismaClient: fakePrisma }).receive({ providerEventId: 'evt_cross_provider', eventType: 'payment.failed', providerOrderId: 'order_other', providerPaymentId: 'pay_other' })
  assert.equal(fakePrisma.state.events[0].paymentId, null)
})

test('PROCESSED event is not processed again', async () => {
  const fakePrisma = makeFakePrisma({ events: [{ id: 1, provider: 'RAZORPAY', providerEventId: 'evt_processed', eventType: 'payment.authorized', paymentId: null, status: 'PROCESSED', processedAt: new Date() }] })
  const result = await createWebhookProcessor({ prismaClient: fakePrisma }).receive({ providerEventId: 'evt_processed', eventType: 'payment.authorized' })
  assert.equal(result.processed, false)
  assert.equal(fakePrisma.state.events[0].status, 'PROCESSED')
})

test('fresh PROCESSING event is not processed again', async () => {
  const now = new Date('2026-09-16T12:00:00.000Z')
  const fakePrisma = makeFakePrisma({ events: [{ id: 1, provider: 'RAZORPAY', providerEventId: 'evt_processing', eventType: 'payment.authorized', paymentId: null, status: 'PROCESSING', processingStartedAt: new Date(now.getTime() - WEBHOOK_PROCESSING_LEASE_MS + 1) }] })
  const result = await createWebhookProcessor({ prismaClient: fakePrisma, clock: () => now }).receive({ providerEventId: 'evt_processing', eventType: 'payment.authorized' })
  assert.equal(result.processed, false)
  assert.equal(fakePrisma.state.events[0].status, 'PROCESSING')
})

test('stale PROCESSING event can be reclaimed', async () => {
  const now = new Date('2026-09-16T12:00:00.000Z')
  const fakePrisma = makeFakePrisma({ events: [{ id: 1, provider: 'RAZORPAY', providerEventId: 'evt_stale', eventType: 'payment.authorized', paymentId: null, status: 'PROCESSING', processingStartedAt: new Date(now.getTime() - WEBHOOK_PROCESSING_LEASE_MS - 1) }] })
  const result = await createWebhookProcessor({ prismaClient: fakePrisma, clock: () => now }).receive({ providerEventId: 'evt_stale', eventType: 'payment.authorized' })
  assert.equal(result.processed, true)
  assert.equal(fakePrisma.state.events[0].status, 'PROCESSED')
})

test('reclaimed lease prevents the original worker from completing', async () => {
  const staleAt = new Date('2026-09-16T12:00:00.000Z')
  const freshAt = new Date(staleAt.getTime() + WEBHOOK_PROCESSING_LEASE_MS + 1)
  const fakePrisma = makeFakePrisma()
  let releaseWorkerA
  let workerAClaimed
  const workerAClaimedPromise = new Promise((resolve) => { workerAClaimed = resolve })
  const workerAReleasePromise = new Promise((resolve) => { releaseWorkerA = resolve })
  const workerA = createWebhookProcessor({
    prismaClient: fakePrisma,
    clock: () => staleAt,
    afterClaimed: async () => {
      workerAClaimed()
      await workerAReleasePromise
    },
  })
  const workerB = createWebhookProcessor({ prismaClient: fakePrisma, clock: () => freshAt })

  const workerAResultPromise = workerA.receive({ providerEventId: 'evt_lease_race', eventType: 'payment.authorized' })
  await workerAClaimedPromise
  const leaseTokenA = fakePrisma.state.events[0].processingLeaseToken
  const workerBResult = await workerB.receive({ providerEventId: 'evt_lease_race', eventType: 'payment.authorized' })
  const leaseTokenB = fakePrisma.state.events[0].processingLeaseToken
  releaseWorkerA()
  const workerAResult = await workerAResultPromise

  assert.notEqual(leaseTokenA, leaseTokenB)
  assert.equal(workerBResult.processed, true)
  assert.equal(workerAResult.processed, false)
  assert.equal(fakePrisma.state.events[0].status, 'PROCESSED')
  assert.equal(fakePrisma.state.events[0].processingLeaseToken, leaseTokenB)
})

test('accepted webhook does not create commerce records or change Payment state', async () => {
  const fakePrisma = makeFakePrisma({ payments: [{ id: 10, provider: 'RAZORPAY', providerOrderId: 'order_test', providerPaymentId: 'pay_test', status: 'CREATED' }] })
  await createWebhookProcessor({ prismaClient: fakePrisma }).receive({ providerEventId: 'evt_observation_only', eventType: 'payment.captured', providerOrderId: 'order_test', providerPaymentId: 'pay_test' })
  assert.equal(fakePrisma.state.commerceWrites.length, 0)
  assert.equal(fakePrisma.state.payments[0].status, 'CREATED')
  assert.equal(fakePrisma.state.events[0].status, 'PROCESSED')
})
