import 'dotenv/config'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { ADMIN_ROLES, resolveAdminContext } from '../middleware/adminContext.js'

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

export const loginUser = async (req, res, next) => {
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
      user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
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
