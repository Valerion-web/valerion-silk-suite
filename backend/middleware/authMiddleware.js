import 'dotenv/config'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret.includes('change-me')) {
    console.error('[Auth] protect middleware has an invalid JWT_SECRET')
    return null
  }
  return secret
}

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization
    console.log('[Auth] protect middleware authHeader present', Boolean(authHeader))
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      res.status(401)
      throw new Error('Authorization token missing')
    }

    const token = authHeader.split(' ')[1]
    const secret = getJwtSecret()
    if (!secret) {
      res.status(500)
      throw new Error('JWT_SECRET is missing or invalid')
    }

    const decoded = jwt.verify(token, secret)
    console.log('[Auth] protect middleware token decoded', { decoded })
    if (!decoded || typeof decoded !== 'object' || !('id' in decoded)) {
      res.status(401)
      throw new Error('Invalid token')
    }

    const userId = Number(decoded.id)
    if (Number.isNaN(userId)) {
      res.status(401)
      throw new Error('Invalid token payload')
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      res.status(401)
      throw new Error('User not found')
    }

    req.user = user
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      res.status(401)
      return next(new Error('Token expired'))
    }
    if (error.name === 'JsonWebTokenError') {
      res.status(401)
      return next(new Error('Invalid token'))
    }
    next(error)
  }
}

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403)
    return next(new Error('Admin access required'))
  }
  next()
}
