import prisma from './lib/prisma.js'

async function test() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: 'asc' },
      include: { category: true },
    })
    console.log('ok', products.length)
  } catch (err) {
    console.error('NAME:', err.name)
    console.error('MESSAGE:', err.message)
    console.error('CODE:', err.code)
    console.error('META:', JSON.stringify(err.meta, null, 2))
    console.error(err.stack)
  } finally {
    await prisma.$disconnect()
  }
}

test()
