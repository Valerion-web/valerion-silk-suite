import 'dotenv/config'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

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
    throw new Error('JWT_SECRET is missing or invalid')
  }

  try {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
      expiresIn: getJwtExpiresIn(),
    })
  } catch (error) {
    console.error('[Auth] JWT generation error:', error)
    throw new Error(`Token generation failed: ${error instanceof Error ? error.message : String(error)}`)
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
    const { name, email, password } = req.body || {}

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      res.status(400)
      throw new Error('A valid email is required')
    }

    if (typeof password !== 'string' || password.length < 8) {
      res.status(400)
      throw new Error('Password must be at least 8 characters')
    }

    let existing
    try {
      existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    } catch (dbErr) {
      console.error('[Auth] Register Prisma error:', dbErr)
      res.status(500)
      throw new Error(`Database error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`)
    }

    if (existing) {
      res.status(409)
      throw new Error('Email is already registered')
    }

    let user
    try {
      const hashedPassword = await bcrypt.hash(password, 10)
      user = await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          password: hashedPassword,
        },
      })
    } catch (dbErr) {
      console.error('[Auth] Register user creation error:', dbErr)
      res.status(500)
      throw new Error(`Database error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`)
    }

    let token
    try {
      token = createToken(user)
    } catch (tokenErr) {
      console.error('[Auth] Register JWT creation failed:', tokenErr)
      res.status(500)
      throw new Error(`Token generation failed: ${tokenErr instanceof Error ? tokenErr.message : String(tokenErr)}`)
    }

    setAuthCookie(res, token)
    res.status(201).json({ user: sanitizeUser(user), token, message: 'Account created successfully' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (!res.headersSent) {
      const statusCode = res.statusCode >= 400 ? res.statusCode : 500
      res.status(statusCode).json({ message })
    }
    console.error('[Auth] Register Error:', error)
  }
}

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    console.log('[Auth] Login attempt', {
      email: normalizedEmail,
      hasPassword: Boolean(password),
      bodyKeys: Object.keys(req.body || {}),
    })

    if (!normalizedEmail || typeof normalizedEmail !== 'string' || !normalizedEmail.includes('@')) {
      res.status(400)
      throw new Error('A valid email is required')
    }

    if (typeof password !== 'string' || password.trim().length < 1) {
      res.status(400)
      throw new Error('Password is required')
    }

    let user
    try {
      user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
      console.log('[Auth] Prisma user lookup result', { email: normalizedEmail, found: Boolean(user) })
    } catch (dbErr) {
      console.error('[Auth] Login Prisma error:', dbErr)
      res.status(500)
      throw new Error(`Database error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`)
    }

    if (!user) {
      res.status(404)
      console.warn('[Auth] Login failed - user not found', { email: normalizedEmail })
      throw new Error('User not found')
    }

    if (!user.password) {
      res.status(500)
      console.error('[Auth] Login failed - stored password is missing', { email: normalizedEmail })
      throw new Error('Stored password is missing')
    }

    let matched = false
    try {
      matched = await bcrypt.compare(password, user.password)
    } catch (compareError) {
      console.error('[Auth] bcrypt.compare error:', compareError)
      res.status(500)
      throw new Error('Password verification failed')
    }

    console.log('[Auth] Password comparison result', { email: normalizedEmail, matched })
    if (!matched) {
      res.status(401)
      console.warn('[Auth] Login failed - invalid password', { email: normalizedEmail })
      throw new Error('Invalid credentials')
    }

    let token
    try {
      token = createToken(user)
    } catch (tokenErr) {
      console.error('[Auth] JWT creation failed during login:', tokenErr)
      res.status(500)
      throw new Error(`Token generation failed: ${tokenErr instanceof Error ? tokenErr.message : String(tokenErr)}`)
    }

    setAuthCookie(res, token)
    console.log('[Auth] Login success', { email: normalizedEmail, userId: user.id })
    res.status(200).json({ user: sanitizeUser(user), token, message: 'Login successful' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (!res.headersSent) {
      const statusCode = res.statusCode >= 400 ? res.statusCode : 500
      res.status(statusCode).json({ message })
    }
    console.error('[Auth] Login Error:', error)
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
