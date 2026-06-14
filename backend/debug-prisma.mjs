import 'dotenv/config'
import prisma from './lib/prisma.js'

async function main() {
  try {
    console.log('DATABASE_URL', process.env.DATABASE_URL)
    const count = await prisma.product.count()
    console.log('COUNT', count)
  } catch (err) {
    console.error('NAME', err.name)
    console.error('MESSAGE', err.message)
    console.error('CODE', err.code)
    console.error('META', JSON.stringify(err.meta, null, 2))
    console.error(err.stack)
  } finally {
    await prisma.$disconnect()
  }
}

main()
