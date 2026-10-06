import crypto from 'node:crypto'
import prisma from '../lib/prisma.js'
import { calculateTotals, finalizeOrderFromCart, preparePaymentPendingOrder } from './customerCommerceController.js'
import { createRazorpayOrder as createProviderOrder, findRazorpayOrderByReceipt, verifyRazorpaySignature } from '../services/razorpayService.js'

const PAYMENT_CURRENCY = 'INR'

const requestIdempotencyKey = (req) => {
  const value = req.body?.idempotencyKey
  return typeof value === 'string' ? value.trim() : ''
}

const requestPaymentAttemptKey = (req) => {
  const value = req.body?.paymentAttemptKey
  return typeof value === 'string' ? value.trim() : ''
}

const receiptFor = (paymentAttemptKey, userId, storeId) => {
  const digest = crypto.createHash('sha256').update(`${storeId}:${userId}:${paymentAttemptKey}`).digest('hex').slice(0, 32)
  return `haston_${digest}`
}

const publicPaymentOrder = (payment, receipt) => ({
  paymentId: payment.id,
  orderId: payment.orderId,
  paymentAttemptKey: payment.idempotencyKey,
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

const paymentConflict = (message) => Object.assign(new Error(message), { statusCode: 409 })

const assertPaymentMatchesOrder = (payment, order) => {
  if (payment.idempotencyKey === order.idempotencyKey) {
    throw paymentConflict('Payment attempt key must differ from the checkout idempotencyKey')
  }
  if (payment.provider !== 'RAZORPAY' || payment.orderId !== order.id || Number(payment.amount) !== Number(order.totalPrice) || payment.currency !== order.currency) {
    throw paymentConflict('Payment attempt does not match this checkout Order')
  }
}

const generatePaymentAttemptKey = (checkoutIdempotencyKey) => {
  let paymentAttemptKey
  do {
    paymentAttemptKey = `pa_${crypto.randomUUID()}`
  } while (paymentAttemptKey === checkoutIdempotencyKey)
  return paymentAttemptKey
}

const providerErrorText = (error) => [
  error?.message,
  error?.error?.description,
  error?.error?.reason,
  error?.response?.data?.error?.description,
].filter(Boolean).join(' ').toLowerCase()

const isDefiniteProviderRejection = (error) => {
  if (error?.code === 'RAZORPAY_CONFIG_MISSING' || error?.code === 'RAZORPAY_INVALID_PARAMETERS') return true
  const statusCode = Number(error?.statusCode ?? error?.response?.status)
  if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode >= 500 || [408, 409, 429].includes(statusCode)) return false
  const text = providerErrorText(error)
  if (text.includes('receipt') && /(duplicate|already|exists|processed|progress)/.test(text)) return false
  return true
}

export const createRazorpayOrder = async (req, res, next) => {
  const checkoutIdempotencyKey = requestIdempotencyKey(req)
  if (!checkoutIdempotencyKey) {
    res.status(400)
    return next(new Error('idempotencyKey is required'))
  }

  let paymentAttemptKey = requestPaymentAttemptKey(req)
  if (paymentAttemptKey && paymentAttemptKey === checkoutIdempotencyKey) {
    res.status(400)
    return next(new Error('paymentAttemptKey must differ from idempotencyKey'))
  }
  try {
    const prepared = await preparePaymentPendingOrder(req)
    if (prepared.order.status !== 'AWAITING_PAYMENT') {
      return next(paymentConflict(`Order ${prepared.order.id} is ${prepared.order.status} and cannot start a payment attempt`))
    }
    const order = prepared.order
    const amountInPaise = Math.round(Number(order.totalPrice) * 100)
    if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 1) {
      res.status(400)
      return next(new Error('Order total is not payable'))
    }

    let attemptResult
    try {
      attemptResult = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`
        const currentOrder = await tx.order.findFirst({ where: { id: order.id, userId: req.user.id, storeId: req.store.id } })
        if (!currentOrder) throw Object.assign(new Error('Order not found'), { statusCode: 404 })
        if (currentOrder.idempotencyKey !== checkoutIdempotencyKey || currentOrder.status !== 'AWAITING_PAYMENT') {
          throw paymentConflict(`Order ${currentOrder.id} is ${currentOrder.status} and cannot start a payment attempt`)
        }

        const capturedPayment = await tx.payment.findFirst({ where: { userId: req.user.id, storeId: req.store.id, orderId: currentOrder.id, status: 'CAPTURED' }, select: { id: true } })
        if (capturedPayment) throw paymentConflict('A payment for this Order is already captured')

        if (paymentAttemptKey) {
          const existingAttempt = await tx.payment.findUnique({
            where: { userId_storeId_idempotencyKey: { userId: req.user.id, storeId: req.store.id, idempotencyKey: paymentAttemptKey } },
          })
          if (existingAttempt) {
            assertPaymentMatchesOrder(existingAttempt, currentOrder)
            if (existingAttempt.status === 'FAILED' || existingAttempt.status === 'CANCELLED' || existingAttempt.status === 'REFUNDED') {
              throw paymentConflict('This Payment attempt is terminal; use a new paymentAttemptKey')
            }
            if (existingAttempt.providerOrderId) return { payment: existingAttempt, created: false }
            if (existingAttempt.status !== 'CREATED' && existingAttempt.status !== 'AUTHORIZED') {
              throw paymentConflict(`Payment attempt is ${existingAttempt.status} and cannot be reused`)
            }
            return { payment: existingAttempt, created: false }
          }
        }

        const unresolvedAttempt = await tx.payment.findFirst({
          where: { userId: req.user.id, storeId: req.store.id, orderId: currentOrder.id, status: { in: ['CREATED', 'AUTHORIZED'] } },
          orderBy: { createdAt: 'asc' },
        })
        if (unresolvedAttempt) {
          assertPaymentMatchesOrder(unresolvedAttempt, currentOrder)
          if (paymentAttemptKey && unresolvedAttempt.idempotencyKey !== paymentAttemptKey) {
            throw paymentConflict('An unresolved Payment attempt already exists for this Order')
          }
          paymentAttemptKey = unresolvedAttempt.idempotencyKey
          return { payment: unresolvedAttempt, created: false }
        }

        if (!paymentAttemptKey) paymentAttemptKey = generatePaymentAttemptKey(checkoutIdempotencyKey)
        const payment = await tx.payment.create({
          data: {
            orderId: currentOrder.id,
            userId: req.user.id,
            storeId: req.store.id,
            provider: 'RAZORPAY',
            amount: currentOrder.totalPrice,
            currency: currentOrder.currency,
            status: 'CREATED',
            idempotencyKey: paymentAttemptKey,
          },
        })
        return { payment, created: true }
      })
    } catch (error) {
      if (error?.code !== 'P2002' || !paymentAttemptKey) throw error
      const concurrentAttempt = await prisma.payment.findUnique({
        where: { userId_storeId_idempotencyKey: { userId: req.user.id, storeId: req.store.id, idempotencyKey: paymentAttemptKey } },
      })
      if (!concurrentAttempt) throw error
      assertPaymentMatchesOrder(concurrentAttempt, order)
      attemptResult = { payment: concurrentAttempt, created: false }
    }

    let payment = attemptResult.payment
    assertPaymentMatchesOrder(payment, order)
    if (payment.status === 'FAILED' || payment.status === 'CANCELLED' || payment.status === 'REFUNDED') {
      return next(paymentConflict('This Payment attempt is terminal; use a new paymentAttemptKey'))
    }
    if (payment.status === 'CAPTURED') {
      return next(paymentConflict(`Payment attempt is ${payment.status}`))
    }
    if (payment.status !== 'CREATED' && payment.status !== 'AUTHORIZED') {
      return next(paymentConflict(`Payment attempt is ${payment.status} and cannot be reused`))
    }

    const receipt = receiptFor(payment.idempotencyKey, req.user.id, req.store.id)
    if (payment.providerOrderId) return res.status(200).json(publicPaymentOrder(payment, receipt))

    let providerOrder = null
    if (!attemptResult.created) {
      try {
        providerOrder = await findRazorpayOrderByReceipt({ receipt, amount: amountInPaise, currency: order.currency })
      } catch (error) {
        return next(sanitizedProviderError(error))
      }
    }

    if (!providerOrder && payment.status === 'AUTHORIZED') {
      return next(paymentConflict('Payment is authorized but its Razorpay Order could not be recovered'))
    }

    let providerOrderCreated = false
    if (!providerOrder) {
      try {
        providerOrder = await createProviderOrder({ amountInPaise, currency: order.currency, receipt })
        providerOrderCreated = true
      } catch (providerError) {
        if (providerError?.code === 'RAZORPAY_CONFIG_MISSING' || providerError?.code === 'RAZORPAY_INVALID_PARAMETERS') {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } }).catch(() => {})
          return next(sanitizedProviderError(providerError))
        }

        try {
          providerOrder = await findRazorpayOrderByReceipt({ receipt, amount: amountInPaise, currency: order.currency })
        } catch {
          return next(sanitizedProviderError(providerError))
        }

        if (!providerOrder) {
          if (isDefiniteProviderRejection(providerError)) {
            await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } }).catch(() => {})
          }
          return next(sanitizedProviderError(providerError))
        }
      }
    }

    if (typeof providerOrder?.id !== 'string' || providerOrder.receipt !== receipt || Number(providerOrder.amount) !== amountInPaise || providerOrder.currency !== order.currency) {
      return next(paymentConflict('Recovered Razorpay Order does not match this Payment attempt'))
    }

    try {
      payment = await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: providerOrder.id } })
    } catch (saveError) {
      try {
        const recoveredOrder = await findRazorpayOrderByReceipt({ receipt, amount: amountInPaise, currency: order.currency })
        if (!recoveredOrder || recoveredOrder.id !== providerOrder.id) return next(sanitizedProviderError(saveError))
        payment = await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: recoveredOrder.id } })
      } catch {
        return next(sanitizedProviderError(saveError))
      }
    }

    return res.status(providerOrderCreated ? 201 : 200).json(publicPaymentOrder(payment, receipt))
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