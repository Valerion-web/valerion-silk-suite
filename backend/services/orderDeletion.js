export const deleteOrderIfUnshipped = async (transactionClient, orderId) => {
  const shipment = await transactionClient.shipment.findUnique({
    where: { orderId },
    select: { id: true },
  })
  if (shipment) return false

  await transactionClient.orderItem.deleteMany({ where: { orderId } })
  await transactionClient.order.delete({ where: { id: orderId } })
  return true
}
