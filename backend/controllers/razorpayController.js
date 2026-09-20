import crypto from 'node:crypto'
import prisma from '../lib/prisma.js'
import { calculateTotals, finalizeOrderFromCart } from './customerCommerceController.js'
import { createRazorpayOrder as createProviderOrder, verifyRazorpaySignature } from '../services/razorpayService.js'

const PAYMENT_CURRENCY = 'INR'

const requestIdempotencyKey = (req) => {
  const value = req.body?.idempotencyKey
  return typeof value === 'string' ? value.trim() : ''
}

const receiptFor = (idempotencyKey, userId, storeId) => {
  const digest = crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16)
  return `haston_${storeId}_${userId}_${digest}`
}

const publicPaymentOrder = (payment, receipt) => ({
  paymentId: payment.id,
  razorpayOrderId: payment.providerOrderId,
  amount: Math.round(payment.amount * 100),
  currency: payment.currency,
  receipt,
})

const sanitizedProviderError = (error) => {
  const safeError = new Error('Unable to create Razorpay payment order')
  safeError.statusCode = error?.code === 'RAZORPAY_CONFIG_MISSING' ? 503 : 502
  return safeError
}

export const createRazorpayOrder = async (req, res, next) => {
  const idempotencyKey = requestIdempotencyKey(req)
  if (!idempotencyKey) {
    res.status(400)
    return next(new Error('idempotencyKey is required'))
  }

  try {
    const existingPayment = await prisma.payment.findUnique({
      where: { userId_storeId_idempotencyKey: { userId: req.user.id, storeId: req.store.id, idempotencyKey } },
    })
    if (existingPayment?.providerOrderId) {
      return res.status(200).json(publicPaymentOrder(existingPayment, receiptFor(idempotencyKey, req.user.id, req.store.id)))
    }
    if (existingPayment?.status === 'CREATED') {
      res.status(409)
      return next(new Error('Payment order creation is already in progress'))
    }

    const totals = await prisma.$transaction((tx) => calculateTotals(tx, req, req.body?.couponCode))
    const amountInPaise = Math.round(totals.total * 100)
    if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 1) {
      res.status(400)
      return next(new Error('Cart total is not payable'))
    }

    let payment
    if (existingPayment) {
      payment = await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { amount: totals.total, currency: PAYMENT_CURRENCY, status: 'CREATED', providerOrderId: null, providerPaymentId: null, providerSignature: null },
      })
    } else {
      try {
        payment = await prisma.payment.create({
          data: { userId: req.user.id, storeId: req.store.id, provider: 'RAZORPAY', amount: totals.total, currency: PAYMENT_CURRENCY, status: 'CREATED', idempotencyKey },
        })
      } catch (error) {
        if (error?.code !== 'P2002') throw error
        const concurrentPayment = await prisma.payment.findUnique({
          where: { userId_storeId_idempotencyKey: { userId: req.user.id, storeId: req.store.id, idempotencyKey } },
        })
        if (concurrentPayment?.providerOrderId) {
          return res.status(200).json(publicPaymentOrder(concurrentPayment, receiptFor(idempotencyKey, req.user.id, req.store.id)))
        }
        res.status(409)
        return next(new Error('Payment order creation is already in progress'))
      }
    }

    const receipt = receiptFor(idempotencyKey, req.user.id, req.store.id)
    try {
      const providerOrder = await createProviderOrder({ amountInPaise, receipt })
      const savedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: { providerOrderId: providerOrder.id, status: 'CREATED' },
      })
      return res.status(201).json(publicPaymentOrder(savedPayment, receipt))
    } catch (error) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } }).catch(() => {})
      return next(sanitizedProviderError(error))
    }
  } catch (error) {
    return next(error)
  }
}

