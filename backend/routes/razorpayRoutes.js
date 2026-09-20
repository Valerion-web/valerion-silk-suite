import express from 'express'
import { protect } from '../middleware/authMiddleware.js'
import { requireConcreteStore } from '../middleware/storeMiddleware.js'
import { createRazorpayOrder, verifyRazorpayPayment } from '../controllers/razorpayController.js'

const router = express.Router()
router.use(protect, requireConcreteStore)
router.post('/order', createRazorpayOrder)
router.post('/verify', verifyRazorpayPayment)

export default router