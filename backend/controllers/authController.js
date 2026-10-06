import 'dotenv/config'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { ADMIN_ROLES, resolveAdminContext } from '../middleware/adminContext.js'
import { verifyGoogleIdToken } from '../services/googleIdentityService.js'
import { GOOGLE_NONCE_TTL_MS, googleNonceStore } from '../services/googleNonceStore.js'

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret.includes('change-me')) {
    console.error('[Auth] JWT_SECRET is missing or still using a placeholder value')
    return null
  }
  return secret
}

const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d'

const createToken = (user) => {
  const secret = getJwtSecret()
  if (!secret) {
    throw new Error('Authentication failed')
  }

  try {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
      expiresIn: getJwtExpiresIn(),
    })
  } catch (error) {
    throw new Error('Authentication failed')
  }
}

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name || '',
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

const registrationAcknowledgement = { message: 'If the details are eligible, the account request was processed.' }

const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production'
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

const googleNonceCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    ...(isProduction ? { domain: '.haston.in' } : {}),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: GOOGLE_NONCE_TTL_MS,
    path: '/api/auth/google',
  }
}

const getRequestCookie = (req, name) => {
  const cookieHeader = req.headers.cookie
  if (typeof cookieHeader !== 'string') return null

  const cookie = cookieHeader.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`))
  if (!cookie) return null

  try {
    return decodeURIComponent(cookie.slice(name.length + 1))
  } catch {
    return null
  }
}

const clearGoogleNonceCookie = (res) => {
  const { maxAge, ...options } = googleNonceCookieOptions()
  res.clearCookie('google_login_nonce', options)
}

const isHastonStoreContext = (req) => req.contextType === 'STORE' && req.store?.slug === 'haston' && Number.isInteger(req.store.id)

export const createGoogleLoginNonceHandler = ({ nonceStore = googleNonceStore } = {}) => (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID?.trim()) {
    return res.status(503).json({ message: 'Google sign-in is not configured' })
  }
  if (!isHastonStoreContext(req)) {
    return res.status(409).json({ message: 'Google sign-in is available only for the HASTON store' })
  }

  const nonce = crypto.randomBytes(32).toString('base64url')
  nonceStore.issue(nonce)
  res.cookie('google_login_nonce', nonce, googleNonceCookieOptions())
  res.set('Cache-Control', 'no-store')
  return res.status(200).json({ nonce })
}

export const googleLoginNonce = createGoogleLoginNonceHandler()

export const registerUser = async (req, res, next) => {
  try {
    if (req.contextType === 'PARENT') {
      res.status(409)
      throw new Error('Registration failed')
    }
    const { name, email, password } = req.body || {}

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      res.status(400)
      throw new Error('Registration failed')
    }

    if (typeof password !== 'string' || password.length < 8) {
      res.status(400)
      throw new Error('Registration failed')
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    let existing
    try {
      existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    } catch (dbErr) {
      res.status(500)
      throw new Error('Registration failed')
    }

    if (existing) {
      return res.status(202).json(registrationAcknowledgement)
    }

    let user
    try {
      user = await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          password: hashedPassword,
          storeId: req.store.id,
        },
      })
    } catch (dbErr) {
      if (dbErr?.code === 'P2002') {
        return res.status(202).json(registrationAcknowledgement)
      }
      res.status(500)
      throw new Error('Registration failed')
    }

    res.status(202).json(registrationAcknowledgement)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (!res.headersSent) {
      const statusCode = res.statusCode >= 400 ? res.statusCode : 500
      res.status(statusCode).json({ message })
    }
  }
}

export const createLoginUserHandler = ({ prismaClient = prisma } = {}) => async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || typeof normalizedEmail !== 'string' || !normalizedEmail.includes('@')) {
      res.status(400)
      throw new Error('Authentication failed')
    }

    if (typeof password !== 'string' || password.trim().length < 1) {
      res.status(400)
      throw new Error('Authentication failed')
    }

    let user
    try {
      user = await prismaClient.user.findUnique({ where: { email: normalizedEmail } })
    } catch (dbErr) {
      res.status(500)
      throw new Error('Authentication failed')
    }

    if (!user) {
      res.status(401)
      throw new Error('Authentication failed')
    }

    if (!user.isActive) {
      res.status(401)
      throw new Error('Authentication failed')
    }

    if (ADMIN_ROLES.has(user.role)) {
      const adminContext = await resolveAdminContext(req, user)
      if (!adminContext) {
        res.status(401)
        throw new Error('Authentication failed')
      }
    } else if (req.contextType === 'PARENT' || !req.store || user.storeId !== req.store.id) {
      res.status(401)
      throw new Error('Authentication failed')
    }

    if (!user.password) {
      res.status(500)
      throw new Error('Authentication failed')
    }

    let matched = false
    try {
      matched = await bcrypt.compare(password, user.password)
    } catch (compareError) {
      res.status(500)
      throw new Error('Authentication failed')
    }

    if (!matched) {
      res.status(401)
      throw new Error('Authentication failed')
    }

    let token
    try {
      token = createToken(user)
    } catch (tokenErr) {
      res.status(500)
      throw new Error('Authentication failed')
    }

    setAuthCookie(res, token)
    res.status(200).json({ user: sanitizeUser(user), message: 'Login successful' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (!res.headersSent) {
      const statusCode = res.statusCode >= 400 ? res.statusCode : 500
      res.status(statusCode).json({ message })
    }
  }
}

export const loginUser = createLoginUserHandler()

const findGoogleIdentity = (prismaClient, providerSubject) => prismaClient.authIdentity.findUnique({
  where: { provider_providerSubject: { provider: 'google', providerSubject } },
  include: { user: true },
})

const isUsableGooglePayload = (payload, clientId, nonce) => {
  if (!payload || typeof payload !== 'object') return false
  if (payload.aud !== clientId) return false
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) return false
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return false
  if (typeof payload.sub !== 'string' || !payload.sub.trim()) return false
  if (typeof payload.email !== 'string' || !payload.email.trim().includes('@')) return false
  if (payload.email_verified !== true) return false
  if (typeof payload.nonce !== 'string' || typeof nonce !== 'string') return false

  const tokenNonce = Buffer.from(payload.nonce)
  const cookieNonce = Buffer.from(nonce)
  return tokenNonce.length === cookieNonce.length && crypto.timingSafeEqual(tokenNonce, cookieNonce)
}

const isCustomerInCurrentStore = (user, req) => Boolean(
  user && user.isActive && user.role === 'CUSTOMER' && user.storeId === req.store.id,
)

const googleAccountConflict = (res) => res.status(409).json({
  message: 'An account may already exist for this Google email. Sign in with the existing account before linking Google.',
})

const completeGoogleLogin = (user, res, nonce, nonceStore) => {
  let token
  try {
    token = createToken(user)
  } catch {
    return res.status(500).json({ message: 'Google authentication failed' })
  }
  if (!nonceStore.consume(nonce)) {
    clearGoogleNonceCookie(res)
    return res.status(401).json({ message: 'Google authentication failed' })
  }
  clearGoogleNonceCookie(res)
  setAuthCookie(res, token)
  return res.status(200).json({ user: sanitizeUser(user), message: 'Login successful' })
}

export const createGoogleLoginHandler = ({ prismaClient = prisma, verifyCredential = verifyGoogleIdToken, nonceStore = googleNonceStore } = {}) => async (req, res) => {
  const nonce = getRequestCookie(req, 'google_login_nonce')

  if (!isHastonStoreContext(req)) {
    return res.status(409).json({ message: 'Google sign-in is available only for the HASTON store' })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    return res.status(503).json({ message: 'Google sign-in is not configured' })
  }

  const credential = req.body?.credential
  if (typeof credential !== 'string' || !credential || credential.length > 16384) {
    return res.status(401).json({ message: 'Google authentication failed' })
  }

  let payload
  try {
    payload = await verifyCredential(credential, clientId)
  } catch (error) {
    const safeMessage = String(error?.message ?? '')
      .replaceAll(credential, '[REDACTED]')
      .replaceAll(nonce, '[REDACTED]')
      .replaceAll(clientId, '[REDACTED]')
      .replace(/[\r\n\t]/g, ' ')

    console.warn(
      'GOOGLE_VERIFY_ERROR:',
      String(error?.name ?? 'unknown'),
      String(error?.code ?? 'unknown'),
      safeMessage
    )

    return res.status(401).json({ message: 'Google authentication failed' })
  }

  if (!isUsableGooglePayload(payload, clientId, nonce)) {
    return res.status(401).json({ message: 'Google authentication failed' })
  }
  if (!nonceStore.has(nonce)) {
    clearGoogleNonceCookie(res)
    return res.status(401).json({ message: 'Google authentication failed' })
  }

  const providerSubject = payload.sub.trim()
  const email = payload.email.trim().toLowerCase()

  try {
    const identity = await findGoogleIdentity(prismaClient, providerSubject)
    if (identity) {
      if (!isCustomerInCurrentStore(identity.user, req)) {
        return res.status(401).json({ message: 'Google authentication failed' })
      }
      return completeGoogleLogin(identity.user, res, nonce, nonceStore)
    }

    const existingUser = await prismaClient.user.findUnique({ where: { email } })
    if (existingUser) return googleAccountConflict(res)

    const randomPassword = crypto.randomBytes(32).toString('base64url')
    const hashedPassword = await bcrypt.hash(randomPassword, 10)
    const userName = typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : email.split('@')[0]

    const user = await prismaClient.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          name: userName,
          email,
          password: hashedPassword,
          role: 'CUSTOMER',
          storeId: req.store.id,
        },
      })
      await transaction.authIdentity.create({
        data: { provider: 'google', providerSubject, userId: createdUser.id },
      })
      return createdUser
    })

    return completeGoogleLogin(user, res, nonce, nonceStore)
  } catch (error) {
    if (error?.code === 'P2002') {
      try {
        const racedIdentity = await findGoogleIdentity(prismaClient, providerSubject)
        if (racedIdentity) {
          if (!isCustomerInCurrentStore(racedIdentity.user, req)) {
            return res.status(401).json({ message: 'Google authentication failed' })
          }
          return completeGoogleLogin(racedIdentity.user, res, nonce, nonceStore)
        }

        const racedEmail = await prismaClient.user.findUnique({ where: { email } })
        if (racedEmail) return googleAccountConflict(res)
      } catch {
        return res.status(500).json({ message: 'Google authentication failed' })
      }
    }
    return res.status(500).json({ message: 'Google authentication failed' })
  }
}

export const logoutUser = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  })
  res.json({ message: 'Logged out successfully' })
}

export const getProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401)
      throw new Error('Authentication required')
    }
    res.json({ user: sanitizeUser(req.user) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (!res.headersSent) {
      res.status(401).json({ message })
    }
    console.error('[Auth] Profile Error:', error)
  }
}
