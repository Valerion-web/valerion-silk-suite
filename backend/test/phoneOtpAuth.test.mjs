import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import jwt from 'jsonwebtoken'
import { test } from 'node:test'
import { createLoginUserHandler } from '../controllers/authController.js'
import { createPhoneOtpHandlers } from '../controllers/phoneOtpController.js'
import { createAuthRouter } from '../routes/authRoutes.js'
import csrfMiddleware from '../middleware/csrfMiddleware.js'
import { createConsumedPhoneOtpClaimer } from '../services/consumedPhoneOtp.js'
import { normalizeIndianPhone } from '../services/indianPhoneNumber.js'
import { createMsg91OtpService } from '../services/msg91OtpService.js'
import { createPhoneOtpControls } from '../services/phoneOtpControls.js'

process.env.CORS_ORIGINS = 'https://haston.test'
process.env.JWT_SECRET = 'phone-otp-test-secret'
process.env.NODE_ENV = 'test'

const phone = '+919876543210'

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  cookies: {},
  headers: {},
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  set(name, value) { this.headers[name] = value; return this },
  cookie(name, value, options) { this.cookies[name] = { value, options }; return this },
})

const makeDatabase = () => {
  const state = { users: [], identities: [], claims: new Set(), nextId: 1 }
  const client = {
    user: {
      findUnique: async ({ where }) => state.users.find((user) => user.email === where.email || user.id === where.id) || null,
      create: async ({ data }) => {
        if (state.users.some((user) => user.email && user.email === data.email)) {
          throw Object.assign(new Error('duplicate email'), { code: 'P2002' })
        }
        const user = { id: state.nextId++, isActive: true, ...data }
        state.users.push(user)
        return user
      },
    },
    authIdentity: {
      findUnique: async ({ where, include }) => {
        const match = where.provider_providerSubject
          ? state.identities.find((item) => item.provider === where.provider_providerSubject.provider && item.providerSubject === where.provider_providerSubject.providerSubject)
          : state.identities.find((item) => item.userId === where.userId_provider.userId && item.provider === where.userId_provider.provider)
        if (!match || !include?.user) return match || null
        return { ...match, user: state.users.find((user) => user.id === match.userId) || null }
      },
      create: async ({ data }) => {
        if (state.identities.some((item) => item.provider === data.provider && item.providerSubject === data.providerSubject)) {
          throw Object.assign(new Error('duplicate identity'), { code: 'P2002' })
        }
        const identity = { id: state.identities.length + 1, ...data }
        state.identities.push(identity)
        return identity
      },
    },
    $transaction: async (operation) => operation(client),
  }
  return { client, state }
}

const createHandlers = (database = makeDatabase()) => {
  const consumed = new Set()
  const handlers = createPhoneOtpHandlers({
    prismaClient: database.client,
    otpService: { sendOtp: async () => true, verifyOtp: async () => true },
    otpClaimer: async (_client, verifiedPhone, otp) => {
      const key = `${verifiedPhone}:${otp}`
      if (consumed.has(key)) return false
      consumed.add(key)
      return true
    },
    hashPassword: async (password) => `hashed:${password}`,
  })
  return { handlers, database }
}

const makeRequest = ({ body = {}, user, contextType = 'STORE' } = {}) => ({
  body,
  user,
  contextType,
  store: { id: 7, slug: 'haston' },
})

test('phone normalization accepts valid Indian formats only', () => {
  assert.equal(normalizeIndianPhone('9876543210'), phone)
  assert.equal(normalizeIndianPhone('919876543210'), phone)
  assert.equal(normalizeIndianPhone(phone), phone)
  assert.equal(normalizeIndianPhone('+14155552671'), null)
  assert.equal(normalizeIndianPhone('123'), null)
})

test('OTP registration creates a customer and phone identity together', async () => {
  const { handlers, database } = createHandlers()
  const response = makeResponse()
  await handlers.registerVerify(makeRequest({
    body: { phone, otp: '123456', name: 'New Customer', email: 'NEW@example.test', password: 'password-123' },
  }), response)

  assert.equal(response.statusCode, 201)
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.users[0].email, 'new@example.test')
  assert.equal(database.state.users[0].password, 'hashed:password-123')
  assert.deepEqual(database.state.identities.map(({ provider, providerSubject, userId }) => ({ provider, providerSubject, userId })), [
    { provider: 'phone', providerSubject: phone, userId: database.state.users[0].id },
  ])
  const replay = makeResponse()
  await handlers.loginVerify(makeRequest({ body: { phone, otp: '123456' } }), replay)
  assert.equal(replay.statusCode, 401)
})

test('OTP login supports an existing account with null email and password', async () => {
  const { handlers, database } = createHandlers()
  const response = makeResponse()
  await handlers.loginVerify(makeRequest({ body: { phone, otp: '654321' } }), response)

  assert.equal(response.statusCode, 200)
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.users[0].email, null)
  assert.equal(database.state.users[0].password, null)
  assert.equal(response.body.user.email, null)
  assert.equal(database.state.identities[0].providerSubject, phone)
  assert.equal(jwt.verify(response.cookies.token.value, process.env.JWT_SECRET).email, null)
})

