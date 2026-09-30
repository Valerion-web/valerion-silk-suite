import crypto from 'node:crypto'

export const GOOGLE_NONCE_TTL_MS = 5 * 60 * 1000

const hashNonce = (nonce) => crypto.createHash('sha256').update(nonce).digest('hex')

export const createGoogleNonceStore = ({ clock = Date.now, ttlMs = GOOGLE_NONCE_TTL_MS } = {}) => {
  const entries = new Map()

  const pruneExpired = (now) => {
    for (const [key, expiresAt] of entries) {
      if (expiresAt <= now) entries.delete(key)
    }
  }

  return {
    issue(nonce) {
      if (typeof nonce !== 'string' || !nonce) throw new TypeError('A nonce is required')
      const now = clock()
      pruneExpired(now)
      entries.set(hashNonce(nonce), now + ttlMs)
    },
    has(nonce) {
      if (typeof nonce !== 'string' || !nonce) return false
      const key = hashNonce(nonce)
      const expiresAt = entries.get(key)
      if (expiresAt === undefined) return false
      if (expiresAt <= clock()) {
        entries.delete(key)
        return false
      }
      return true
    },
    consume(nonce) {
      if (typeof nonce !== 'string' || !nonce) return false
      const key = hashNonce(nonce)
      const expiresAt = entries.get(key)
      if (expiresAt === undefined) return false
      entries.delete(key)
      return expiresAt > clock()
    },
  }
}

export const googleNonceStore = createGoogleNonceStore()