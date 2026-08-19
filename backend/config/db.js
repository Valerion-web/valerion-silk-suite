import prisma from '../lib/prisma.js'

export const connectDB = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined in .env')
    }

    await prisma.$connect()
    console.log('Database connected successfully')
  } catch (error) {
    console.error(`Database connection error: ${error.message}`)
    process.exit(1)
  }
}
