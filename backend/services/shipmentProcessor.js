import crypto from 'node:crypto'
import { shiprocketClient } from './shiprocketService.js'
import { validateShipmentPackageMeasurements } from './shipmentPackageMeasurements.js'

const CLAIMABLE_STATUSES = ['PENDING', 'RETRY_SCHEDULED']
const RETRY_DELAY_BASE_MS = 60_000
const RETRY_DELAY_MAX_MS = 24 * 60 * 60 * 1000
const PERSISTENCE_FAILURE_CODE = 'SHIPMENT_SUCCESS_PERSISTENCE_FAILED'
const MAX_CENTS_REPRESENTATION_ERROR = 1e-7

class ShipmentValidationError extends Error {}

const nonEmptyString = (value) => typeof value === 'string' && value.trim()
  ? value.trim()
  : null

const identifier = (value) => {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  return null
}

const moneyInCents = (value, label) => {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || Object.is(value, -0)
  ) {
    throw new ShipmentValidationError(`Stored ${label} is missing or invalid.`)
  }
  const scaledValue = value * 100
  const cents = Math.round(scaledValue)
  if (!Number.isSafeInteger(cents)) {
    throw new ShipmentValidationError(`Stored ${label} is outside the supported range.`)
  }
  const centsRepresentationResolution = Number.EPSILON * Math.max(1, Math.abs(scaledValue))
  if (centsRepresentationResolution > MAX_CENTS_REPRESENTATION_ERROR) {
    throw new ShipmentValidationError(`Stored ${label} is outside the supported paise precision range.`)
  }
  if (Math.abs(scaledValue - cents) > MAX_CENTS_REPRESENTATION_ERROR) {
    throw new ShipmentValidationError(`Stored ${label} has more than two decimal places.`)
  }
  return cents
}

const moneyFromCents = (value) => value / 100

const parseStoredAddress = (value) => {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      throw new ShipmentValidationError('Stored shipping address is invalid.')
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ShipmentValidationError('Stored shipping address is missing.')
  }
  return value
}

const addressValue = (address, fields) => {
  for (const field of fields) {
    const value = nonEmptyString(address[field])
    if (value) return value
  }
  return null
}

const requiredAddressValue = (address, fields, label) => {
  const value = addressValue(address, fields)
  if (!value) throw new ShipmentValidationError(`Recipient ${label} is missing.`)
  return value
}

const normalizeAddress = (address, label) => ({
  name: requiredAddressValue(address, ['name'], `${label} name`),
  line1: requiredAddressValue(address, ['line1', 'address'], `${label} street address`),
  line2: addressValue(address, ['line2', 'apartment']),
  city: requiredAddressValue(address, ['city'], `${label} city`),
  state: requiredAddressValue(address, ['state'], `${label} state`),
  postalCode: requiredAddressValue(address, ['postalCode', 'pincode'], `${label} postal code`),
  country: requiredAddressValue(address, ['country'], `${label} country`),
})

const splitName = (name) => {
  const [first, ...rest] = name.trim().split(/\s+/)
  return { first, last: rest.join(' ') }
}

const assertValidPhone = (phone) => {
  const normalized = nonEmptyString(phone)
  const digits = normalized?.replace(/\D/g, '') ?? ''
  if (!normalized || !/^[+()\d.\-\s]+$/.test(normalized) || digits.length < 8 || digits.length > 15) {
    throw new ShipmentValidationError('Recipient phone number is missing or invalid.')
  }
  return normalized
}

const assertValidEmail = (email) => {
  const normalized = nonEmptyString(email)
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ShipmentValidationError('Recipient email address is missing or invalid.')
  }
  return normalized
}

