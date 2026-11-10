import { createHash, timingSafeEqual } from 'node:crypto'

const MAX_SCANS = 200
const MAX_TEXT_LENGTH = 500

export class CourierWebhookError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const textField = (value, field, { required = false, maxLength = MAX_TEXT_LENGTH } = {}) => {
  if (value === undefined || value === null) {
    if (required) throw new CourierWebhookError(400, `Invalid ${field}`)
    return null
  }
  if (typeof value !== 'string' || value.length > maxLength || (required && !value.trim())) {
    throw new CourierWebhookError(400, `Invalid ${field}`)
  }
  return value.trim() || null
}

const scalarField = (value, field) => {
  if (value === undefined || value === null) return null
  if (
    (typeof value !== 'string' && typeof value !== 'number')
    || !String(value).trim()
    || String(value).length > MAX_TEXT_LENGTH
  ) {
    throw new CourierWebhookError(400, `Invalid ${field}`)
  }
  return String(value).trim()
}

const parseProviderDate = (value, field, { allowDateOnly = false } = {}) => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 80) {
    throw new CourierWebhookError(400, `Invalid ${field}`)
  }
  const dateOnly = allowDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(value)
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const parsed = Date.parse(dateOnly ? `${value}T00:00:00.000Z` : value)
  if (!Number.isFinite(parsed)) throw new CourierWebhookError(400, `Invalid ${field}`)
  return {
    date: new Date(parsed),
    reliable: dateOnly || hasTimezone,
  }
}

const normalizeAwb = (value) => value.trim().replace(/\s+/g, '').toUpperCase()

const canonicalEvent = (event) => ({
  source: event.source,
  occurredAt: event.occurredAt?.toISOString() || null,
  status: event.status,
  statusId: event.statusId,
  shipmentStatus: event.shipmentStatus,
  shipmentStatusId: event.shipmentStatusId,
  activity: event.activity,
  location: event.location,
  srStatus: event.srStatus,
  srStatusLabel: event.srStatusLabel,
})

const eventIdentity = (shipmentId, awbNormalized, event) => createHash('sha256')
  .update(JSON.stringify({
    shipmentId,
    awbNormalized,
    scan: canonicalEvent(event),
  }))
  .digest('hex')

const validatePayload = (payload) => {
  if (!isRecord(payload)) throw new CourierWebhookError(400, 'Invalid courier event payload')

  const awb = textField(payload.awb, 'awb', { required: true, maxLength: 128 })
  if (/[\u0000-\u001f\u007f]/.test(awb)) throw new CourierWebhookError(400, 'Invalid awb')
  const courierName = textField(payload.courier_name, 'courier_name', { maxLength: 200 })
  const currentStatus = textField(payload.current_status, 'current_status', { required: true })
  const currentStatusId = scalarField(payload.current_status_id, 'current_status_id')
  const shipmentStatus = textField(payload.shipment_status, 'shipment_status')
  const shipmentStatusId = scalarField(payload.shipment_status_id, 'shipment_status_id')
  const currentTimestamp = parseProviderDate(payload.current_timestamp, 'current_timestamp')
  const estimatedDelivery = parseProviderDate(payload.etd, 'etd', { allowDateOnly: true })
  const providerOrderId = scalarField(payload.sr_order_id, 'sr_order_id')
  const merchantOrderId = scalarField(payload.order_id, 'order_id')

  if (payload.scans !== undefined && !Array.isArray(payload.scans)) {
    throw new CourierWebhookError(400, 'Invalid scans')
  }
  if (payload.scans?.length > MAX_SCANS) throw new CourierWebhookError(400, 'Too many courier scans')

  const scans = (payload.scans || []).map((scan) => {
    if (!isRecord(scan)) throw new CourierWebhookError(400, 'Invalid courier scan')
    const date = parseProviderDate(scan.date, 'scan date')
    return {
      date: date?.reliable ? date.date : null,
      status: textField(scan.status, 'scan status') || currentStatus,
      statusId: currentStatusId,
      shipmentStatus,
      shipmentStatusId,
      activity: textField(scan.activity, 'scan activity'),
      location: textField(scan.location, 'scan location'),
      srStatus: scalarField(scan['sr-status'], 'scan sr-status'),
      srStatusLabel: textField(scan['sr-status-label'], 'scan sr-status-label'),
      source: 'SCAN',
    }
  })

  const events = scans.length ? scans : [{
    date: currentTimestamp?.reliable ? currentTimestamp.date : null,
    status: currentStatus,
    statusId: currentStatusId,
    shipmentStatus,
    shipmentStatusId,
    activity: currentStatus,
    location: null,
    srStatus: null,
    srStatusLabel: null,
    source: 'CURRENT_STATUS',
  }]

  return {
    awb,
    awbNormalized: normalizeAwb(awb),
    courierName,
    providerOrderId,
    merchantOrderId,
    estimatedDeliveryAt: estimatedDelivery?.date || null,
    events,
  }
}

