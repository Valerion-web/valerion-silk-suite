import 'dotenv/config';
import prisma from './lib/prisma.js';

async function main() {
  try {
    await prisma.$connect();
    const email = 'admin@valerion.test';
    const user = await prisma.user.findUnique({ where: { email } });
    console.log('USER', JSON.stringify(user));
  } catch (error) {
    console.error('ERROR_NAME', error?.name);
    console.error('ERROR_MESSAGE', error?.message);
    console.error('ERROR_CODE', error?.code);
    console.error('ERROR_META', JSON.stringify(error?.meta));
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