const readPackageConfig = (env, shipment) => {
  const pickupLocation = nonEmptyString(env.SHIPROCKET_PICKUP_LOCATION)
  if (!pickupLocation) throw new ShipmentValidationError('Shiprocket pickup location is not configured.')

  if (
    !(shipment.packageConfirmedAt instanceof Date)
    || !Number.isFinite(shipment.packageConfirmedAt.getTime())
    || !Number.isSafeInteger(shipment.packageConfirmedById)
    || shipment.packageConfirmedById < 1
  ) {
    throw new ShipmentValidationError('Shipment package measurements must be confirmed by an administrator.')
  }

  let measurements
  try {
    measurements = validateShipmentPackageMeasurements({
      packageWeightKg: String(shipment.packageWeightKg ?? ''),
      packageLengthCm: String(shipment.packageLengthCm ?? ''),
      packageBreadthCm: String(shipment.packageBreadthCm ?? ''),
      packageHeightCm: String(shipment.packageHeightCm ?? ''),
    })
  } catch (error) {
    if (error instanceof TypeError) throw new ShipmentValidationError(error.message)
    throw error
  }

  return {
    pickupLocation,
    packageDetails: {
      length: Number(measurements.packageLengthCm),
      breadth: Number(measurements.packageBreadthCm),
      height: Number(measurements.packageHeightCm),
      weight: Number(measurements.packageWeightKg),
    },
  }
}

const paymentForOrder = (order) => {
  const paymentRecords = Array.isArray(order.payments) ? order.payments : []
  const prepaidPayments = paymentRecords.filter((payment) => (
    payment.provider === 'RAZORPAY'
    && ['AUTHORIZED', 'CAPTURED'].includes(payment.status)
    && nonEmptyString(payment.providerPaymentId)
  ))
  if (paymentRecords.length !== 1 || prepaidPayments.length !== 1) {
    throw new ShipmentValidationError('A single verified prepaid payment is required.')
  }

  const payment = prepaidPayments[0]
  const orderTotalCents = moneyInCents(order.totalPrice, 'order total')
  const paymentAmountCents = moneyInCents(payment.amount, 'payment amount')
  if (
    orderTotalCents <= 0
    || orderTotalCents !== paymentAmountCents
    || payment.currency !== order.currency
    || order.currency !== 'INR'
  ) {
    throw new ShipmentValidationError('Stored payment details do not match the order total and currency.')
  }
  return { payment, paymentMethod: 'Prepaid' }
}

