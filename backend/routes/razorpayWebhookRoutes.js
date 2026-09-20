import express from 'express'
import { receiveRazorpayWebhook } from '../controllers/razorpayWebhookController.js'

const router = express.Router()

router.post('/', express.raw({ type: 'application/json', limit: '64kb' }), receiveRazorpayWebhook)

export default router
