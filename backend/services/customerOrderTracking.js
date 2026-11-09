export const createOrderTrackingHandler = ({ prismaClient } = {}) => {
  if (!prismaClient?.order) throw new TypeError('Prisma order access is required')

  return async (req, res, next) => {
    try {
      const orderId = Number(req.params.id)
      if (!Number.isSafeInteger(orderId) || orderId < 1) {
        return res.status(400).json({ message: 'Invalid order ID' })
      }

      const order = await prismaClient.order.findFirst({
        where: { id: orderId, userId: req.user.id, storeId: req.store.id },
        select: {
          id: true,
          status: true,
          createdAt: true,
          currency: true,
          statusHistory: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, status: true, createdAt: true },
          },
          shipment: {
            select: {
              awbCode: true,
              courierName: true,
              trackingStatus: true,
              trackingStatusAt: true,
              estimatedDeliveryAt: true,
              trackingEvents: {
                orderBy: { occurredAt: 'asc' },
                select: {
                  id: true,
                  status: true,
                  activity: true,
                  location: true,
                  occurredAt: true,
                },
              },
            },
          },
        },
      })
      if (!order) return res.status(404).json({ message: 'Order not found' })

      return res.json({
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        currency: order.currency,
        statusHistory: order.statusHistory,
        shipment: order.shipment
          ? {
              awbCode: order.shipment.awbCode,
              courierName: order.shipment.courierName,
              currentStatus: order.shipment.trackingStatus,
              currentStatusAt: order.shipment.trackingStatusAt,
              estimatedDeliveryAt: order.shipment.estimatedDeliveryAt,
              events: order.shipment.trackingEvents.map((event) => ({
                id: event.id,
                status: event.status,
                activity: event.activity,
                location: event.location,
                occurredAt: event.occurredAt,
              })),
            }
          : null,
      })
    } catch (error) {
      return next(error)
    }
  }
}
