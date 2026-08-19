import prisma from './lib/prisma.js'

async function main() {
  try {
    await prisma.$connect()
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      orderBy: { id: 'asc' },
    })
    console.log(JSON.stringify(admins.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      password: u.password,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })), null, 2))
  } catch (error) {
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
