import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { connectDB } from './config/db.js'
import { resolveStore } from './middleware/storeMiddleware.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '.env') })
import prisma from './lib/prisma.js'
import productRoutes from './routes/productRoutes.js'
import { categoryRouter, brandRouter } from './routes/productRoutes.js'
import authRoutes from './routes/authRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import customerRoutes from './routes/customerRoutes.js'
import razorpayRoutes from './routes/razorpayRoutes.js'
import razorpayWebhookRoutes from './routes/razorpayWebhookRoutes.js'
import { notFound, errorHandler } from './middleware/errorMiddleware.js'
import csrfMiddleware from './middleware/csrfMiddleware.js'

connectDB().catch((error) => {
  console.error('[Server] Initial database connection failed:', error)
})

const app = express()

const allowedOrigins = new Set((process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',').map((origin) => origin.trim()).filter(Boolean))
app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true)
    return callback(new Error('Origin is not allowed by CORS'))
  },
}))
app.use('/api/payments/razorpay/webhook', razorpayWebhookRoutes)
app.use(express.json())
app.use(morgan('dev'))
app.use('/uploads', express.static('uploads'))
app.use('/api', resolveStore)
app.use('/api', csrfMiddleware)
app.use('/api/products', productRoutes)
app.use('/api/categories', categoryRouter)
app.use('/api/brands', brandRouter)
app.use('/api/auth', authRoutes)
app.use('/api', customerRoutes)
app.use('/api/payments/razorpay', razorpayRoutes)
app.use('/api/admin', adminRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'House of Valerion API is running' })
})

app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`\n🚀 House of Valerion Backend Server Started`)
    console.log(`📍 Server running on http://localhost:${PORT}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`💾 Database configured: ${process.env.DATABASE_URL ? 'yes' : 'no'}`)
    console.log(`✅ CORS enabled - frontend can make requests`)
    console.log(`📡 Available endpoints:`)
    console.log(`   - GET  http://localhost:${PORT}/`)
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
