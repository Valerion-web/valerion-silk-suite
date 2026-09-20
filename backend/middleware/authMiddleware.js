import 'dotenv/config'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { ADMIN_ROLES, resolveAdminContext } from './adminContext.js'

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret.includes('change-me')) {
    console.error('[Auth] protect middleware has an invalid JWT_SECRET')
    return null
  }
  return secret
}

const getTokenCookie = (req) => {
  const cookieHeader = req.headers.cookie
  if (typeof cookieHeader !== 'string') return null

  const tokenCookie = cookieHeader.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith('token='))
  if (!tokenCookie) return null

  const value = tokenCookie.slice('token='.length)
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const protect = async (req, res, next) => {
  try {
    const cookieToken = getTokenCookie(req)
    const authHeader = req.headers.authorization || req.headers.Authorization
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null
    const token = cookieToken || bearerToken

    if (!token) {
      res.status(401)
      throw new Error('Authorization token missing')
    }

    const secret = getJwtSecret()
    if (!secret) {
      res.status(500)
      throw new Error('JWT_SECRET is missing or invalid')
    }

    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] })
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

    if (!user.isActive) {
      res.status(401)
      throw new Error('User account is inactive')
    }

    if (ADMIN_ROLES.has(user.role)) {
      const adminContext = await resolveAdminContext(req, user)
      if (!adminContext) {
        res.status(401)
        throw new Error('Admin is not assigned to this store')
      }
      req.adminContext = adminContext
      req.accessScope = adminContext.accessScope
    } else {
      if (req.contextType === 'PARENT') {
        res.status(403)
        throw new Error('Customer authentication requires a child ecommerce store context')
      }
      if (req.store && user.storeId !== req.store.id) {
        res.status(401)
        throw new Error('User is not a member of this store')
      }
      req.accessScope = 'STORE'
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
  if (!req.user || !req.adminContext) {
    res.status(403)
    return next(new Error('Admin access required'))
  }
  next()
}

export const requireSuperAdmin = (req, res, next) => {
  if (req.adminContext?.role !== 'SUPER_ADMIN') {
    res.status(403)
    return next(new Error('SUPER_ADMIN access required'))
  }
  next()
}

const roleCapabilities = {
  SUPER_ADMIN: new Set(['products', 'inventory', 'orders', 'catalog', 'users', 'marketing', 'analytics']),
  ADMIN: new Set(['products', 'inventory', 'orders', 'catalog', 'users', 'marketing', 'analytics']),
  BRAND_MANAGER: new Set(['products', 'catalog']),
  INVENTORY_MANAGER: new Set(['inventory']),
  ORDER_MANAGER: new Set(['orders']),
  MARKETING_MANAGER: new Set(['marketing']),
}

export const requireCapability = (capability) => (req, res, next) => {
  const capabilities = roleCapabilities[req.adminContext?.role]
  if (!capabilities?.has(capability)) {
    res.status(403)
    return next(new Error('Insufficient permissions'))
  }
  next()
}