test('an OTP claim cannot be replayed for login', async () => {
  const { handlers, database } = createHandlers()
  const first = makeResponse()
  const second = makeResponse()
  await handlers.loginVerify(makeRequest({ body: { phone, otp: '111111' } }), first)
  await handlers.loginVerify(makeRequest({ body: { phone, otp: '111111' } }), second)

  assert.equal(first.statusCode, 200)
  assert.equal(second.statusCode, 401)
  assert.equal(database.state.users.length, 1)
})

test('authenticated phone linking attaches identity only to current customer', async () => {
  const { handlers, database } = createHandlers()
  const user = { id: 29, isActive: true, role: 'CUSTOMER', storeId: 7 }
  const response = makeResponse()
  await handlers.linkVerify(makeRequest({ user, body: { phone, otp: '222222' } }), response)

  assert.equal(response.statusCode, 200)
  assert.equal(database.state.identities[0].userId, user.id)
  const wrongStore = makeResponse()
  await handlers.linkVerify(makeRequest({
    user: { ...user, storeId: 8 },
    body: { phone: '+919876543211', otp: '333333' },
  }), wrongStore)
  assert.equal(wrongStore.statusCode, 403)
  const replay = makeResponse()
  await handlers.linkVerify(makeRequest({ user, body: { phone, otp: '222222' } }), replay)
  assert.equal(replay.statusCode, 401)
})

test('duplicate consumed OTP digests are rejected without storing OTP values', async () => {
  const records = new Map()
  const prismaClient = {
    $transaction: (operation) => operation({
      consumedPhoneOtp: {
        deleteMany: async ({ where }) => {
          const current = records.get(where.digest)
          if (current && current.expiresAt <= where.expiresAt.lte) records.delete(where.digest)
        },
        create: async ({ data }) => {
          if (records.has(data.digest)) throw Object.assign(new Error('duplicate'), { code: 'P2002' })
          records.set(data.digest, data)
        },
      },
    }),
  }
  const claim = createConsumedPhoneOtpClaimer({ getJwtSecret: () => 'phone-otp-test-secret' })
  assert.equal(await claim(prismaClient, phone, '123456'), true)
  assert.equal(await claim(prismaClient, phone, '123456'), false)
  assert.equal([...records.keys()][0].includes('123456'), false)
})

test('MSG91 OTP provider uses configured values and requires explicit success', async () => {
  let capturedUrl
  const service = createMsg91OtpService({
    env: { MSG91_AUTH_KEY: 'test-key', MSG91_OTP_TEMPLATE_ID: 'test-template' },
    fetchImpl: async (url) => {
      capturedUrl = new URL(url)
      return { ok: true, json: async () => ({ type: 'success', request_id: 'request-id' }) }
    },
  })
  assert.equal(await service.sendOtp(phone), true)
  assert.equal(capturedUrl.pathname, '/api/v5/otp')
  assert.equal(capturedUrl.searchParams.get('template_id'), 'test-template')
  assert.equal(capturedUrl.searchParams.get('mobile'), phone)

  const unconfigured = createMsg91OtpService({ env: {}, fetchImpl: async () => {
    throw new Error('must not call provider')
  }, logger: { warn() {} } })
  assert.equal(await unconfigured.sendOtp(phone), false)
})

test('email/password login rejects passwordless users without attempting comparison', async () => {
  const handler = createLoginUserHandler({
    prismaClient: { user: { findUnique: async () => ({
      id: 1, email: null, password: null, role: 'CUSTOMER', isActive: true, storeId: 7,
    }) } },
  })
  const response = makeResponse()
  await handler({
    body: { email: 'phone-user@example.test', password: 'incorrect' },
    contextType: 'STORE',
    store: { id: 7 },
  }, response)
  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.body, { message: 'Authentication failed' })
})

test('phone OTP routes reject missing Origin and mismatched CSRF before handlers run', async (t) => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.store = { id: 7, slug: 'haston' }
    req.contextType = 'STORE'
    next()
  })
  app.use(csrfMiddleware)
  app.use('/api/auth', createAuthRouter())
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => {
    server.close(resolve)
    server.closeAllConnections?.()
  }))
  const url = `http://127.0.0.1:${server.address().port}/api/auth/phone/login/send`

  const missingOrigin = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'csrf_token=csrf123', 'x-csrf-token': 'csrf123' },
    body: JSON.stringify({ phone }),
  })
  assert.equal(missingOrigin.status, 403)

  const mismatchedCsrf = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://haston.test',
      cookie: 'csrf_token=csrf123',
      'x-csrf-token': 'wrong',
    },
    body: JSON.stringify({ phone }),
  })
  assert.equal(mismatchedCsrf.status, 403)
})

test('phone OTP send limits and cooldowns are enforced', () => {
  const controls = createPhoneOtpControls({ clock: () => 1_000 })
  assert.equal(controls.allowSend('127.0.0.1', phone), true)
  assert.equal(controls.allowSend('127.0.0.1', phone), true)
  assert.equal(controls.allowSend('127.0.0.1', phone), true)
  assert.equal(controls.allowSend('127.0.0.1', phone), false)
  assert.equal(controls.reserveCooldown(phone), true)
  assert.equal(controls.reserveCooldown(phone), false)
  controls.releaseCooldown(phone)
  assert.equal(controls.reserveCooldown(phone), true)
})
