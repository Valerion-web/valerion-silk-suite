import prisma from '../lib/prisma.js'

export const connectDB = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined in .env')
    }

    await prisma.$connect()
    console.log('PostgreSQL connected successfully')
  } catch (error) {
    console.error(`PostgreSQL connection error: ${error.message}`)
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  }
}
