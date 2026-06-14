import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { generateSlug } from '../utils/generateSlug.js'

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

const categories = [
  { name: 'Luxury Suits', slug: 'luxury-suits', description: 'Impeccably tailored suiting for evenings, weddings, and formal events.' },
  { name: 'Premium Blazers', slug: 'premium-blazers', description: 'Refined blazers in luxurious fabrics for elevated day-to-night dressing.' },
  { name: 'Formal Shirts', slug: 'formal-shirts', description: 'Polished dress shirts designed for a sharp, modern silhouette.' },
  { name: 'Trousers', slug: 'trousers', description: 'Tailored trousers with premium finishes and exacting construction.' },
  { name: 'Accessories', slug: 'accessories', description: 'Signature accessories to complete every distinguished wardrobe.' },
]

const products = [
  {
    name: 'Nocturne Peak-Lapel Suit',
    brand: 'House of Valerion',
    categorySlug: 'luxury-suits',
    description:
      'A midnight blue, peak-lapel suit in Italian Super 160s wool, offering a sculpted silhouette and satin-trimmed lapels for refined evening dressing.',
    price: '4390.00',
    countInStock: 14,
    images: [
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Savile Row Midnight Tuxedo',
    brand: 'House of Valerion',
    categorySlug: 'luxury-suits',
    description:
      'A black silk-blend tuxedo with a sharp peak lapel, hand-finished buttons, and a structured fit tailored for a ceremonial entrance.',
    price: '4980.00',
    countInStock: 9,
    images: [
      'https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Aurelian Double-Breasted Suit',
    brand: 'House of Valerion',
    categorySlug: 'luxury-suits',
    description:
      'A double-breasted navy suit with a subtle windowpane pattern, crafted from Italian wool and designed for commanding boardroom presence.',
    price: '4620.00',
    countInStock: 12,
    images: [
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Noir Tailored Dinner Suit',
    brand: 'House of Valerion',
    categorySlug: 'luxury-suits',
    description:
      'A charcoal-grey dinner suit in premium worsted wool, featuring a clean silhouette, satin-stripe trousers, and soft-shoulder construction.',
    price: '4550.00',
    countInStock: 7,
    images: [
      'https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Regent Velvet Blazer',
    brand: 'House of Valerion',
    categorySlug: 'premium-blazers',
    description:
      'A midnight velvet blazer with a shawl collar and impeccable tailoring, designed as a luxurious alternative to traditional eveningwear.',
    price: '2190.00',
    countInStock: 16,
    images: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Sovereign Tailored Blazer',
    brand: 'House of Valerion',
    categorySlug: 'premium-blazers',
    description:
      'A structured navy blazer in Italian wool with refined brass buttons, delivering a modern, polished look for elevated daytime meetings.',
    price: '1890.00',
    countInStock: 18,
    images: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Monaco Peak-Lapel Blazer',
    brand: 'House of Valerion',
    categorySlug: 'premium-blazers',
    description:
      'A refined black blazer in cashmere-effect wool with a slight sheen, engineered for sophisticated evening styling with soft tailoring and a narrow lapel.',
    price: '2050.00',
    countInStock: 14,
    images: [
      'https://images.unsplash.com/photo-1524503033411-c9566986fc8f?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Maison Deco Dress Shirt',
    brand: 'House of Valerion',
    categorySlug: 'formal-shirts',
    description:
      'A pristine white dress shirt in premium cotton poplin with a reinforced cutaway collar and French cuffs for a crisp formal finish.',
    price: '390.00',
    countInStock: 30,
    images: [
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Noir Silk Poplin Shirt',
    brand: 'House of Valerion',
    categorySlug: 'formal-shirts',
    description:
      'A black silk-poplin shirt with a tailored fit and hidden button placket, designed to pair seamlessly with evening suiting.',
    price: '520.00',
    countInStock: 24,
    images: [
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Crown Pleated Formal Shirt',
    brand: 'House of Valerion',
    categorySlug: 'formal-shirts',
    description:
      'A formal shirt in ivory cotton with delicate tuck pleats and mother-of-pearl cuff links, crafted to complement tuxedos and black-tie attire.',
    price: '460.00',
    countInStock: 22,
    images: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Savile Row Oxford Shirt',
    brand: 'House of Valerion',
    categorySlug: 'formal-shirts',
    description:
      'A timeless blue Oxford shirt in long-staple cotton with a modern slim fit, engineered for refined suiting and crisp office dressing.',
    price: '360.00',
    countInStock: 28,
    images: [
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Ascot Tailored Trousers',
    brand: 'House of Valerion',
    categorySlug: 'trousers',
    description:
      'A pair of slim-fit charcoal trousers in stretch wool with pressed creases and a tapered hem, built for comfortable, tailored refinement.',
    price: '720.00',
    countInStock: 20,
    images: [
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Regal Evening Trousers',
    brand: 'House of Valerion',
    categorySlug: 'trousers',
    description:
      'Black evening trousers with satin side-stripes and a high-rise waist, tailored to complement tuxedo jackets and formal shoes.',
    price: '780.00',
    countInStock: 14,
    images: [
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Savoy Wool Dress Trousers',
    brand: 'House of Valerion',
    categorySlug: 'trousers',
    description:
      'A versatile pair of navy dress trousers in Italian wool with a crisp crease, designed for precision tailoring and everyday luxury.',
    price: '650.00',
    countInStock: 26,
    images: [
      'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Saint Laurent Silk Tie',
    brand: 'House of Valerion',
    categorySlug: 'accessories',
    description:
      'A matte silk tie in rich navy with a subtle jacquard pattern, finished with a hand-rolled edge for effortless evening polish.',
    price: '190.00',
    countInStock: 40,
    images: [
      'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=1400&q=80',
    ],
  },
  {
    name: 'Monarch Leather Dress Belt',
    brand: 'House of Valerion',
    categorySlug: 'accessories',
    description:
      'A streamlined black Italian calf leather belt with a low-profile silver buckle, designed to finish formalwear with quiet elegance.',
    price: '260.00',
    countInStock: 33,
    images: [
      'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=1400&q=80',
    ],
  },
]

async function main() {
  console.log('🌱 Seeding House of Valerion database...\n')

  try {
    // Verify database connection
    console.log('🔌 Testing database connection...')
      await prisma.$queryRawUnsafe('SELECT 1')
    console.log('✅ Database connection successful\n')

    // Seed categories first
    console.log('📁 Seeding categories...')
    const createdCategories = []
    for (const category of categories) {
      const result = await prisma.category.upsert({
        where: { slug: category.slug },
        update: {},
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
        },
      })
      createdCategories.push(result)
      console.log(`  ✓ ${result.name}`)
    }
    console.log(`✅ ${createdCategories.length} categories seeded\n`)

    // Seed products
    console.log('🛍️  Seeding products...')
    let successCount = 0
    let errorCount = 0
    const errors = []

    for (const product of products) {
      try {
        const slug = generateSlug(product.name)
        
        // Validate required fields
        if (!product.name || !product.description || !product.price || product.countInStock === undefined) {
          throw new Error('Missing required fields: name, description, price, or countInStock')
        }

        // Validate and ensure images is an array
        const images = Array.isArray(product.images) ? product.images : []
        if (images.length === 0) {
          console.warn(`  ⚠️  ${product.name} - No images provided`)
        }

        // Find the category by slug
        const category = createdCategories.find(c => c.slug === product.categorySlug)
        if (!category) {
          throw new Error(`Category not found: ${product.categorySlug}`)
        }

        // Create/update product with price as string (Prisma handles Decimal conversion)
        await prisma.product.upsert({
          where: { slug },
          update: {
            name: product.name,
            description: product.description,
            brand: product.brand || 'House of Valerion',
            price: product.price,
            countInStock: product.countInStock,
            images: images,
            categoryId: category.id,
          },
          create: {
            name: product.name,
            slug,
            description: product.description,
            brand: product.brand || 'House of Valerion',
            price: product.price,
            countInStock: product.countInStock,
            images: images,
            categoryId: category.id,
          },
        })
        successCount++
        console.log(`  ✓ ${product.name}`)
      } catch (err) {
        errorCount++
        errors.push(`${product.name}: ${err.message}`)
        console.error(`  ✗ ${product.name} - ${err.message}`)
      }
    }

    console.log(`\n✅ ${successCount}/${products.length} products seeded`)
    if (errorCount > 0) {
      console.error(`\n❌ ${errorCount} products failed:`)
      errors.forEach(err => console.error(`  - ${err}`))
      throw new Error(`${errorCount} products failed to seed`)
    }

    // Verify seeding
    console.log('\n📊 Verification:')
    const productCount = await prisma.product.count()
    const categoryCount = await prisma.category.count()
    const productsWithImages = await prisma.product.count({
      where: {
        images: {
          hasSome: []
        }
      }
    })

    console.log(`  Products in database: ${productCount}`)
    console.log(`  Categories in database: ${categoryCount}`)
    console.log(`  Products with images: ${productsWithImages}`)

    console.log('\n✅ SEEDING COMPLETED SUCCESSFULLY!')
    console.log('🎉 Database is ready for development!\n')
  } catch (error) {
    console.error('\n❌ SEEDING FAILED:')
    console.error(error.message)
    console.error('\nTroubleshooting:')
    console.error('1. Ensure PostgreSQL is running on localhost:5432')
    console.error('2. Check DATABASE_URL in .env file')
    console.error('3. Verify database "house_of_valerion" exists')
    console.error('4. Run: prisma migrate dev (to apply schema)')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
