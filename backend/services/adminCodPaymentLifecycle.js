const COD_MAX_TOTAL_CENTS = 5_000_000

const lifecycleError = (statusCode, message) => Object.assign(new Error(message), { statusCode })

const amountInCents = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const scaled = value * 100
  const cents = Math.round(scaled)
  return Number.isSafeInteger(cents) && Math.abs(scaled - cents) < 1e-6 ? cents : null
}

export const cancelPendingCodPayment = async (transactionClient, order) => {
  const payments = order.payments || []
  const codPayments = payments.filter((payment) => payment.provider === 'COD')
  if (codPayments.length === 0) return false
  if (payments.length !== 1 || codPayments.length !== 1) {
    throw lifecycleError(409, 'Order has an invalid COD payment state')
  }

  const payment = codPayments[0]
  if (payment.status === 'COD_COLLECTED' || payment.status === 'REFUNDED') {
    throw lifecycleError(409, 'Collected COD orders cannot be cancelled without a refund process')
  }
  if (payment.status === 'CANCELLED') return true
  if (payment.status !== 'PENDING_COLLECTION') {
    throw lifecycleError(409, 'COD payment cannot be cancelled from its current state')
  }

  const updated = await transactionClient.payment.updateMany({
    where: {
      id: payment.id,
      orderId: order.id,
      provider: 'COD',
      status: 'PENDING_COLLECTION',
    },
    data: { status: 'CANCELLED' },
  })
  if (updated.count !== 1) {
    throw lifecycleError(409, 'COD payment state changed concurrently; refresh and retry cancellation')
  }
  return false
}

export const cancelOrderWithCodPayment = async (transactionClient, order, { note, adminId } = {}) => {
  const alreadyCancelled = await cancelPendingCodPayment(transactionClient, order)
  if (alreadyCancelled) return order

  const updatedOrder = await transactionClient.order.update({
    where: { id: order.id },
    data: { status: 'CANCELLED' },
    include: {
      user: true,
      items: { include: { product: true, variant: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  })
  await transactionClient.orderStatusHistory.create({
    data: {
      orderId: order.id,
      status: 'CANCELLED',
      note,
      changedById: adminId,
    },
  })
  return updatedOrder
}

export const createAdminCodCollectionHandler = ({
  prismaClient,
  storeScope,
  clock = () => new Date(),
} = {}) => {
  if (
    typeof prismaClient?.$transaction !== 'function'
    || typeof prismaClient?.order?.findFirst !== 'function'
    || typeof storeScope !== 'function'
    || typeof clock !== 'function'
  ) {
    throw new TypeError('Prisma transactions, order access, store scope, and clock are required')
  }

  return async (req, res, next) => {
    try {
      const orderId = Number(req.params.id)
      if (!Number.isSafeInteger(orderId) || orderId < 1) {
        return res.status(400).json({ message: 'Invalid order ID' })
      }

      const adminId = req.user?.id
      if (!Number.isSafeInteger(adminId) || adminId < 1) {
        return res.status(401).json({ message: 'Authenticated administrator identity is unavailable' })
      }

      const body = req.body
      if (
        !body
        || typeof body !== 'object'
        || Array.isArray(body)
        || Object.keys(body).length !== 2
        || body.confirmCashReconciled !== true
        || !Object.hasOwn(body, 'reconciledAmount')
      ) {
        return res.status(400).json({
          message: 'Confirm cash reconciliation and provide the reconciled amount',
        })
      }

      const result = await prismaClient.$transaction(async (transaction) => {
        const order = await transaction.order.findFirst({
          where: storeScope(req, { id: orderId }),
          include: {
            payments: true,
            shipment: { select: { trackingStatus: true } },
          },
        })
        if (!order) throw lifecycleError(404, 'Order not found')
        if (!order.shipment) throw lifecycleError(409, 'A delivered shipment is required to confirm COD collection')
        if (order.shipment.trackingStatus?.trim().toUpperCase() !== 'DELIVERED') {
          throw lifecycleError(409, 'COD collection can be confirmed only after the shipment is delivered')
        }

        const payments = order.payments || []
        if (
          payments.length !== 1
          || payments[0].provider !== 'COD'
        ) {
          throw lifecycleError(409, 'Order does not have a single COD collection obligation')
        }
        const payment = payments[0]
        if (payment.status !== 'PENDING_COLLECTION') {
          throw lifecycleError(409, 'COD payment is not pending collection or was already confirmed')
        }

        const paymentCents = amountInCents(payment.amount)
        const orderCents = amountInCents(order.totalPrice)
        const reconciledCents = amountInCents(body.reconciledAmount)
        if (
          payment.currency !== 'INR'
          || order.currency !== 'INR'
          || paymentCents === null
          || paymentCents <= 0
          || paymentCents >= COD_MAX_TOTAL_CENTS
          || orderCents !== paymentCents
          || reconciledCents !== paymentCents
        ) {
          throw lifecycleError(409, 'Reconciled cash must exactly match the outstanding COD amount')
        }

        const updated = await transaction.payment.updateMany({
          where: {
            id: payment.id,
            orderId: order.id,
            provider: 'COD',
            status: 'PENDING_COLLECTION',
            amount: payment.amount,
            codCollectedAt: null,
            codCollectedById: null,
          },
          data: {
            status: 'COD_COLLECTED',
            codCollectedAt: clock(),
            codCollectedById: adminId,
          },
        })
        if (updated.count !== 1) {
          throw lifecycleError(409, 'COD payment state changed concurrently; refresh and retry')
        }

        return { orderId: order.id, paymentId: payment.id, amount: payment.amount }
      }, { isolationLevel: 'Serializable' })

      return res.json({
        success: true,
        orderId: result.orderId,
        paymentId: result.paymentId,
        paymentStatus: 'COD_COLLECTED',
        amount: result.amount,
        currency: 'INR',
      })
    } catch (error) {
      if (error?.statusCode) return res.status(error.statusCode).json({ message: error.message })
      if (error?.code === 'P2034') {
        return res.status(409).json({ message: 'COD payment state changed concurrently; refresh and retry' })
      }
      return next(error)
    }
  }
}
