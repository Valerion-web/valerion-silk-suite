import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg({
  pool,
})

const prisma = new PrismaClient({
  adapter,
})

async function cleanup() {
  console.log('Cleaning up test products...')

  try {
    // Delete the "Blue Silk Saree" product by slug
    const deleted = await prisma.product.deleteMany({
      where: {
        slug: 'blue-silk-saree',
      },
    })

    if (deleted.count > 0) {
      console.log(`✓ Deleted ${deleted.count} test product(s): "Blue Silk Saree"`)
    } else {
      console.log('No test products found to delete.')
    }

    // Verify only menswear products remain
    const allProducts = await prisma.product.findMany({
      include: { category: true },
    })

    console.log(`\n✓ Database now contains ${allProducts.count} products:`)
    for (const product of allProducts) {
      console.log(
        `  - ${product.name} (${product.category?.name || 'Uncategorized'})`
      )
    }

    const menswearCategories = [
      'Luxury Suits',
      'Premium Blazers',
      'Formal Shirts',
      'Trousers',
      'Accessories',
    ]
    const isAllMenswear = allProducts.every((p) =>
      menswearCategories.includes(p.category?.name)
    )

    if (isAllMenswear) {
      console.log('\n✓ All products are menswear items.')
    } else {
      console.warn('\n⚠ Warning: Some products are not menswear.')
    }
  } catch (error) {
    console.error('Cleanup failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

cleanup()