const buildCustomOrder = (order, shipment, env) => {
  if (!order || !Number.isSafeInteger(order.id) || order.id < 1) {
    throw new ShipmentValidationError('The shipment order is missing or invalid.')
  }

  const { pickupLocation, packageDetails } = readPackageConfig(env, shipment)
  const { payment, paymentMethod } = paymentForOrder(order)
  const shippingSource = parseStoredAddress(order.shippingAddress)
  const billingSource = order.billingAddress == null
    ? shippingSource
    : parseStoredAddress(order.billingAddress)
  const shipping = normalizeAddress(shippingSource, 'shipping')
  const billing = normalizeAddress(billingSource, 'billing')
  const recipientName = shipping.name
  const recipient = splitName(recipientName)
  const email = assertValidEmail(
    addressValue(shippingSource, ['email']) ?? order.user?.email,
  )
  const phone = assertValidPhone(addressValue(shippingSource, ['phone', 'mobile']))
  const billingName = splitName(billing.name || recipientName)
  const billingEmail = assertValidEmail(addressValue(billingSource, ['email']) ?? email)
  const billingPhone = assertValidPhone(addressValue(billingSource, ['phone', 'mobile']) ?? phone)

  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new ShipmentValidationError('The order has no shippable items.')
  }

  let itemSubtotalCents = 0
  const orderItems = order.items.map((item) => {
    const sku = item.variant
      ? nonEmptyString(item.variant.sku)
      : nonEmptyString(item.product?.sku)
    if (!sku) throw new ShipmentValidationError('A product SKU is missing.')
    if (!nonEmptyString(item.product?.name)) {
      throw new ShipmentValidationError('A product name is missing.')
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new ShipmentValidationError('A product quantity is invalid.')
    }
    const sellingPriceCents = moneyInCents(item.price, 'product price')
    itemSubtotalCents += sellingPriceCents * item.quantity
    if (!Number.isSafeInteger(itemSubtotalCents)) {
      throw new ShipmentValidationError('The merchandise subtotal is outside the supported range.')
    }
    return {
      name: item.product.name.trim(),
      sku,
      units: item.quantity,
      selling_price: moneyFromCents(sellingPriceCents),
    }
  })

  const storedSubtotalCents = moneyInCents(order.subtotalBeforeDiscount, 'merchandise subtotal')
  const discountCents = moneyInCents(order.discountAmount, 'discount')
  const shippingCents = moneyInCents(order.shippingCost, 'shipping charge')
  const orderTotalCents = moneyInCents(order.totalPrice, 'order total')
  const netSubtotalCents = storedSubtotalCents - discountCents
  if (
    itemSubtotalCents !== storedSubtotalCents
    || discountCents > storedSubtotalCents
    || netSubtotalCents + shippingCents !== orderTotalCents
  ) {
    throw new ShipmentValidationError('Stored item, discount, shipping, and order totals do not reconcile.')
  }

  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt)
  if (!Number.isFinite(createdAt.getTime())) {
    throw new ShipmentValidationError('The order creation date is invalid.')
  }

  const billingMatchesShipping = (
    billing.line1 === shipping.line1
    && billing.line2 === shipping.line2
    && billing.city === shipping.city
    && billing.state === shipping.state
    && billing.postalCode === shipping.postalCode
    && billing.country === shipping.country
    && billingName.first === recipient.first
    && billingName.last === recipient.last
    && billingEmail === email
    && billingPhone === phone
  )
  const payload = {
    order_id: String(order.id),
    order_date: createdAt.toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: pickupLocation,
    billing_customer_name: billingName.first,
    billing_last_name: billingName.last,
    billing_address: billing.line1,
    billing_address_2: billing.line2 ?? '',
    billing_city: billing.city,
    billing_pincode: billing.postalCode,
    billing_state: billing.state,
    billing_country: billing.country,
    billing_email: billingEmail,
    billing_phone: billingPhone,
    shipping_is_billing: billingMatchesShipping,
    order_items: orderItems,
    payment_method: paymentMethod,
    sub_total: moneyFromCents(netSubtotalCents),
    total_discount: moneyFromCents(discountCents),
    shipping_charges: moneyFromCents(shippingCents),
    ...packageDetails,
  }

  if (!billingMatchesShipping) {
    payload.shipping_customer_name = recipient.first
    payload.shipping_last_name = recipient.last
    payload.shipping_address = shipping.line1
    payload.shipping_address_2 = shipping.line2 ?? ''
    payload.shipping_city = shipping.city
    payload.shipping_pincode = shipping.postalCode
    payload.shipping_state = shipping.state
    payload.shipping_country = shipping.country
    payload.shipping_email = email
    payload.shipping_phone = phone
  }

  return { payload, payment }
}

const retryDelay = (attemptCount) => Math.min(
  RETRY_DELAY_BASE_MS * (2 ** Math.max(0, attemptCount - 1)),
  RETRY_DELAY_MAX_MS,
)

const classifyProviderFailure = (error) => {
  if (error?.code === 'SHIPROCKET_CONFIG_MISSING' || error?.code === 'SHIPROCKET_INVALID_REQUEST') {
    return { status: 'FAILED', message: 'Shiprocket configuration or request is invalid.' }
  }
  if (error?.code === 'SHIPROCKET_AUTH_UNAVAILABLE' || error?.code === 'SHIPROCKET_AUTH_FAILED') {
    return { status: 'RETRY_SCHEDULED', message: 'Shiprocket authentication failed before order submission.' }
  }
  if (
    error?.code === 'SHIPROCKET_REQUEST_FAILED'
    && Number.isInteger(error.statusCode)
    && error.statusCode >= 400
    && error.statusCode < 500
    && error.statusCode !== 408
  ) {
    if (error.statusCode === 429) {
      return { status: 'RETRY_SCHEDULED', message: 'Shiprocket rate-limited the order before accepting it.' }
    }
    return { status: 'FAILED', message: `Shiprocket rejected the order (HTTP ${error.statusCode}).` }
  }
  return {
    status: 'RECONCILIATION_REQUIRED',
    message: 'Shiprocket order creation outcome is uncertain; reconcile with the provider before retrying.',
  }
}

