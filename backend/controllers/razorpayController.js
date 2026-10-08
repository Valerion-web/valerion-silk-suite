import crypto from 'node:crypto'
import prisma from '../lib/prisma.js'
import {
  assertPaymentCheckoutSnapshotMatchesRequest,
  calculateTotals,
  createPaymentCheckoutSnapshot,
  finalizeOrderFromCart,
} from './customerCommerceController.js'
import {
  createRazorpayOrder as createProviderOrder,
  findRazorpayOrderByReceipt,
  verifyRazorpaySignature,
} from '../services/razorpayService.js'

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
  paymentAttemptKey: payment.paymentAttemptKey,
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

const isTerminalPaymentStatus = (status) => ['FAILED', 'CANCELLED', 'REFUNDED'].includes(status)

const isRecoverableProviderCreationFailure = (payment) => payment.status === 'FAILED'
  && !payment.providerOrderId
  && !payment.providerPaymentId
  && !payment.orderId

const providerOrderMatches = (providerOrder, { receipt, amountInPaise, currency }) =>
  typeof providerOrder?.id === 'string'
  && providerOrder.receipt === receipt
  && Number(providerOrder.amount) === amountInPaise
  && providerOrder.currency === currency

const persistProviderOrder = async (payment, providerOrder) => {
  const updated = await prisma.payment.updateMany({
    where: { id: payment.id, status: 'CREATED', providerOrderId: null },
    data: { providerOrderId: providerOrder.id },
  })
  if (updated.count === 1) return { ...payment, providerOrderId: providerOrder.id }

  const existing = await prisma.payment.findUnique({ where: { id: payment.id } })
  if (existing?.providerOrderId === providerOrder.id) return existing
  throw paymentConflict('Payment attempt changed while saving its Razorpay Order')
}

