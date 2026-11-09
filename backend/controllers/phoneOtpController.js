import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { issueAuthSession } from './authController.js'
import { claimConsumedPhoneOtp } from '../services/consumedPhoneOtp.js'
import { normalizeIndianPhone } from '../services/indianPhoneNumber.js'
import { msg91OtpService } from '../services/msg91OtpService.js'
import { phoneOtpControls } from '../services/phoneOtpControls.js'

const genericAuthFailure = 'Phone authentication failed'
const registrationFailure = 'Registration could not be completed'
const setNoStore = (res) => res.set('Cache-Control', 'no-store')

const isHastonStoreContext = (req) => (
  req.contextType === 'STORE' && req.store?.slug === 'haston' && Number.isInteger(req.store.id)
)

const isHastonCustomer = (req) => (
  isHastonStoreContext(req) &&
  req.user?.isActive === true &&
  req.user.role === 'CUSTOMER' &&
  req.user.storeId === req.store.id
)

const isUniqueConflict = (error) => error?.code === 'P2002'
const isValidOtp = (otp) => typeof otp === 'string' && /^\d{1,12}$/.test(otp)

const logFailure = (event, error) => {
  const type = error instanceof Error ? error.constructor.name : 'Error'
  console.warn(JSON.stringify({ event, exceptionType: type }))
}

