import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      res.status(401)
      throw new Error('Authorization token missing')
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)
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
