import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import bcrypt from 'bcryptjs'
import { connectDB } from './config/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '.env') })
import prisma from './lib/prisma.js'
import productRoutes from './routes/productRoutes.js'
import authRoutes from './routes/authRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import { notFound, errorHandler } from './middleware/errorMiddleware.js'

connectDB().catch((error) => {
  console.error('[Server] Initial database connection failed:', error)
})

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@valerion.test'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SecureAdmin123'
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin'

const ensureAdminUser = async () => {
  try {
    const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10)
      await prisma.user.create({
        data: {
          name: ADMIN_NAME,
          email: ADMIN_EMAIL,
          password: hashedPassword,
          role: 'ADMIN',
        },
      })
      console.log(`✅ Default admin created: ${ADMIN_EMAIL}`)
      return
    }

    const updates = {}
    if (existingAdmin.role !== 'ADMIN') {
      updates.role = 'ADMIN'
    }

    const passwordNeedsReset = !existingAdmin.password || existingAdmin.password.trim() === '' || !(await bcrypt.compare(ADMIN_PASSWORD, existingAdmin.password))
    if (passwordNeedsReset) {
      updates.password = await bcrypt.hash(ADMIN_PASSWORD, 10)
      console.log(`✅ Reset admin password to configured default for: ${ADMIN_EMAIL}`)
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: updates })
    }

    const staleAdmins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    for (const admin of staleAdmins) {
      const adminPasswordNeedsReset = !admin.password || admin.password.trim() === '' || !(await bcrypt.compare(ADMIN_PASSWORD, admin.password))
      if (adminPasswordNeedsReset) {
        await prisma.user.update({
          where: { id: admin.id },
          data: { password: await bcrypt.hash(ADMIN_PASSWORD, 10) },
        })
        console.log(`✅ Repaired admin password for account: ${admin.email}`)
      }
    }
  } catch (error) {
    console.error('Admin setup failed:', error)
    process.exit(1)
  }
}

const app = express()

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))
app.use('/uploads', express.static('uploads'))
app.use('/api/products', productRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)

app.post('/api/products/test-create', async (req, res, next) => {
  try {
    const sampleProduct = {
      name: 'Blue Silk Saree',
      slug: 'blue-silk-saree',
      description: 'Premium silk saree',
      brand: 'House of Valerion',
      price: 2999,
      countInStock: 10,
      images: [],
    }

    const createdProduct = await prisma.product.create({
      data: sampleProduct,
    })

    res.status(201).json(createdProduct)
  } catch (error) {
    next(error)
  }
})

app.get('/', (req, res) => {
  res.json({ message: 'House of Valerion API is running' })
})

app.get('/api/db-check', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Database connection failed', error: error.message })
  }
})

app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

const startServer = async () => {
  await ensureAdminUser()
  app.listen(PORT, () => {
    console.log(`\n🚀 House of Valerion Backend Server Started`)
    console.log(`📍 Server running on http://localhost:${PORT}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`💾 Database configured: ${process.env.DATABASE_URL ? 'yes' : 'no'}`)
    console.log(`✅ CORS enabled - frontend can make requests`)
    console.log(`📡 Available endpoints:`)
    console.log(`   - GET  http://localhost:${PORT}/`)
    console.log(`   - GET  http://localhost:${PORT}/api/db-check`)
    console.log(`   - GET  http://localhost:${PORT}/api/products`)
    console.log(`   - GET  http://localhost:${PORT}/api/products/:id`)
    console.log(`   - POST http://localhost:${PORT}/api/products`)
    console.log(`   - POST http://localhost:${PORT}/api/auth/register`)
    console.log(`   - POST http://localhost:${PORT}/api/auth/login`)
    console.log(`   - POST http://localhost:${PORT}/api/auth/logout`)
    console.log(`   - GET  http://localhost:${PORT}/api/auth/profile\n`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start backend server:', error)
  process.exit(1)
})