export const createPhoneOtpHandlers = ({
  prismaClient = prisma,
  otpService = msg91OtpService,
  otpClaimer = claimConsumedPhoneOtp,
  controls = phoneOtpControls,
  hashPassword = (password) => bcrypt.hash(password, 10),
  sessionIssuer = issueAuthSession,
} = {}) => {
  const getPhone = (req) => normalizeIndianPhone(req.body?.phone)

  const sendOtp = async (req, res) => {
    setNoStore(res)
    if (!isHastonStoreContext(req)) return res.status(409).json({ message: genericAuthFailure })
    const phone = getPhone(req)
    if (!phone) return res.status(400).json({ message: 'Enter a valid Indian phone number' })
    if (!controls.reserveCooldown(phone)) {
      return res.status(429).json({ message: 'Please wait before requesting another code' })
    }

    let sent = false
    try {
      sent = await otpService.sendOtp(phone)
    } catch (error) {
      logFailure('phone_otp_send_failure', error)
    }
    if (!sent) {
      controls.releaseCooldown(phone)
      return res.status(502).json({ message: 'Unable to send verification code' })
    }
    return res.status(200).json({ message: 'If eligible, a verification code was sent' })
  }

  const verifyOtp = async (req, phone) => {
    if (!phone || !isValidOtp(req.body?.otp)) return 'rejected'
    try {
      if (!(await otpService.verifyOtp(phone, req.body.otp))) return 'rejected'
      return await otpClaimer(prismaClient, phone, req.body.otp) ? 'claimed' : 'rejected'
    } catch (error) {
      logFailure('phone_otp_verification_failure', error)
      return 'unavailable'
    }
  }

  const registerVerify = async (req, res) => {
    setNoStore(res)
    if (!isHastonStoreContext(req)) return res.status(409).json({ message: registrationFailure })

    const phone = getPhone(req)
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = req.body?.password
    if (!phone || !isValidOtp(req.body?.otp) || !name || name.length > 120 ||
        !email.includes('@') || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: registrationFailure })
    }

    let verified = false
    try {
      verified = await otpService.verifyOtp(phone, req.body.otp)
    } catch (error) {
      logFailure('phone_otp_registration_provider_failure', error)
    }
    if (!verified) return res.status(401).json({ message: registrationFailure })

    let claimed
    try {
      claimed = await otpClaimer(prismaClient, phone, req.body.otp)
    } catch (error) {
      logFailure('phone_otp_registration_claim_failure', error)
      return res.status(500).json({ message: registrationFailure })
    }
    if (!claimed) return res.status(401).json({ message: registrationFailure })

    try {
      const existingIdentity = await prismaClient.authIdentity.findUnique({
        where: { provider_providerSubject: { provider: 'phone', providerSubject: phone } },
      })
      if (existingIdentity) {
        return res.status(409).json({
          code: 'PHONE_ALREADY_LINKED',
          message: 'This phone is already linked to an account. Please sign in.',
        })
      }

      const hashedPassword = await hashPassword(password)
      const user = await prismaClient.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: { name, email, password: hashedPassword, role: 'CUSTOMER', storeId: req.store.id },
        })
        await transaction.authIdentity.create({
          data: { provider: 'phone', providerSubject: phone, userId: createdUser.id },
        })
        return createdUser
      })
      const sanitizedUser = sessionIssuer(user, res)
      return res.status(201).json({ user: sanitizedUser, message: 'Registration successful' })
    } catch (error) {
      if (isUniqueConflict(error)) {
        return res.status(409).json({ message: registrationFailure })
      }
      logFailure('phone_otp_registration_failure', error)
      return res.status(500).json({ message: registrationFailure })
    }
  }

  const loginVerify = async (req, res) => {
    setNoStore(res)
    if (!isHastonStoreContext(req)) return res.status(409).json({ message: genericAuthFailure })
    const phone = getPhone(req)
    const claim = await verifyOtp(req, phone)
    if (claim !== 'claimed') {
      return res.status(claim === 'unavailable' ? 500 : 401).json({ message: genericAuthFailure })
    }

    try {
      let identity = await prismaClient.authIdentity.findUnique({
        where: { provider_providerSubject: { provider: 'phone', providerSubject: phone } },
        include: { user: true },
      })
      if (!identity) {
        try {
          const user = await prismaClient.$transaction(async (transaction) => {
            const createdUser = await transaction.user.create({
              data: { name: null, email: null, password: null, role: 'CUSTOMER', storeId: req.store.id },
            })
            await transaction.authIdentity.create({
              data: { provider: 'phone', providerSubject: phone, userId: createdUser.id },
            })
            return createdUser
          })
          identity = { user }
        } catch (error) {
          if (!isUniqueConflict(error)) throw error
          identity = await prismaClient.authIdentity.findUnique({
            where: { provider_providerSubject: { provider: 'phone', providerSubject: phone } },
            include: { user: true },
          })
        }
      }

      const user = identity?.user
      if (!user?.isActive || user.role !== 'CUSTOMER' || user.storeId !== req.store.id) {
        return res.status(401).json({ message: genericAuthFailure })
      }
      return res.status(200).json({ user: sessionIssuer(user, res), message: 'Login successful' })
    } catch (error) {
      logFailure('phone_otp_login_failure', error)
      return res.status(500).json({ message: genericAuthFailure })
    }
  }

  const linkSend = async (req, res) => {
    setNoStore(res)
    if (!isHastonCustomer(req)) return res.status(403).json({ message: genericAuthFailure })
    return sendOtp(req, res)
  }

  const linkVerify = async (req, res) => {
    setNoStore(res)
    if (!isHastonCustomer(req)) return res.status(403).json({ message: genericAuthFailure })
    const phone = getPhone(req)
    const claim = await verifyOtp(req, phone)
    if (claim !== 'claimed') {
      return res.status(claim === 'unavailable' ? 500 : 401).json({ message: genericAuthFailure })
    }

    try {
      await prismaClient.$transaction(async (transaction) => {
        const existingPhone = await transaction.authIdentity.findUnique({
          where: { provider_providerSubject: { provider: 'phone', providerSubject: phone } },
        })
        if (existingPhone && existingPhone.userId !== req.user.id) throw new Error('PHONE_ALREADY_LINKED')
        const currentPhone = await transaction.authIdentity.findUnique({
          where: { userId_provider: { userId: req.user.id, provider: 'phone' } },
        })
        if (currentPhone && currentPhone.providerSubject !== phone) throw new Error('ACCOUNT_PHONE_ALREADY_LINKED')
        if (!existingPhone) {
          await transaction.authIdentity.create({
            data: { provider: 'phone', providerSubject: phone, userId: req.user.id },
          })
        }
      })
      return res.status(200).json({ message: 'Phone linked successfully' })
    } catch (error) {
      if (isUniqueConflict(error) || ['PHONE_ALREADY_LINKED', 'ACCOUNT_PHONE_ALREADY_LINKED'].includes(error?.message)) {
        return res.status(409).json({ message: genericAuthFailure })
      }
      logFailure('phone_otp_link_failure', error)
      return res.status(500).json({ message: genericAuthFailure })
    }
  }

  return { sendOtp, registerVerify, loginVerify, linkSend, linkVerify }
}

export const phoneOtpHandlers = createPhoneOtpHandlers()
