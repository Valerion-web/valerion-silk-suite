import prisma from '../lib/prisma.js';

async function run() {
  try {
    const imgs = await prisma.productImage.findMany();
    const variants = await prisma.productVariant.findMany();
    const stocks = await prisma.stockMovement.findMany();
    console.log(JSON.stringify({ imgs, variants, stocks }, null, 2));
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
