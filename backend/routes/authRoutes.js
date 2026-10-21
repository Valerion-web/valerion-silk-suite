import express from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { createGoogleLoginHandler, googleLoginNonce, loginUser, logoutUser, registerUser, getProfile } from '../controllers/authController.js'
import { phoneOtpHandlers } from '../controllers/phoneOtpController.js'
import { protect } from '../middleware/authMiddleware.js'
import { normalizeIndianPhone } from '../services/indianPhoneNumber.js'
import { phoneOtpControls } from '../services/phoneOtpControls.js'

const normalizedEmailKey = (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknown-email'
  return email
}

const generic429 = (req, res) => {
  res.status(429).json({ message: 'Too many requests. Please try again later.' })
}

const getAllowedOrigins = () => new Set((process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean))

const getCookie = (req, name) => {
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

export const protectGoogleLoginRequest = (req, res, next) => {
  const origin = req.get('origin')
  if (!origin || !getAllowedOrigins().has(origin)) {
    return res.status(403).json({ message: 'Google sign-in request rejected' })
  }

  if (req.method === 'POST') {
    const csrfCookie = getCookie(req, 'csrf_token')
    const csrfHeader = req.get('x-csrf-token')
    if (!req.is('application/json') || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({ message: 'Google sign-in request rejected' })
    }
  }

  return next()
}

export const protectPhoneOtpRequest = (req, res, next) => {
  const origin = req.get('origin')
  if (!origin || !getAllowedOrigins().has(origin)) {
    return res.status(403).json({ message: 'Phone authentication request rejected' })
  }

  const csrfCookie = getCookie(req, 'csrf_token')
  const csrfHeader = req.get('x-csrf-token')
  if (!req.is('application/json') || !csrfCookie || csrfHeader !== csrfCookie) {
    return res.status(403).json({ message: 'Phone authentication request rejected' })
  }

  return next()
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${normalizedEmailKey(req)}`,
  handler: generic429,
  // MemoryStore is the smallest safe in-process implementation for this single backend deployment.
  // A shared store, such as Redis, is required before horizontal or multi-instance deployment.
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${normalizedEmailKey(req)}`,
  handler: generic429,
  // MemoryStore is the smallest safe in-process implementation for this single backend deployment.
  // A shared store, such as Redis, is required before horizontal or multi-instance deployment.
})

const googleLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: generic429,
})

const googleLoginUser = createGoogleLoginHandler()

export const createAuthRouter = ({ otpHandlers = phoneOtpHandlers, otpControls = phoneOtpControls } = {}) => {
  const router = express.Router()
  const phoneOtpLimiter = (kind) => (req, res, next) => {
    const phone = normalizeIndianPhone(req.body?.phone)
    const ip = ipKeyGenerator(req.ip)
    const allowed = kind === 'send'
      ? otpControls.allowSend(ip, phone)
      : otpControls.allowVerify(ip, phone)
    if (!allowed) return generic429(req, res)
    return next()
  }

  const phoneOtpSendLimiter = phoneOtpLimiter('send')
  const phoneOtpVerifyLimiter = phoneOtpLimiter('verify')

  router.post('/register', registerLimiter, registerUser)
  router.post('/login', loginLimiter, loginUser)
  router.get('/google/nonce', protectGoogleLoginRequest, googleLoginNonce)
  router.post('/google', googleLoginLimiter, protectGoogleLoginRequest, googleLoginUser)
  router.post('/phone/register/send', protectPhoneOtpRequest, phoneOtpSendLimiter, otpHandlers.sendOtp)
  router.post('/phone/register/verify', protectPhoneOtpRequest, phoneOtpVerifyLimiter, otpHandlers.registerVerify)
  router.post('/phone/register', protectPhoneOtpRequest, phoneOtpVerifyLimiter, otpHandlers.registerVerify)
  router.post('/phone/login/send', protectPhoneOtpRequest, phoneOtpSendLimiter, otpHandlers.sendOtp)
  router.post('/phone/login/verify', protectPhoneOtpRequest, phoneOtpVerifyLimiter, otpHandlers.loginVerify)
  router.post('/phone/send-otp', protectPhoneOtpRequest, phoneOtpSendLimiter, otpHandlers.sendOtp)
  router.post('/phone/login', protectPhoneOtpRequest, phoneOtpVerifyLimiter, otpHandlers.loginVerify)
  router.post('/phone/link/send', protect, protectPhoneOtpRequest, phoneOtpSendLimiter, otpHandlers.linkSend)
  router.post('/phone/link/verify', protect, protectPhoneOtpRequest, phoneOtpVerifyLimiter, otpHandlers.linkVerify)
  router.post('/logout', protect, logoutUser)
  router.get('/profile', protect, getProfile)

  return router
}

const router = createAuthRouter()

export default router
