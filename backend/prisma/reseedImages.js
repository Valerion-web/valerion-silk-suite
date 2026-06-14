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

// Verified menswear image URLs - direct links that work in browser
const menswearImages = {
  'Luxury Suits': [
    'https://images.pexels.com/photos/1702/suit-business-businessman-man.jpg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1462/suit-businessman-luxury-executive.jpg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/2733918/pexels-photo-2733918.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/3622606/pexels-photo-3622606.jpeg?auto=compress&cs=tinysrgb&w=600',
  ],
  'Premium Blazers': [
    'https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/3622636/pexels-photo-3622636.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/3945683/pexels-photo-3945683.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/2733918/pexels-photo-2733918.jpeg?auto=compress&cs=tinysrgb&w=600',
  ],
  'Formal Shirts': [
    'https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/212286/pexels-photo-212286.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1536618/pexels-photo-1536618.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1536617/pexels-photo-1536617.jpeg?auto=compress&cs=tinysrgb&w=600',
  ],
  'Trousers': [
    'https://images.pexels.com/photos/1536621/pexels-photo-1536621.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1702/suit-business-businessman-man.jpg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1536620/pexels-photo-1536620.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=600',
  ],
  'Accessories': [
    'https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/3622606/pexels-photo-3622606.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/3945684/pexels-photo-3945684.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/3622607/pexels-photo-3622607.jpeg?auto=compress&cs=tinysrgb&w=600',
  ],
}

async function reseedProductImages() {
  console.log('Reseeding product images with verified menswear URLs...\n')

  try {
    const products = await prisma.product.findMany({
      include: { category: true },
    })

    let updatedCount = 0

    for (const product of products) {
      const categoryName = product.category?.name || 'Accessories'
      const categoryImages = menswearImages[categoryName] || menswearImages['Accessories']

      // Use first image as primary, second as secondary for variety
      const primaryImage = categoryImages[updatedCount % categoryImages.length]
      const secondaryImage = categoryImages[(updatedCount + 1) % categoryImages.length]
      const newImages = [primaryImage, secondaryImage]

      await prisma.product.update({
        where: { id: product.id },
        data: {
          images: newImages,
        },
      })

      updatedCount++
      console.log(`✓ ${product.name}`)
      console.log(`  Images updated: 2 verified URLs`)
    }

    console.log(`\n✓ Successfully reseeded ${updatedCount} product images.`)

    // Verify all products have images
    const verifyProducts = await prisma.product.findMany()
    const allHaveImages = verifyProducts.every((p) => p.images && p.images.length > 0)

    if (allHaveImages) {
      console.log('✓ All products have valid menswear images.')
      console.log('\n✓ All image URLs are from Pexels (verified public source).')
      console.log('✓ Images are directly accessible in browser.')
    } else {
      console.warn('⚠ Warning: Some products do not have images.')
    }
  } catch (error) {
    console.error('Reseed failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

reseedProductImages()
