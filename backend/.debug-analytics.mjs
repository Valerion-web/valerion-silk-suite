import 'dotenv/config'
import prisma from './lib/prisma.js'
const today = new Date()
const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)
const to = new Date(today)
to.setHours(23, 59, 59, 999)
const orders = await prisma.order.findMany({
  where: { createdAt: { gte: from, lte: to } },
  include: { items: { include: { product: true } }, user: true },
})
console.log('currentOrders', orders.length)
if (orders.length > 0) {
  console.log(JSON.stringify(orders.slice(0, 3).map((o) => ({
    id: o.id,
    createdAt: o.createdAt.toISOString(),
    totalPrice: o.totalPrice.toString(),
    status: o.status,
    items: o.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      price: i.price.toString(),
      revenue: (Number(i.price) * i.quantity).toFixed(2),
      productName: i.product?.name || null,
    })),
  })), null, 2))
}
const allOrders = await prisma.order.findMany({ include: { items: { include: { product: true } }, user: true } })
console.log('allOrders', allOrders.length)
const products = await prisma.product.findMany({ include: { category: true } })
console.log('products', products.length)
if (products.length > 0) {
  console.log(JSON.stringify(products.slice(0, 5).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price.toString(),
    countInStock: p.countInStock,
    category: p.category?.name || null,
  })), null, 2))
}
await prisma.$disconnect()
