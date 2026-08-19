import prisma from '../lib/prisma.js'
import bcrypt from 'bcryptjs'

const sizes = ['S', 'M', 'L']
const colors = ['Black', 'Navy', 'Charcoal', 'Ivory']
const orderStatuses = ['PLACED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']

const buildDate = (daysAgo, hoursAgo = 0) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(Math.max(0, 23 - hoursAgo), 0, 0, 0)
  return date
}

async function main() {
  console.log('?? Seeding full catalog, customers, variants, orders, and status history...')
  await prisma.$connect()

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })
  if (!adminUser) {
    throw new Error('No admin user found. Run node prisma/seed.js first.')
  }

  await prisma.orderStatusHistory.deleteMany({})
  await prisma.orderItem.deleteMany({})
  await prisma.order.deleteMany({})
  await prisma.productVariant.deleteMany({})
  await prisma.user.deleteMany({ where: { role: 'CUSTOMER' } })

  const products = await prisma.product.findMany({
    select: { id: true, name: true, slug: true, price: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!products.length) {
    throw new Error('No products found. Run node prisma/seed.js first.')
  }

  const createdVariants = []
  let variantCount = 0
  for (const product of products) {
    const variantBlueprints = [
      { size: 'S', color: 'Navy' },
      { size: 'M', color: 'Black' },
      { size: 'L', color: 'Charcoal' },
    ]

    for (const [index, blueprint] of variantBlueprints.entries()) {
      const sku = `SKU-${product.slug}-${blueprint.size}-${blueprint.color}`.slice(0, 60)
      const quantityOnHand = index === 0 ? 0 : index === 1 ? 2 : 8
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku,
          size: blueprint.size,
          color: blueprint.color,
          priceOverride: Number(product.price) + index * 120,
          quantityOnHand,
          reorderThreshold: 4,
          status: 'ACTIVE',
        },
      })
      createdVariants.push(variant)
      variantCount += 1
      if (index === 2) {
        break
      }
    }
  }

  console.log(`  ? Ensured variants: ${variantCount}`)

  const customerEmails = Array.from({ length: 10 }, (_, i) => `customer${i + 1}@valerion.test`)
  const customers = []
  for (const email of customerEmails) {
    const hashed = await bcrypt.hash('customer123', 10)
    const customer = await prisma.user.create({
      data: {
        name: email.split('@')[0],
        email,
        password: hashed,
        role: 'CUSTOMER',
      },
      select: { id: true, name: true, email: true },
    })
    customers.push(customer)
  }
  console.log(`  ? Customers: ${customers.length}`)

  const orderCountTarget = 18
  let createdOrders = 0

  for (let index = 0; index < orderCountTarget; index += 1) {
    const customer = customers[index % customers.length]
    const status = orderStatuses[index % orderStatuses.length]
    const orderDate = buildDate(index < 6 ? 0 : index < 12 ? 7 : 21, index < 6 ? 0 : 3)
    const itemCount = index % 3 === 0 ? 3 : index % 3 === 1 ? 2 : 1
    const chosenVariants = []

    for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
      const variant = createdVariants[(index + itemIndex) % createdVariants.length]
      if (!variant) continue
      chosenVariants.push(variant)
    }

    if (!chosenVariants.length) continue

    const total = chosenVariants.reduce((sum, variant, itemIndex) => {
      const basePrice = Number(products.find((product) => product.id === variant.productId)?.price || 0)
      const variantPrice = Number(variant.priceOverride ?? basePrice)
      const quantity = itemIndex % 2 === 0 ? 1 : 2
      return sum + variantPrice * quantity
    }, 0)

    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        status,
        totalPrice: Number(total.toFixed(2)),
        currency: 'INR',
        createdAt: orderDate,
        updatedAt: orderDate,
      },
    })

    for (const [itemIndex, variant] of chosenVariants.entries()) {
      const product = products.find((entry) => entry.id === variant.productId)
      const unitPrice = Number(variant.priceOverride ?? product?.price ?? 0)
      const quantity = itemIndex % 2 === 0 ? 1 : 2
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: variant.productId,
          quantity,
          price: Number((unitPrice * quantity).toFixed(2)),
          createdAt: orderDate,
          updatedAt: orderDate,
        },
      })
    }

    const historyStatuses = status === 'DELIVERED'
      ? ['PLACED', 'PACKED', 'SHIPPED', 'DELIVERED']
      : status === 'SHIPPED'
        ? ['PLACED', 'PACKED', 'SHIPPED']
        : status === 'PACKED'
          ? ['PLACED', 'PACKED']
          : ['PLACED']

    for (const [historyIndex, historyStatus] of historyStatuses.entries()) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: historyStatus,
          note: `${historyStatus} via seeded workflow`,
          changedById: adminUser.id,
          createdAt: new Date(orderDate.getTime() + historyIndex * 60 * 60 * 1000),
        },
      })
    }

    createdOrders += 1
  }

  console.log(`  ? Created orders: ${createdOrders}`)

  const counts = {
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    customers: await prisma.user.count({ where: { role: 'CUSTOMER' } }),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
    orderHistory: await prisma.orderStatusHistory.count(),
    lowStockVariants: await prisma.productVariant.count({ where: { quantityOnHand: { lt: 4 } } }),
  }

  console.log('?? Counts after seeding:', counts)
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
