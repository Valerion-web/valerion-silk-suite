import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { connectDB } from './config/db.js'
import { Prisma } from '@prisma/client'
import prisma, { pool } from './lib/prisma.js'
import productRoutes from './routes/productRoutes.js'
import authRoutes from './routes/authRoutes.js'
import { notFound, errorHandler } from './middleware/errorMiddleware.js'

connectDB()

const app = express()

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))
app.use('/uploads', express.static('uploads'))
app.use('/api/products', productRoutes)
app.use('/api/auth', authRoutes)

app.post('/api/products/test-create', async (req, res, next) => {
  try {
    const sampleProduct = {
      name: 'Blue Silk Saree',
      slug: 'blue-silk-saree',
      description: 'Premium silk saree',
      brand: 'House of Valerion',
      price: new Prisma.Decimal('2999'),
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
    // Use the underlying PG pool to verify connectivity by acquiring a client
    const client = await pool.connect()
    try {
      await client.query('SELECT 1')
      res.json({ status: 'ok', database: 'connected' })
    } finally {
      client.release()
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Database connection failed', error: error.message })
  }
})

app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000
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
