export const queueShipment = (transactionClient, orderId) => {
  if (!transactionClient?.shipment || !Number.isSafeInteger(orderId) || orderId < 1) {
    throw new TypeError('A transaction client and valid order ID are required')
  }

  return transactionClient.shipment.upsert({
    where: { orderId },
    create: { orderId },
    update: {},
  })
}