export const createShipmentProcessor = ({
  prismaClient,
  shiprocketClient: client = shiprocketClient,
  env = process.env,
  clock = () => new Date(),
  createLeaseToken = () => crypto.randomUUID(),
} = {}) => {
  if ((prismaClient && !prismaClient.shipment) || typeof client?.createCustomOrder !== 'function') {
    throw new TypeError('Prisma and a Shiprocket client are required')
  }

  const getPrismaClient = async () => {
    if (prismaClient) return prismaClient
    const loaded = await import('../lib/prisma.js')
    return loaded.default
  }

  const saveOutcome = async (database, shipmentId, leaseToken, data) => {
    const update = await database.shipment.updateMany({
      where: { id: shipmentId, status: 'PROCESSING', processingLeaseToken: leaseToken },
      data: {
        ...data,
        processingStartedAt: null,
        processingLeaseToken: null,
      },
    })
    return update.count === 1
  }

  const failSafely = async (database, shipment, leaseToken, error) => {
    const now = clock()
    const details = classifyProviderFailure(error)
    const data = {
      status: details.status,
      lastError: details.message,
    }
    if (details.status === 'RETRY_SCHEDULED') {
      data.nextAttemptAt = new Date(now.getTime() + retryDelay(shipment.attemptCount))
    }
    const saved = await saveOutcome(database, shipment.id, leaseToken, data)
    return saved
      ? { outcome: details.status, shipmentId: shipment.id, error: details.message }
      : { outcome: 'LEASE_LOST', shipmentId: shipment.id }
  }

  const processShipment = async (shipmentId) => {
    if (!Number.isSafeInteger(shipmentId) || shipmentId < 1) {
      throw new TypeError('A valid shipment ID is required')
    }

    const database = await getPrismaClient()
    const now = clock()
    const leaseToken = createLeaseToken()
    const claim = await database.shipment.updateMany({
      where: {
        id: shipmentId,
        status: { in: CLAIMABLE_STATUSES },
        nextAttemptAt: { lte: now },
        processingLeaseToken: null,
        processingStartedAt: null,
        packageConfirmedAt: { not: null },
        packageConfirmedById: { not: null },
        packageWeightKg: { not: null },
        packageLengthCm: { not: null },
        packageBreadthCm: { not: null },
        packageHeightCm: { not: null },
      },
      data: {
        status: 'PROCESSING',
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        processingStartedAt: now,
        processingLeaseToken: leaseToken,
      },
    })

    if (claim.count !== 1) {
      const current = await database.shipment.findUnique({
        where: { id: shipmentId },
        select: { status: true, processingStartedAt: true, processingLeaseToken: true },
      })
      if (!current) return { outcome: 'NOT_FOUND', shipmentId }
      if (current.processingLeaseToken || current.processingStartedAt || current.status === 'PROCESSING') {
        return { outcome: 'ALREADY_CLAIMED', shipmentId }
      }
      return { outcome: 'INELIGIBLE', shipmentId }
    }

    let shipment
    try {
      shipment = await database.shipment.findUnique({
        where: { id: shipmentId },
        include: {
          order: {
            include: {
              items: {
                include: { product: true, variant: true },
                orderBy: { id: 'asc' },
              },
              payments: true,
              user: { select: { email: true } },
            },
          },
        },
      })
    } catch {
      const saved = await saveOutcome(database, shipmentId, leaseToken, {
        status: 'RETRY_SCHEDULED',
        nextAttemptAt: new Date(clock().getTime() + RETRY_DELAY_BASE_MS),
        lastError: 'The order could not be loaded for shipment processing.',
      })
      return saved
        ? { outcome: 'RETRY_SCHEDULED', shipmentId, error: 'The order could not be loaded for shipment processing.' }
        : { outcome: 'LEASE_LOST', shipmentId }
    }

    if (!shipment) {
      const saved = await saveOutcome(database, shipmentId, leaseToken, {
        status: 'FAILED',
        lastError: 'The claimed shipment could not be found.',
      })
      return saved
        ? { outcome: 'FAILED', shipmentId, error: 'The claimed shipment could not be found.' }
        : { outcome: 'LEASE_LOST', shipmentId }
    }

    if (shipment.shiprocketOrderId || shipment.shiprocketShipmentId) {
      const message = 'Existing Shiprocket identifiers require reconciliation before another submission.'
      const saved = await saveOutcome(database, shipmentId, leaseToken, {
        status: 'RECONCILIATION_REQUIRED',
        lastError: message,
      })
      return saved
        ? { outcome: 'RECONCILIATION_REQUIRED', shipmentId, error: message }
        : { outcome: 'LEASE_LOST', shipmentId }
    }

    let builtOrder
    try {
      builtOrder = buildCustomOrder(shipment.order, shipment, env)
    } catch (error) {
      if (!(error instanceof ShipmentValidationError)) throw error
      const saved = await saveOutcome(database, shipmentId, leaseToken, {
        status: 'FAILED',
        lastError: error.message,
      })
      return saved
        ? { outcome: 'FAILED', shipmentId, error: error.message }
        : { outcome: 'LEASE_LOST', shipmentId }
    }

    let response
    try {
      response = await client.createCustomOrder(builtOrder.payload)
    } catch (error) {
      return failSafely(database, shipment, leaseToken, error)
    }

    const validResponse = response && typeof response === 'object' && !Array.isArray(response)
    const providerOrderId = validResponse ? identifier(response.order_id) : null
    const providerShipmentId = validResponse ? identifier(response.shipment_id) : null
    const completeResponse = Boolean(providerOrderId && providerShipmentId)
    const data = {
      status: completeResponse ? 'CREATED' : 'RECONCILIATION_REQUIRED',
      lastError: completeResponse ? null : 'SHIPROCKET_RESPONSE_INCOMPLETE',
    }
    if (providerOrderId) data.shiprocketOrderId = providerOrderId
    if (providerShipmentId) data.shiprocketShipmentId = providerShipmentId
    if (completeResponse) {
      const awbCode = nonEmptyString(response.awb_code)
      const courierName = nonEmptyString(response.courier_name)
      const trackingUrl = nonEmptyString(response.tracking_url)
      if (awbCode) {
        data.awbCode = awbCode
        data.awbNormalized = awbCode.replace(/\s+/g, '').toUpperCase()
      }
      if (courierName) data.courierName = courierName
      if (trackingUrl) data.trackingUrl = trackingUrl
    }

    let saved
    try {
      saved = await saveOutcome(database, shipmentId, leaseToken, data)
    } catch {
      const reconciliation = {
        status: 'RECONCILIATION_REQUIRED',
        lastError: PERSISTENCE_FAILURE_CODE,
      }
      if (providerOrderId) reconciliation.shiprocketOrderId = providerOrderId
      if (providerShipmentId) reconciliation.shiprocketShipmentId = providerShipmentId

      // PROCESSING is never reclaimed automatically; recovery requires controlled provider reconciliation.
      try {
        saved = await saveOutcome(database, shipmentId, leaseToken, reconciliation)
      } catch {
        const error = new Error('Provider acceptance requires shipment reconciliation; persistence failed.')
        error.code = PERSISTENCE_FAILURE_CODE
        throw error
      }
      if (saved) return { outcome: 'RECONCILIATION_REQUIRED', shipmentId, error: PERSISTENCE_FAILURE_CODE }
      return { outcome: 'LEASE_LOST', shipmentId }
    }

    if (!saved) return { outcome: 'LEASE_LOST', shipmentId }
    return completeResponse
      ? {
          outcome: 'CREATED',
          shipmentId,
          shiprocketOrderId: providerOrderId,
          shiprocketShipmentId: providerShipmentId,
          paymentId: builtOrder.payment.id,
        }
      : { outcome: 'RECONCILIATION_REQUIRED', shipmentId, error: 'SHIPROCKET_RESPONSE_INCOMPLETE' }
  }

  return Object.freeze({ processShipment })
}
