import crypto from 'node:crypto'
import prisma from '../lib/prisma.js'
import { verifyRazorpayWebhookSignature } from '../services/razorpayService.js'

export const SUPPORTED_WEBHOOK_EVENTS = new Set([
  'payment.authorized',
  'payment.captured',
  'payment.failed',
  'order.paid',
])

export const WEBHOOK_PROCESSING_LEASE_MS = 60 * 1000

const INVALID_WEBHOOK_MESSAGE = 'Invalid webhook request'
const PROVIDER_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const validReference = (value) => typeof value === 'string' && PROVIDER_REFERENCE_PATTERN.test(value.trim())

const entityFor = (payload) => {
  if (isRecord(payload?.payload?.payment?.entity)) return payload.payload.payment.entity
  if (isRecord(payload?.payload?.order?.entity)) return payload.payload.order.entity
  return null
}

export const extractWebhookDetails = (payload) => {
  if (!isRecord(payload) || typeof payload.event !== 'string' || !SUPPORTED_WEBHOOK_EVENTS.has(payload.event.trim())) return null

  const entity = entityFor(payload)
  if (!entity) return null

  const isOrderEvent = payload.event === 'order.paid'
  const providerOrderId = isOrderEvent ? entity.id : entity.order_id
  const providerPaymentId = isOrderEvent ? null : entity.id
  if (!validReference(providerOrderId) && !validReference(providerPaymentId)) return null

  return {
    eventType: payload.event.trim(),
    providerOrderId: validReference(providerOrderId) ? providerOrderId.trim() : null,
    providerPaymentId: validReference(providerPaymentId) ? providerPaymentId.trim() : null,
  }
}

const resolvePayment = async (db, { providerOrderId, providerPaymentId }) => {
  if (providerOrderId) {
    const paymentByOrder = await db.payment.findFirst({
      where: { provider: 'RAZORPAY', providerOrderId },
      select: { id: true },
    })
    if (paymentByOrder) return paymentByOrder
  }

  if (providerPaymentId) {
    return db.payment.findFirst({
      where: { provider: 'RAZORPAY', providerPaymentId },
      select: { id: true },
    })
  }

  return null
}

const createOrFindEvent = async (db, { providerEventId, eventType, paymentId, now }) => {
  try {
    return await db.paymentWebhookEvent.create({
      data: {
        provider: 'RAZORPAY',
        providerEventId,
        eventType,
        paymentId,
        status: 'RECEIVED',
        receivedAt: now,
      },
    })
  } catch (error) {
    if (error?.code !== 'P2002') throw error
    return db.paymentWebhookEvent.findUnique({
      where: { provider_providerEventId: { provider: 'RAZORPAY', providerEventId } },
    })
  }
}

export const createWebhookProcessor = ({ prismaClient = prisma, clock = () => new Date(), afterClaimed = async () => {} } = {}) => ({
  async receive({ providerEventId, eventType, providerOrderId = null, providerPaymentId = null }) {
    const now = clock()
    const payment = await resolvePayment(prismaClient, { providerOrderId, providerPaymentId })
    const event = await createOrFindEvent(prismaClient, {
      providerEventId,
      eventType,
      paymentId: payment?.id || null,
      now,
    })
    if (!event) throw new Error('Webhook event could not be loaded')

    const staleBefore = new Date(now.getTime() - WEBHOOK_PROCESSING_LEASE_MS)
    const processingLeaseToken = crypto.randomUUID()
    const claimed = await prismaClient.paymentWebhookEvent.updateMany({
      where: {
        provider: 'RAZORPAY',
        providerEventId,
        OR: [
          { status: 'RECEIVED' },
          { status: 'FAILED' },
          { status: 'PROCESSING', processingStartedAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: 'PROCESSING',
        processingLeaseToken,
        processingStartedAt: now,
        failedAt: null,
        lastError: null,
      },
    })

    if (claimed.count !== 1) return { processed: false }

    await afterClaimed({ providerEventId })

    try {
      const completed = await prismaClient.paymentWebhookEvent.updateMany({
        where: { provider: 'RAZORPAY', providerEventId, processingLeaseToken },
        data: { status: 'PROCESSED', processedAt: clock(), failedAt: null, lastError: null },
      })
      return { processed: completed.count === 1 }
    } catch (error) {
      await prismaClient.paymentWebhookEvent.updateMany({
        where: { provider: 'RAZORPAY', providerEventId, status: 'PROCESSING', processingLeaseToken },
        data: { status: 'FAILED', failedAt: clock(), lastError: 'Webhook processing failed' },
      }).catch(() => {})
      throw error
    }
  },
})

export const createRazorpayWebhookHandler = ({ processor = createWebhookProcessor(), signatureVerifier = verifyRazorpayWebhookSignature } = {}) => async (req, res) => {
  const signature = req.get('x-razorpay-signature')
  const providerEventId = req.get('x-razorpay-event-id')?.trim()
  const rawBody = req.body

  if (!providerEventId || providerEventId.length > 256 || !Buffer.isBuffer(rawBody) || !signatureVerifier({ rawBody, signature })) {
    return res.status(400).json({ message: INVALID_WEBHOOK_MESSAGE })
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return res.status(400).json({ message: INVALID_WEBHOOK_MESSAGE })
  }

  const details = extractWebhookDetails(payload)
  if (!details) return res.status(400).json({ message: INVALID_WEBHOOK_MESSAGE })

  try {
    await processor.receive({ providerEventId, ...details })
    return res.status(200).json({ received: true })
  } catch {
    return res.status(500).json({ message: 'Webhook processing failed' })
  }
}

export const receiveRazorpayWebhook = createRazorpayWebhookHandler()
