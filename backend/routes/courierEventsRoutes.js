import express from 'express'
import prisma from '../lib/prisma.js'
import { createCourierTrackingWebhookHandler } from '../services/courierTrackingWebhook.js'

const router = express.Router()
router.post('/', createCourierTrackingWebhookHandler({ prismaClient: prisma }))

export default router
