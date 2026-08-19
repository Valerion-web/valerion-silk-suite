import prisma from './lib/prisma.js'
import bcrypt from 'bcryptjs'
const user = await prisma.user.findUnique({ where: { email: 'admin@valerion.test' } })
console.log(JSON.stringify({ email: user?.email, passwordHash: user?.password, matches: user ? await bcrypt.compare('SecureAdmin123', user.password) : null }, null, 2))
await prisma.$disconnect()
