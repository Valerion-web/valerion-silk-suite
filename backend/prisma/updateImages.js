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

// Menswear image URLs organized by category
const menswearImages = {
  'Luxury Suits': [
    'https://images.unsplash.com/photo-1591047990975-d91cebc2b878?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1583391733981-21db021dd98b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1505025114519-a9deb4aeffa5?auto=format&fit=crop&w=1200&q=80',
  ],
  'Premium Blazers': [
    'https://images.unsplash.com/photo-1591630874519-a5c9b0e2daf6?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1539533057592-4c69c773039a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  ],
  'Formal Shirts': [
    'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1602810316715-3788bba30f4e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1556821552-5ae0d47df277?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1597825120664-40f5218e5d2d?auto=format&fit=crop&w=1200&q=80',
  ],
  'Trousers': [
    'https://images.unsplash.com/photo-1542272604-787c62e50bbe?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1591047990975-d91cebc2b878?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1574886778489-79c3c50c9c78?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542272604-787c62e50bbe?auto=format&fit=crop&w=1200&q=80',
  ],
  'Accessories': [
    'https://images.unsplash.com/photo-1533558087405-91a86cc0e876?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1462946397868-3049fa8048af?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1559051615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517422745781-154e74424e97?auto=format&fit=crop&w=1200&q=80',
  ],
}

async function updateProductImages() {
  console.log('Updating product images with menswear URLs...\n')

  try {
    const products = await prisma.product.findMany({
      include: { category: true },
    })

    let updatedCount = 0

    for (const product of products) {
      const categoryName = product.category?.name || 'Accessories'
      const categoryImages = menswearImages[categoryName] || menswearImages['Accessories']

      // Select a random image for primary display, keep secondary
      const primaryImage = categoryImages[Math.floor(Math.random() * categoryImages.length)]
      const secondaryImage = categoryImages[(Math.floor(Math.random() * categoryImages.length))]
      const newImages = [primaryImage, secondaryImage]

      await prisma.product.update({
        where: { id: product.id },
        data: {
          images: newImages,
        },
      })

      updatedCount++
      console.log(`✓ Updated: ${product.name}`)
      console.log(`  Category: ${categoryName}`)
      console.log(`  Images: ${newImages.length}`)
    }

    console.log(`\n✓ Successfully updated ${updatedCount} product images.`)

    // Verify all products have images
    const verifyProducts = await prisma.product.findMany()
    const allHaveImages = verifyProducts.every((p) => p.images && p.images.length > 0)

    if (allHaveImages) {
      console.log('✓ All products have valid menswear images.')
    } else {
      console.warn('⚠ Warning: Some products do not have images.')
    }
  } catch (error) {
    console.error('Update failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

updateProductImages()
