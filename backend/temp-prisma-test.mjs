import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['query', 'error', 'warn'] })

async function main() {
  try {
    await prisma.$connect()
    console.log('CONNECTED')
    const count = await prisma.product.count()
    console.log('COUNT', count)
  } catch (err) {
    console.error('ERR', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
