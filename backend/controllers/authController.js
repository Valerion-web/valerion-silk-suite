import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

const createToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  })
}

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name || '',
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {}

    // Normalize email to lowercase
    const normalizedEmail = email ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || typeof normalizedEmail !== 'string' || !normalizedEmail.includes('@')) {
      res.status(400)
      throw new Error('A valid email is required')
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400)
      throw new Error('Password must be at least 8 characters')
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      res.status(409)
      throw new Error('Email is already registered')
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
      },
    })

    const token = createToken(user)
    res.status(201).json({ user: sanitizeUser(user), token })
  } catch (error) {
    next(error)
  }
}

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body || {}

    // Normalize email to lowercase
    const normalizedEmail = email ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || !password) {
      res.status(400)
      throw new Error('Email and password are required')
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user) {
      res.status(401)
      throw new Error('Invalid email or password')
    }

    const matched = await bcrypt.compare(password, user.password)
    if (!matched) {
      res.status(401)
      throw new Error('Invalid email or password')
    }

    const token = createToken(user)
    res.json({ user: sanitizeUser(user), token })
  } catch (error) {
    next(error)
  }
}

export const logoutUser = async (req, res) => {
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
    next(error)
  }
}
