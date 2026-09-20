import express from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { loginUser, logoutUser, registerUser, getProfile } from '../controllers/authController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

const normalizedEmailKey = (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknown-email'
  return email
}

const generic429 = (req, res) => {
  res.status(429).json({ message: 'Too many requests. Please try again later.' })
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

router.post('/register', registerLimiter, registerUser)
router.post('/login', loginLimiter, loginUser)
router.post('/logout', protect, logoutUser)
router.get('/profile', protect, getProfile)

export default router
