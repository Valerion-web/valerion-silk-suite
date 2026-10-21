import { createHash } from 'node:crypto'
import prisma from '../lib/prisma.js'

const hashKey = (key) => createHash('sha256').update(key).digest('hex')

export const createPostgresRateLimitStore = ({
  namespace,
  prismaClient = prisma,
  cleanupEvery = 1000,
} = {}) => {
  if (typeof namespace !== 'string' || !namespace.trim()) {
    throw new TypeError('A rate-limit namespace is required')
  }

  let windowMs
  let requestsSinceCleanup = 0

  const keyValues = (key) => [namespace, hashKey(key)]

  return {
    prefix: `${namespace}:`,
    localKeys: false,

    init(options) {
      windowMs = options.windowMs
    },

    async increment(key) {
      if (!Number.isFinite(windowMs) || windowMs <= 0) {
        throw new Error('Rate-limit store has not been initialized')
      }

      const [storeNamespace, keyHash] = keyValues(key)
      const rows = await prismaClient.$queryRaw`
        INSERT INTO "PhoneOtpRateLimit" ("namespace", "keyHash", "hits", "expiresAt")
        VALUES (${storeNamespace}, ${keyHash}, 1, CURRENT_TIMESTAMP + (${windowMs} * INTERVAL '1 millisecond'))
        ON CONFLICT ("namespace", "keyHash") DO UPDATE
        SET "hits" = CASE
              WHEN "PhoneOtpRateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
              ELSE "PhoneOtpRateLimit"."hits" + 1
            END,
            "expiresAt" = CASE
              WHEN "PhoneOtpRateLimit"."expiresAt" <= CURRENT_TIMESTAMP
                THEN CURRENT_TIMESTAMP + (${windowMs} * INTERVAL '1 millisecond')
              ELSE "PhoneOtpRateLimit"."expiresAt"
            END
        RETURNING "hits", "expiresAt"
      `

      if (!rows?.[0]) {
        throw new Error('Rate-limit store did not return an updated counter')
      }

      requestsSinceCleanup += 1
      if (requestsSinceCleanup >= cleanupEvery) {
        requestsSinceCleanup = 0
        await prismaClient.$executeRaw`
          DELETE FROM "PhoneOtpRateLimit"
          WHERE "expiresAt" <= CURRENT_TIMESTAMP
        `
      }

      return {
        totalHits: Number(rows[0].hits),
        resetTime: new Date(rows[0].expiresAt),
      }
    },

    async decrement(key) {
      const [storeNamespace, keyHash] = keyValues(key)
      await prismaClient.$executeRaw`
        UPDATE "PhoneOtpRateLimit"
        SET "hits" = GREATEST("hits" - 1, 0)
        WHERE "namespace" = ${storeNamespace} AND "keyHash" = ${keyHash}
      `
    },

    async resetKey(key) {
      const [storeNamespace, keyHash] = keyValues(key)
      await prismaClient.$executeRaw`
        DELETE FROM "PhoneOtpRateLimit"
        WHERE "namespace" = ${storeNamespace} AND "keyHash" = ${keyHash}
      `
    },

    async resetAll() {
      await prismaClient.$executeRaw`
        DELETE FROM "PhoneOtpRateLimit" WHERE "namespace" = ${namespace}
      `
    },

    async get(key) {
      const [storeNamespace, keyHash] = keyValues(key)
      const rows = await prismaClient.$queryRaw`
        SELECT "hits", "expiresAt"
        FROM "PhoneOtpRateLimit"
        WHERE "namespace" = ${storeNamespace}
          AND "keyHash" = ${keyHash}
          AND "expiresAt" > CURRENT_TIMESTAMP
      `
      const row = rows?.[0]
      return row
        ? { totalHits: Number(row.hits), resetTime: new Date(row.expiresAt) }
        : undefined
    },
  }
}
