import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { issueAuthSession } from '../services/authSession.js'
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

const getPhone = (req) => normalizeIndianPhone(req.body?.phone)

const validOtp = (value) => typeof value === 'string' && /^\d{1,12}$/.test(value)

const isUniqueConflict = (error) => error?.code === 'P2002'
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const safeExceptionTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'PrismaClientKnownRequestError',
  'PrismaClientUnknownRequestError',
  'PrismaClientValidationError',
  'PrismaClientInitializationError',
])

const getRequestCorrelationId = (req, requestIdFactory) => {
  const existingId = req.requestId ?? req.id
  return typeof existingId === 'string' && requestIdPattern.test(existingId)
    ? existingId
    : requestIdFactory()
}

const getSafeExceptionType = (error) => {
  const type = error instanceof Error ? error.constructor.name : ''
  return safeExceptionTypes.has(type) ? type : 'Error'
}

const uniqueConstraintLabelsByFields = new Map([
  ['email', 'user_email'],
  ['provider,providerSubject', 'provider_subject'],
  ['provider,userId', 'user_provider'],
])
const uniqueConstraintLabelsByName = new Map([
  ['User_email_key', 'user_email'],
  ['User_pkey', 'user_id'],
  ['AuthIdentity_pkey', 'auth_identity_id'],
  ['AuthIdentity_provider_providerSubject_key', 'provider_subject'],
  ['AuthIdentity_userId_provider_key', 'user_provider'],
])
const safeUniqueConflictOperations = new Set(['user_create', 'auth_identity_create', 'unknown'])

const getSafeUniqueConstraint = (error) => {
  if (error?.code !== 'P2002') return 'unknown'
  const target = error.meta?.target
  if (Array.isArray(target) && target.every((field) => typeof field === 'string')) {
    return uniqueConstraintLabelsByFields.get([...target].sort().join(',')) || 'unknown'
  }
  if (typeof target === 'string') return uniqueConstraintLabelsByName.get(target) || 'unknown'
  return 'unknown'
}

const logRegistrationFailure = ({ logger, requestIdFactory, req, stage, reasonCode, error, operation }) => {
  try {
    const event = {
      event: 'phone_registration_failure',
      requestId: getRequestCorrelationId(req, requestIdFactory),
      stage,
      reasonCode,
    }
    if (error) event.exceptionType = getSafeExceptionType(error)
    if (reasonCode === 'PHONE_REGISTRATION_UNIQUE_CONFLICT') {
      event.uniqueConstraint = getSafeUniqueConstraint(error)
      event.operation = safeUniqueConflictOperations.has(operation) ? operation : 'unknown'
    }
    logger?.warn?.(JSON.stringify(event))
  } catch {
    return
  }
}

