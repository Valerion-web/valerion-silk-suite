import crypto from 'node:crypto'
import Razorpay from 'razorpay'

const PAYMENT_CURRENCY = 'INR'

const getWebhookSecret = () => process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null

const getRazorpayConfig = () => ({
  keyId: process.env.RAZORPAY_KEY_ID?.trim() || null,
  keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() || null,
})

export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  const { keySecret } = getRazorpayConfig()
  if (!keySecret || !orderId || !paymentId || !signature) return false
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex')
  const provided = Buffer.from(String(signature))
  if (provided.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), provided)
}

export const createRazorpayOrder = async ({ amountInPaise, receipt } = {}) => {
  const { keyId, keySecret } = getRazorpayConfig()
  if (!keyId || !keySecret) {
    throw Object.assign(new Error('Razorpay server configuration is unavailable'), { code: 'RAZORPAY_CONFIG_MISSING' })
  }

  if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 1 || typeof receipt !== 'string' || !receipt) {
    throw Object.assign(new Error('Invalid Razorpay order parameters'), { code: 'RAZORPAY_INVALID_PARAMETERS' })
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
  return razorpay.orders.create({ amount: amountInPaise, currency: PAYMENT_CURRENCY, receipt })
}

export const verifyRazorpayWebhookSignature = ({ rawBody, signature } = {}) => {
  const webhookSecret = getWebhookSecret()
  if (!webhookSecret || !Buffer.isBuffer(rawBody) || !signature || typeof signature !== 'string') return false

  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
  const provided = Buffer.from(signature.trim(), 'utf8')
  if (provided.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), provided)
}