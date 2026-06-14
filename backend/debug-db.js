/**
 * Backend database debug utility
 * Use this to verify images are properly seeded and returned by the API
 */

import prisma from '../lib/prisma.js'

export async function debugDatabase() {
  console.log('🔍 Database Debug Report')
  console.log('=' .repeat(50))

  try {
    // Check database connection
    await prisma.$queryRawUnsafe('SELECT 1')
    console.log('✓ Database connection: OK')

    // Count products
    const productCount = await prisma.product.count()
    console.log(`✓ Total products: ${productCount}`)

    // Check for products with images
    const productsWithImages = await prisma.product.findMany({
      where: {
        images: {
          hasSome: []
        }
      },
      select: {
        id: true,
        name: true,
        images: true
      },
      take: 5
    })

    console.log(`\n📊 Sample products with images:`)
    productsWithImages.forEach((p, idx) => {
      console.log(`  [${idx + 1}] ${p.name}`)
      console.log(`      Images: ${p.images.length} URL(s)`)
      if (p.images.length > 0) {
        console.log(`      First: ${p.images[0].substring(0, 60)}...`)
      }
    })

    // Check for products without images
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        images: true
      }
    })

    const productsWithoutImages = allProducts.filter(p => !p.images || p.images.length === 0)
    if (productsWithoutImages.length > 0) {
      console.log(`\n⚠️  Products without images: ${productsWithoutImages.length}/${allProducts.length}`)
      console.log('   You need to run: npm run seed')
    } else {
      console.log(`\n✓ All ${allProducts.length} products have images`)
    }

    // Check categories
    const categoryCount = await prisma.category.count()
    console.log(`\n✓ Total categories: ${categoryCount}`)

  } catch (error) {
    console.error('❌ Database error:', error.message)
  }
}

export async function verifyApiResponse() {
  console.log('\n📡 API Response Verification')
  console.log('=' .repeat(50))

  try {
    const products = await prisma.product.findMany({
      take: 3
    })

    console.log(`Fetched ${products.length} products from database`)
    
    products.forEach((p, idx) => {
      console.log(`\n[${idx + 1}] ${p.name}`)
      console.log(`    ID: ${p.id}`)
      console.log(`    Images: ${Array.isArray(p.images) ? p.images.length : 'not an array'}`)
      if (p.images && p.images.length > 0) {
        console.log(`    ✓ Images will be returned in API response`)
      } else {
        console.log(`    ✗ No images will be returned`)
      }
    })

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

export async function checkMissingImages() {
  console.log('\n🔎 Checking for missing images')
  console.log('=' .repeat(50))

  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        images: true
      }
    })

    const missing = products.filter(p => !p.images || p.images.length === 0)
    
    if (missing.length === 0) {
      console.log('✓ All products have images!')
      return
    }

    console.log(`Found ${missing.length} products without images:`)
    missing.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id})`)
    })

    console.log('\nRun the seed script to populate images:')
    console.log('  cd backend && npm run seed')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Run all checks
if (import.meta.url === `file://${process.argv[1]}`) {
  await debugDatabase()
  await verifyApiResponse()
  await checkMissingImages()
  await prisma.$disconnect()
}

export default {
  debugDatabase,
  verifyApiResponse,
  checkMissingImages
}