export const createPhoneOtpHandlers = ({
  prismaClient = prisma,
  otpService = msg91OtpService,
  otpClaimer = claimConsumedPhoneOtp,
  controls = phoneOtpControls,
  hashPassword = (password) => bcrypt.hash(password, 10),
  sessionIssuer = issueAuthSession,
  logger = console,
  requestIdFactory = randomUUID,
} = {}) => {
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
    } catch {
      sent = false
    }
    if (!sent) {
      controls.releaseCooldown(phone)
      return res.status(502).json({ message: 'Unable to send verification code' })
    }

    return res.status(200).json({ message: 'If eligible, a verification code was sent' })
  }

  const verifyProviderOtp = async (req, phone, onError) => {
    if (!phone || !validOtp(req.body?.otp)) return false
    try {
      return await otpService.verifyOtp(phone, req.body.otp)
    } catch (error) {
      onError?.(error)
      return false
    }
  }

  const verifyAndClaimOtp = async (req, phone) => {
    if (!(await verifyProviderOtp(req, phone))) return 'rejected'
    try {
      return await otpClaimer(prismaClient, phone, req.body.otp) ? 'claimed' : 'rejected'
    } catch {
      return 'unavailable'
    }
  }

  const registerVerify = async (req, res) => {
    setNoStore(res)
    if (!isHastonStoreContext(req)) {
      logRegistrationFailure({ logger, requestIdFactory, req, stage: 'store_context', reasonCode: 'PHONE_REGISTRATION_STORE_CONTEXT_MISMATCH' })
      return res.status(409).json({ message: registrationFailure })
    }

    const phone = getPhone(req)
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = req.body?.password
    if (!phone || !validOtp(req.body?.otp) || !name || name.length > 120 || !email.includes('@') ||
        typeof password !== 'string' || password.length < 8) {
      logRegistrationFailure({ logger, requestIdFactory, req, stage: 'request_validation', reasonCode: 'PHONE_REGISTRATION_REQUEST_INVALID' })
      return res.status(400).json({ message: registrationFailure })
    }

    let providerError
    if (!(await verifyProviderOtp(req, phone, (error) => { providerError = error }))) {
      logRegistrationFailure({
        logger,
        requestIdFactory,
        req,
        stage: 'provider_verification',
        reasonCode: 'PHONE_REGISTRATION_PROVIDER_VERIFICATION_REJECTED',
        error: providerError,
      })
      return res.status(401).json({ message: registrationFailure })
    }

    let otpClaimed
    try {
      otpClaimed = await otpClaimer(prismaClient, phone, req.body.otp)
    } catch (error) {
      logRegistrationFailure({ logger, requestIdFactory, req, stage: 'otp_claim', reasonCode: 'PHONE_REGISTRATION_OTP_CLAIM_FAILED', error })
      return res.status(500).json({ message: registrationFailure })
    }
    if (!otpClaimed) {
      logRegistrationFailure({ logger, requestIdFactory, req, stage: 'otp_claim', reasonCode: 'PHONE_REGISTRATION_OTP_CLAIM_REJECTED' })
      return res.status(401).json({ message: registrationFailure })
    }

    let user
    let accountCreationOperation = 'unknown'
    try {
      const hashedPassword = await hashPassword(password)
      user = await prismaClient.$transaction(async (transaction) => {
        accountCreationOperation = 'user_create'
        const createdUser = await transaction.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            role: 'CUSTOMER',
            storeId: req.store.id,
          },
        })
        accountCreationOperation = 'unknown'
        accountCreationOperation = 'auth_identity_create'
        await transaction.authIdentity.create({
          data: { provider: 'phone', providerSubject: phone, userId: createdUser.id },
        })
        accountCreationOperation = 'unknown'
        return createdUser
      })
    } catch (error) {
      if (isUniqueConflict(error)) {
        logRegistrationFailure({ logger, requestIdFactory, req, stage: 'account_creation', reasonCode: 'PHONE_REGISTRATION_UNIQUE_CONFLICT', error, operation: accountCreationOperation })
        return res.status(409).json({ message: registrationFailure })
      }
      logRegistrationFailure({ logger, requestIdFactory, req, stage: 'account_creation', reasonCode: 'PHONE_REGISTRATION_ACCOUNT_CREATION_FAILED', error })
      return res.status(500).json({ message: registrationFailure })
    }

    try {
      const sanitizedUser = issueAuthSession(user, res)
      return res.status(201).json({ user: sanitizedUser, message: 'Registration successful' })
    } catch (error) {
      logRegistrationFailure({ logger, requestIdFactory, req, stage: 'session_issuance', reasonCode: 'PHONE_REGISTRATION_SESSION_ISSUANCE_FAILED', error })
      return res.status(500).json({ message: registrationFailure })
    }
  }

  const loginVerify = async (req, res) => {
    setNoStore(res)
    if (!isHastonStoreContext(req)) return res.status(409).json({ message: genericAuthFailure })

    const phone = getPhone(req)
    if (!phone || !validOtp(req.body?.otp)) {
      return res.status(400).json({ message: genericAuthFailure })
    }
    const otpClaim = await verifyAndClaimOtp(req, phone)
    if (otpClaim !== 'claimed') {
      if (otpClaim === 'unavailable') return res.status(500).json({ message: genericAuthFailure })
      return res.status(401).json({ message: genericAuthFailure })
    }

    try {
      const identity = await prismaClient.authIdentity.findUnique({
        where: { provider_providerSubject: { provider: 'phone', providerSubject: phone } },
        include: { user: true },
      })
      const user = identity?.user
      if (!identity || !user || user.isActive !== true || user.role !== 'CUSTOMER' || user.storeId !== req.store.id) {
        return res.status(401).json({
          code: 'PHONE_ACCOUNT_NOT_FOUND',
          message: 'No account is linked to this phone number.',
        })
      }
      const sanitizedUser = issueAuthSession(user, res)
      return res.status(200).json({ user: sanitizedUser, message: 'Login successful' })
    } catch {
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
    if (!phone || !validOtp(req.body?.otp)) return res.status(400).json({ message: genericAuthFailure })
    const otpClaim = await verifyAndClaimOtp(req, phone)
    if (otpClaim !== 'claimed') {
      if (otpClaim === 'unavailable') return res.status(500).json({ message: genericAuthFailure })
      return res.status(401).json({ message: genericAuthFailure })
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
      return res.status(500).json({ message: genericAuthFailure })
    }
  }

  return { sendOtp, registerVerify, loginVerify, linkSend, linkVerify }
}

export const phoneOtpHandlers = createPhoneOtpHandlers()