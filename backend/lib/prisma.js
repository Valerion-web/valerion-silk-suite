import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis

// Prefer using DATABASE_URL to construct the pool; fall back to individual env vars
const connectionString = process.env.DATABASE_URL || (process.env.PGUSER ? `postgresql://${process.env.PGUSER}:${encodeURIComponent(process.env.PGPASSWORD || '')}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || ''}` : undefined)

const pool = new Pool({
  connectionString,
})

const adapter = new PrismaPg({
  pool,
})

const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter,
  log: ['query', 'error', 'warn'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
export { pool }
