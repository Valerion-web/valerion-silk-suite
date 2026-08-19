import prisma from '../lib/prisma.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const EMAIL = process.env.ADMIN_EMAIL || 'admin@valerion.test'
const PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPass123'
const NAME = process.env.ADMIN_NAME || 'Admin'
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'

async function ensureAdmin() {
  try {
    let user = await prisma.user.findUnique({ where: { email: EMAIL } })
    if (!user) {
      const hashed = await bcrypt.hash(PASSWORD, 10)
      user = await prisma.user.create({ data: { name: NAME, email: EMAIL, password: hashed, role: 'ADMIN' } })
      console.log('Created admin user:', user.email)
    } else if (user.role !== 'ADMIN') {
      user = await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
      console.log('Updated user to ADMIN:', user.email)
    } else {
      console.log('Admin user already exists:', user.email)
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
    console.log('\nUse this Authorization header value in admin requests:')
    console.log('Bearer ' + token)
  } catch (e) {
    console.error('Error creating admin:', e)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

ensureAdmin()