export const createRazorpayOrder = async (req, res, next) => {
  const idempotencyKey = requestIdempotencyKey(req)
  const paymentAttemptKey = requestPaymentAttemptKey(req)
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{1,128}$/.test(idempotencyKey)) {
    res.status(400)
    return next(new Error('A valid idempotencyKey is required'))
  }
  if (!paymentAttemptKey || !/^[A-Za-z0-9_-]{1,128}$/.test(paymentAttemptKey) || paymentAttemptKey === idempotencyKey) {
    res.status(400)
    return next(new Error('A distinct valid paymentAttemptKey is required'))
  }

  try {
    let attemptResult
    try {
      attemptResult = await prisma.$transaction(async (tx) => {
        const existingAttempt = await tx.payment.findUnique({
          where: { userId_storeId_paymentAttemptKey: { userId: req.user.id, storeId: req.store.id, paymentAttemptKey } },
        })
        if (existingAttempt) {
          await assertPaymentCheckoutSnapshotMatchesRequest(tx, req, existingAttempt)
          if (isTerminalPaymentStatus(existingAttempt.status) && !isRecoverableProviderCreationFailure(existingAttempt)) {
            throw paymentConflict('This payment attempt is terminal; use a new paymentAttemptKey')
          }
          return { payment: existingAttempt, created: false }
        }

        const finalizedOrder = await tx.order.findUnique({
          where: { userId_storeId_idempotencyKey: { userId: req.user.id, storeId: req.store.id, idempotencyKey } },
          select: { id: true },
        })
        if (finalizedOrder) throw paymentConflict('This checkout already has a finalized Order')

        const unresolvedAttempt = await tx.payment.findFirst({
          where: { userId: req.user.id, storeId: req.store.id, idempotencyKey, orderId: null, status: { in: ['CREATED', 'AUTHORIZED', 'CAPTURED'] } },
          orderBy: { createdAt: 'asc' },
        })
        if (unresolvedAttempt) throw paymentConflict('Another payment attempt for this checkout is unresolved')

        const totals = await calculateTotals(tx, req, req.body?.couponCode)
        const amountInPaise = Math.round(totals.total * 100)
        if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 1) throw Object.assign(new Error('Cart total is not payable'), { statusCode: 400 })

        const checkoutSnapshot = createPaymentCheckoutSnapshot(totals, req, idempotencyKey)
        const payment = await tx.payment.create({
          data: {
            userId: req.user.id,
            storeId: req.store.id,
            provider: 'RAZORPAY',
            amount: totals.total,
            currency: PAYMENT_CURRENCY,
            status: 'CREATED',
            idempotencyKey,
            paymentAttemptKey,
            checkoutSnapshot,
          },
        })
        return { payment, created: true }
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (!['P2002', 'P2034'].includes(error?.code)) throw error
      const existingAttempt = await prisma.payment.findUnique({
        where: { userId_storeId_paymentAttemptKey: { userId: req.user.id, storeId: req.store.id, paymentAttemptKey } },
      })
      if (!existingAttempt) throw paymentConflict('Another payment attempt for this checkout is being created')
      await prisma.$transaction((tx) => assertPaymentCheckoutSnapshotMatchesRequest(tx, req, existingAttempt))
      if (existingAttempt.idempotencyKey !== idempotencyKey || (isTerminalPaymentStatus(existingAttempt.status) && !isRecoverableProviderCreationFailure(existingAttempt))) {
        throw paymentConflict('paymentAttemptKey is associated with an incompatible or terminal attempt')
      }
      attemptResult = { payment: existingAttempt, created: false }
    }

    let payment = attemptResult.payment
    if (payment.idempotencyKey !== idempotencyKey) return next(paymentConflict('paymentAttemptKey is associated with a different checkout'))
    const recoverableCreationFailure = isRecoverableProviderCreationFailure(payment)
    if (isTerminalPaymentStatus(payment.status) && !recoverableCreationFailure) return next(paymentConflict('This payment attempt is terminal; use a new paymentAttemptKey'))

    const amountInPaise = Math.round(Number(payment.amount) * 100)
    const snapshotAmountInPaise = Math.round(Number(payment.checkoutSnapshot?.total) * 100)
    if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 1 || amountInPaise !== snapshotAmountInPaise || payment.checkoutSnapshot?.currency !== payment.currency) {
      return next(paymentConflict('Payment amount does not match its immutable checkout snapshot'))
    }

    const receipt = receiptFor(payment.paymentAttemptKey, req.user.id, req.store.id)
    if (payment.orderId || payment.providerOrderId) return res.status(200).json(publicPaymentOrder(payment, receipt))
    if (payment.status !== 'CREATED' && !recoverableCreationFailure) return next(paymentConflict(`Payment attempt is ${payment.status} and cannot create a Razorpay Order`))

    let providerOrder = null
    if (!attemptResult.created || recoverableCreationFailure) {
      try {
        providerOrder = await findRazorpayOrderByReceipt({ receipt, amount: amountInPaise, currency: payment.currency })
      } catch (error) {
        if (['RAZORPAY_RECEIPT_MISMATCH', 'RAZORPAY_RECEIPT_AMBIGUOUS'].includes(error?.code)) return next(paymentConflict(error.message))
        return next(sanitizedProviderError(error))
      }
      if (!providerOrder && recoverableCreationFailure) return next(paymentConflict('The failed payment attempt has no recoverable Razorpay Order; use a new paymentAttemptKey'))
      if (!providerOrder) return next(paymentConflict('Payment attempt creation is still in progress; retry with the same paymentAttemptKey'))
      if (recoverableCreationFailure) {
        const restored = await prisma.payment.updateMany({
          where: { id: payment.id, status: 'FAILED', providerOrderId: null, providerPaymentId: null, orderId: null },
          data: { providerOrderId: providerOrder.id, status: 'CREATED' },
        })
        if (restored.count !== 1) {
          const current = await prisma.payment.findUnique({ where: { id: payment.id } })
          if (current?.providerOrderId !== providerOrder.id) return next(paymentConflict('Payment attempt changed during receipt recovery'))
          payment = current
        } else {
          payment = { ...payment, providerOrderId: providerOrder.id, status: 'CREATED' }
        }
        return res.status(200).json(publicPaymentOrder(payment, receipt))
      }
    } else {
      try {
        providerOrder = await createProviderOrder({ amountInPaise, currency: payment.currency, receipt })
      } catch (providerError) {
        try {
          providerOrder = await findRazorpayOrderByReceipt({ receipt, amount: amountInPaise, currency: payment.currency })
        } catch (recoveryError) {
          if (['RAZORPAY_RECEIPT_MISMATCH', 'RAZORPAY_RECEIPT_AMBIGUOUS'].includes(recoveryError?.code)) return next(paymentConflict(recoveryError.message))
          await prisma.payment.updateMany({ where: { id: payment.id, status: 'CREATED', providerOrderId: null }, data: { status: 'FAILED' } }).catch(() => {})
          return next(sanitizedProviderError(providerError))
        }
        if (!providerOrder) {
          await prisma.payment.updateMany({ where: { id: payment.id, status: 'CREATED', providerOrderId: null }, data: { status: 'FAILED' } }).catch(() => {})
          return next(sanitizedProviderError(providerError))
        }
      }
    }

    if (!providerOrderMatches(providerOrder, { receipt, amountInPaise, currency: payment.currency })) {
      return next(paymentConflict('Razorpay Order does not match this Payment attempt'))
    }
    try {
      payment = await persistProviderOrder(payment, providerOrder)
    } catch (saveError) {
      try {
        const recoveredOrder = await findRazorpayOrderByReceipt({ receipt, amount: amountInPaise, currency: payment.currency })
        if (!recoveredOrder || recoveredOrder.id !== providerOrder.id) return next(sanitizedProviderError(saveError))
        payment = await persistProviderOrder(payment, recoveredOrder)
      } catch {
        return next(sanitizedProviderError(saveError))
      }
    }
    return res.status(attemptResult.created ? 201 : 200).json(publicPaymentOrder(payment, receipt))
  } catch (error) {
    return next(error?.statusCode ? error : sanitizedProviderError(error))
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
  if (payment.orderId) {
    return res.status(200).json({ success: true, orderId: payment.orderId, paymentStatus: payment.status })
  }
  if (payment.status === 'CREATED' && payment.providerOrderId && !payment.checkoutSnapshot) {
    return res.status(409).json({ message: 'This payment attempt predates immutable checkout snapshots and must be resolved before verification can continue' })
  }
  if (!payment.idempotencyKey || !payment.paymentAttemptKey || !payment.checkoutSnapshot) {
    return res.status(409).json({ message: 'Payment cannot be finalized' })
  }
  const storedAmountInPaise = Math.round(Number(payment.amount) * 100)
  const snapshotAmountInPaise = Math.round(Number(payment.checkoutSnapshot.total) * 100)
  if (!Number.isSafeInteger(storedAmountInPaise) || !Number.isSafeInteger(snapshotAmountInPaise)
    || storedAmountInPaise < 1 || storedAmountInPaise !== snapshotAmountInPaise
    || payment.checkoutSnapshot.currency !== payment.currency) {
    return res.status(409).json({ message: 'Payment amount does not match its immutable checkout snapshot' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentPayment = await tx.payment.findFirst({ where: { id: localPaymentId, userId: req.user.id, storeId: req.store.id } })
      if (!currentPayment || currentPayment.provider !== 'RAZORPAY' || currentPayment.providerOrderId !== razorpayOrderId) throw Object.assign(new Error('Payment verification failed'), { statusCode: 404 })
      if (currentPayment.orderId) return { orderId: currentPayment.orderId, paymentStatus: currentPayment.status }
      if (currentPayment.status !== 'CREATED' || (currentPayment.providerPaymentId && currentPayment.providerPaymentId !== razorpayPaymentId)) {
        throw Object.assign(new Error('Payment has already been finalized'), { statusCode: 409 })
      }
      if (!currentPayment.paymentAttemptKey || !currentPayment.checkoutSnapshot
        || currentPayment.paymentAttemptKey !== payment.paymentAttemptKey
        || Math.round(Number(currentPayment.amount) * 100) !== snapshotAmountInPaise
        || currentPayment.currency !== currentPayment.checkoutSnapshot.currency) {
        throw Object.assign(new Error('Payment attempt snapshot changed before verification'), { statusCode: 409 })
      }

      const claimed = await tx.payment.updateMany({
        where: { id: localPaymentId, userId: req.user.id, storeId: req.store.id, status: 'CREATED', providerPaymentId: null, orderId: null, paymentAttemptKey: currentPayment.paymentAttemptKey },
        data: { providerPaymentId: razorpayPaymentId, providerSignature: razorpaySignature, status: 'AUTHORIZED' },
      })
      if (claimed.count !== 1) {
        const finalizedPayment = await tx.payment.findUnique({ where: { id: localPaymentId } })
        if (finalizedPayment?.orderId) return { orderId: finalizedPayment.orderId, paymentStatus: finalizedPayment.status }
        throw Object.assign(new Error('Payment has already been finalized'), { statusCode: 409 })
      }

      const finalized = await finalizeOrderFromCart(tx, req, {
        idempotencyKey: currentPayment.idempotencyKey,
        requireIdempotency: true,
        checkoutSnapshot: currentPayment.checkoutSnapshot,
      })
      if (!finalized.created) return { checkoutConflict: true, paymentStatus: 'AUTHORIZED' }
      await tx.payment.update({ where: { id: localPaymentId }, data: { orderId: finalized.order.id } })
      return { orderId: finalized.order.id, paymentStatus: 'AUTHORIZED' }
    })
    if (result.checkoutConflict) {
      return res.status(409).json({ message: 'Another payment attempt already finalized this checkout; payment requires reconciliation', paymentStatus: result.paymentStatus })
    }
    return res.status(200).json({ success: true, orderId: result.orderId, paymentStatus: result.paymentStatus })
  } catch (error) {
    if (error?.code === 'P2002') {
      try {
        const recorded = await prisma.payment.updateMany({
          where: {
            id: localPaymentId,
            userId: req.user.id,
            storeId: req.store.id,
            provider: 'RAZORPAY',
            providerOrderId: razorpayOrderId,
            paymentAttemptKey: payment.paymentAttemptKey,
            status: 'CREATED',
            providerPaymentId: null,
            orderId: null,
          },
          data: { providerPaymentId: razorpayPaymentId, providerSignature: razorpaySignature, status: 'AUTHORIZED' },
        })
        if (recorded.count === 1) {
          return res.status(409).json({ message: 'Checkout already finalized by another payment attempt; this Payment requires reconciliation', paymentStatus: 'AUTHORIZED' })
        }
        const currentPayment = await prisma.payment.findFirst({ where: { id: localPaymentId, userId: req.user.id, storeId: req.store.id } })
        if (currentPayment?.orderId) return res.status(200).json({ success: true, orderId: currentPayment.orderId, paymentStatus: currentPayment.status })
      } catch {
        return res.status(409).json({ message: 'Payment finalization conflict; Payment requires reconciliation' })
      }
      return res.status(409).json({ message: 'Payment finalization conflict; Payment requires reconciliation' })
    }
    return res.status(error?.statusCode || 500).json({ message: error?.statusCode ? error.message : 'Payment finalization failed' })
  }
}