const expectedEqual = (received, expected) => {
  const receivedHash = createHash('sha256').update(received).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(receivedHash, expectedHash)
}

export const createCourierTrackingWebhookHandler = ({
  prismaClient,
  webhookToken = () => process.env.SHIPROCKET_WEBHOOK_TOKEN,
} = {}) => {
  if (
    !prismaClient?.shipment
    || !prismaClient?.shipmentTrackingEvent
    || typeof prismaClient.$transaction !== 'function'
  ) {
    throw new TypeError('Prisma shipment models and transaction support are required')
  }
  const getWebhookToken = typeof webhookToken === 'function'
    ? webhookToken
    : () => webhookToken

  return async (req, res) => {
    const expectedToken = getWebhookToken()
    if (typeof expectedToken !== 'string' || !expectedToken.trim()) {
      return res.status(503).json({ message: 'Courier webhook authentication is not configured' })
    }
    const configuredToken = expectedToken.trim()
    const suppliedToken = req.get?.('x-api-key') ?? req.headers?.['x-api-key']
    if (
      typeof suppliedToken !== 'string'
      || suppliedToken.length > 4096
      || !expectedEqual(suppliedToken, configuredToken)
    ) {
      return res.status(401).json({ message: 'Invalid courier webhook credentials' })
    }

    try {
      const payload = validatePayload(req.body)
      const candidates = await prismaClient.shipment.findMany({
        where: { awbNormalized: payload.awbNormalized },
        select: {
          id: true,
          orderId: true,
          awbCode: true,
          shiprocketOrderId: true,
          courierName: true,
          trackingStatusAt: true,
        },
      })
      const matches = candidates.filter((shipment) => (
        typeof shipment.awbCode === 'string'
        && normalizeAwb(shipment.awbCode) === payload.awbNormalized
      ))
      if (matches.length === 0) return res.status(404).json({ message: 'Shipment not found' })
      if (matches.length > 1) return res.status(409).json({ message: 'Ambiguous shipment identity' })

      const shipment = matches[0]
      if (
        (payload.providerOrderId && payload.providerOrderId !== String(shipment.shiprocketOrderId || ''))
        || (payload.merchantOrderId && payload.merchantOrderId !== String(shipment.orderId))
      ) {
        return res.status(409).json({ message: 'Courier event shipment identity mismatch' })
      }

      const events = payload.events.map((event) => ({
        shipmentId: shipment.id,
        eventHash: eventIdentity(shipment.id, payload.awbNormalized, event),
        awbNormalized: payload.awbNormalized,
        source: event.source,
        status: event.status,
        statusId: event.statusId,
        shipmentStatus: event.shipmentStatus,
        shipmentStatusId: event.shipmentStatusId,
        activity: event.activity,
        location: event.location,
        srStatus: event.srStatus,
        srStatusLabel: event.srStatusLabel,
        providerOrderId: payload.providerOrderId,
        merchantOrderId: payload.merchantOrderId,
        occurredAt: event.date,
      }))
      const chronologicalEvents = events
        .filter((event) => event.occurredAt && event.status)
        .sort((left, right) => left.occurredAt - right.occurredAt)

      const transactionResult = await prismaClient.$transaction(async (transaction) => {
        const inserted = await transaction.shipmentTrackingEvent.createMany({
          data: events,
          skipDuplicates: true,
        })

        if (payload.courierName && !shipment.courierName) {
          await transaction.shipment.updateMany({
            where: { id: shipment.id, courierName: null },
            data: { courierName: payload.courierName },
          })
        }

        for (const event of chronologicalEvents) {
          const data = {
            trackingStatus: event.status,
            trackingStatusId: event.statusId,
            trackingStatusAt: event.occurredAt,
          }
          if (payload.estimatedDeliveryAt) data.estimatedDeliveryAt = payload.estimatedDeliveryAt
          await transaction.shipment.updateMany({
            where: {
              id: shipment.id,
              OR: [
                { trackingStatusAt: null },
                { trackingStatusAt: { lt: event.occurredAt } },
              ],
            },
            data,
          })
        }
        return inserted.count
      })

      return res.status(200).json({
        received: events.length,
        recorded: transactionResult,
        duplicates: events.length - transactionResult,
      })
    } catch (error) {
      if (error instanceof CourierWebhookError) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      return res.status(503).json({ message: 'Courier event storage is temporarily unavailable' })
    }
  }
}
