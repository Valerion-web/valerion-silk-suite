import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const globalForPrisma = globalThis

const normalizeSqliteUrl = (value) => {
  if (!value || !value.startsWith('file:')) return value

  const relativePath = value.replace(/^file:/, '').trim()
  if (!relativePath || relativePath.startsWith('memory') || /^[A-Za-z]:[\\/]/.test(relativePath) || relativePath.startsWith('/') || relativePath.startsWith('\\\\')) {
    return value
  }

  const resolvedPath = path.resolve(__dirname, '..', relativePath).replace(/\\/g, '/')
  return `file:${resolvedPath}`
}

const connectionString = normalizeSqliteUrl(process.env.DATABASE_URL || 'file:./dev.db')
const adapter = new PrismaBetterSqlite3({ url: connectionString })

const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter,
  log: ['query', 'error', 'warn'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export { prisma as default, prisma }
