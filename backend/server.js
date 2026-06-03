import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import morgan from 'morgan'
import { connectDB } from './config/db.js'
import prisma from './lib/prisma.js'
import { notFound, errorHandler } from './middleware/errorMiddleware.js'

dotenv.config()
connectDB()

const app = express()

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))
app.use('/uploads', express.static('uploads'))

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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Database configured: ${process.env.DATABASE_URL ? 'yes' : 'no'}`)
})
