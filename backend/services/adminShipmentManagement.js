export const createAdminShipmentOperationsHandler = ({
  prismaClient,
  shipmentOperations,
  storeScope,
} = {}) => {
  if (
    !prismaClient?.shipment
    || typeof shipmentOperations?.getShipmentOperations !== 'function'
    || typeof storeScope !== 'function'
  ) {
    throw new TypeError('Prisma, shipment operations, and admin store scope are required')
  }

  return async (req, res, next) => {
    try {
      const shipmentId = Number(req.params.id)
      if (!Number.isSafeInteger(shipmentId) || shipmentId < 1) {
        return res.status(400).json({ message: 'Invalid shipment ID' })
      }

      const visible = await prismaClient.shipment.findFirst({
        where: { id: shipmentId, order: storeScope(req) },
        select: { id: true },
      })
      if (!visible) return res.status(404).json({ message: 'Shipment not found' })

      const shipment = await shipmentOperations.getShipmentOperations(shipmentId)
      if (!shipment) return res.status(404).json({ message: 'Shipment not found' })
      return res.json({ shipment })
    } catch (error) {
      return next(error)
    }
  }
}