export const verifyRazorpayPayment = async (req, res) => {
  const localPaymentId = Number(req.body?.paymentId)
  const razorpayPaymentId = typeof req.body?.razorpay_payment_id === 'string' ? req.body.razorpay_payment_id.trim() : ''
  const razorpayOrderId = typeof req.body?.razorpay_order_id === 'string' ? req.body.razorpay_order_id.trim() : ''
  const razorpaySignature = typeof req.body?.razorpay_signature === 'string' ? req.body.razorpay_signature.trim() : ''

  if (!Number.isInteger(localPaymentId) || localPaymentId < 1 || !/^[A-Za-z0-9_-]{1,128}$/.test(razorpayPaymentId) || !/^order_[A-Za-z0-9_-]{1,128}$/.test(razorpayOrderId) || !/^[a-f0-9]{64}$/i.test(razorpaySignature)) {
    return res.status(400).json({ message: 'Invalid payment verification request' })
  }

  const payment = await prisma.payment.findFirst({ where: { id: localPaymentId, userId: req.user.id, storeId: req.store.id } })
  if (!payment || payment.provider !== 'RAZORPAY' || payment.providerOrderId !== razorpayOrderId) {
    return res.status(404).json({ message: 'Payment verification failed' })
  }
  if (!verifyRazorpaySignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature })) {
    return res.status(400).json({ message: 'Payment verification failed' })
  }
  if (payment.providerPaymentId && payment.providerPaymentId !== razorpayPaymentId) {
    return res.status(409).json({ message: 'Payment verification conflict' })
  }
  if (!payment.idempotencyKey) {
    return res.status(409).json({ message: 'Payment cannot be finalized' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentPayment = await tx.payment.findFirst({ where: { id: localPaymentId, userId: req.user.id, storeId: req.store.id } })
      if (!currentPayment || currentPayment.provider !== 'RAZORPAY' || currentPayment.providerOrderId !== razorpayOrderId) throw Object.assign(new Error('Payment verification failed'), { statusCode: 404 })
      if (currentPayment.orderId) return { orderId: currentPayment.orderId, paymentStatus: currentPayment.status }
      if (currentPayment.status !== 'CREATED' || (currentPayment.providerPaymentId && currentPayment.providerPaymentId !== razorpayPaymentId)) {
        throw Object.assign(new Error('Payment has already been finalized'), { statusCode: 409 })
      }

      const currentTotals = await calculateTotals(tx, req, req.body?.couponCode)
      const currentAmountInPaise = Math.round(currentTotals.total * 100)
      const storedAmountInPaise = Math.round(Number(currentPayment.amount) * 100)
      if (!Number.isSafeInteger(currentAmountInPaise) || !Number.isSafeInteger(storedAmountInPaise) || currentAmountInPaise !== storedAmountInPaise) {
        throw Object.assign(new Error('Cart total no longer matches the payment amount; restart checkout'), { statusCode: 409 })
      }

      const claimed = await tx.payment.updateMany({
        where: { id: localPaymentId, userId: req.user.id, storeId: req.store.id, status: 'CREATED', providerPaymentId: null, orderId: null },
        data: { providerPaymentId: razorpayPaymentId, providerSignature: razorpaySignature, status: 'AUTHORIZED' },
      })
      if (claimed.count !== 1) {
        const finalizedPayment = await tx.payment.findUnique({ where: { id: localPaymentId } })
        if (finalizedPayment?.orderId) return { orderId: finalizedPayment.orderId, paymentStatus: finalizedPayment.status }
        throw Object.assign(new Error('Payment has already been finalized'), { statusCode: 409 })
      }

      const finalized = await finalizeOrderFromCart(tx, req, { idempotencyKey: currentPayment.idempotencyKey, requireIdempotency: true })
      await tx.payment.update({ where: { id: localPaymentId }, data: { orderId: finalized.order.id } })
      return { orderId: finalized.order.id, paymentStatus: 'AUTHORIZED' }
    })
    return res.status(200).json({ success: true, orderId: result.orderId, paymentStatus: result.paymentStatus })
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ message: 'Payment finalization conflict' })
    return res.status(error?.statusCode || 500).json({ message: error?.statusCode ? error.message : 'Payment finalization failed' })
  }
}