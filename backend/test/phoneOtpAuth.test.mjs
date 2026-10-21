import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import jwt from 'jsonwebtoken'
import { test } from 'node:test'
import { createPhoneOtpHandlers } from '../controllers/phoneOtpController.js'
import { createAuthRouter } from '../routes/authRoutes.js'
import csrfMiddleware from '../middleware/csrfMiddleware.js'
import { normalizeIndianPhone } from '../services/indianPhoneNumber.js'
import { createMsg91OtpService } from '../services/msg91OtpService.js'
import { createConsumedPhoneOtpClaimer } from '../services/consumedPhoneOtp.js'
import { createPhoneOtpControls } from '../services/phoneOtpControls.js'

const testJwtSecret = 'phone-otp-test-jwt-secret'
process.env.JWT_SECRET = testJwtSecret
process.env.JWT_EXPIRES_IN = '7d'
process.env.NODE_ENV = 'test'
process.env.CORS_ORIGINS = 'https://haston.test'

const phone = '+919876543210'
const testUser = (overrides = {}) => ({
  id: 41,
  name: 'HASTON Customer',
  email: 'customer@example.test',
  password: 'test-hash',
  role: 'CUSTOMER',
  isActive: true,
  storeId: 7,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
})

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  cookies: {},
  headers: {},
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  },
  set(name, value) {
    this.headers[name] = value
    return this
  },
  cookie(name, value, options) {
    this.cookies[name] = { value, options }
    return this
  },
})

const makeRequest = ({ body = {}, user, store, contextType = 'STORE' } = {}) => ({
  body,
  user,
  store: store || { id: 7, slug: 'haston' },
  contextType,
})

const makeDatabase = ({ users = [], identities = [], userCreateError, identityCreateError, accountCreationTransactionError } = {}) => {
  const state = {
    users: users.map((user) => ({ ...user })),
    identities: identities.map((identity) => ({ ...identity })),
    consumedPhoneOtps: [],
    nextUserId: Math.max(0, ...users.map((user) => user.id || 0)) + 1,
  }

  const makeClient = (target) => ({
    user: {
      findUnique: async ({ where }) => target.users.find((user) => (
        (where.email !== undefined && user.email === where.email) ||
        (where.id !== undefined && user.id === where.id)
      )) || null,
      create: async ({ data }) => {
        if (userCreateError) throw userCreateError
        if (target.users.some((user) => user.email === data.email)) {
          throw Object.assign(new Error('unique email'), { code: 'P2002', meta: { target: ['email'] } })
        }
        const user = {
          id: target.nextUserId++,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }
        target.users.push(user)
        return user
      },
    },
    authIdentity: {
      findUnique: async ({ where, include }) => {
        const compound = where.provider_providerSubject
        const identity = target.identities.find((candidate) => (
          (compound && candidate.provider === compound.provider && candidate.providerSubject === compound.providerSubject) ||
          (where.userId_provider && candidate.userId === where.userId_provider.userId && candidate.provider === where.userId_provider.provider)
        )) || null
        if (!identity || !include?.user) return identity
        return { ...identity, user: target.users.find((user) => user.id === identity.userId) || null }
      },
      create: async ({ data }) => {
        if (target.identities.some((identity) => identity.provider === data.provider && identity.providerSubject === data.providerSubject)) {
          throw Object.assign(new Error('unique phone identity'), { code: 'P2002', meta: { target: ['provider', 'providerSubject'] } })
        }
        if (target.identities.some((identity) => identity.userId === data.userId && identity.provider === data.provider)) {
          throw Object.assign(new Error('unique user provider identity'), { code: 'P2002', meta: { target: ['userId', 'provider'] } })
        }
        if (identityCreateError) throw identityCreateError
        const identity = { id: target.identities.length + 1, ...data }
        target.identities.push(identity)
        return identity
      },
    },
    consumedPhoneOtp: {
      deleteMany: async ({ where }) => {
        const before = target.consumedPhoneOtps.length
        target.consumedPhoneOtps = target.consumedPhoneOtps.filter((claim) => (
          claim.digest !== where.digest || claim.expiresAt > where.expiresAt.lte
        ))
        return { count: before - target.consumedPhoneOtps.length }
      },
      create: async ({ data }) => {
        if (target.consumedPhoneOtps.some((claim) => claim.digest === data.digest)) {
          throw Object.assign(new Error('unique consumed OTP digest'), { code: 'P2002' })
        }
        const claim = { id: `claim-${target.consumedPhoneOtps.length + 1}`, createdAt: new Date(), ...data }
        target.consumedPhoneOtps.push(claim)
        return claim
      },
    },
  })

  let transactionQueue = Promise.resolve()
  const client = makeClient(state)
  client.$transaction = async (operation) => {
    const previous = transactionQueue
    let release
    transactionQueue = new Promise((resolve) => { release = resolve })
    await previous
    const draft = {
      users: state.users.map((user) => ({ ...user })),
      identities: state.identities.map((identity) => ({ ...identity })),
      consumedPhoneOtps: state.consumedPhoneOtps.map((claim) => ({ ...claim })),
      nextUserId: state.nextUserId,
    }
    try {
      const result = await operation(makeClient(draft))
      if (accountCreationTransactionError &&
          (draft.users.length > state.users.length || draft.identities.length > state.identities.length)) {
        throw accountCreationTransactionError
      }
      state.users = draft.users
      state.identities = draft.identities
      state.consumedPhoneOtps = draft.consumedPhoneOtps
      state.nextUserId = draft.nextUserId
      return result
    } finally {
      release()
    }
  }

  return { client, state }
}

const createHandlers = ({ database = makeDatabase(), otpService, otpClaimer, controls = createPhoneOtpControls(), logger, requestIdFactory } = {}) => ({
  ...createPhoneOtpHandlers({
    prismaClient: database.client,
    otpService: otpService || { sendOtp: async () => true, verifyOtp: async () => true },
    otpClaimer,
    controls,
    hashPassword: async (password) => `hashed:${password}`,
    logger,
    requestIdFactory,
  }),
  database,
  controls,
})

const mountAuthRouter = async ({ database = makeDatabase(), otpService, controls = createPhoneOtpControls(), trustProxy } = {}) => {
  const handlers = createHandlers({ database, otpService, controls })
  const app = express()
  if (trustProxy) app.set('trust proxy', trustProxy)
  app.use(express.json())
  app.use((req, res, next) => {
    req.store = { id: 7, slug: 'haston' }
    req.contextType = 'STORE'
    next()
  })
  app.use(csrfMiddleware)
  app.use('/api/auth', createAuthRouter({ otpHandlers: handlers, otpControls: controls }))
  app.use((error, req, res, next) => res.status(res.statusCode >= 400 ? res.statusCode : 500).json({ message: 'Request failed' }))

  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`

  return {
    handlers,
    controls,
    database,
    async post(path, body = {}, headers = {}) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://haston.test',
          cookie: 'csrf_token=csrf123',
          'x-csrf-token': 'csrf123',
          ...headers,
        },
        body: JSON.stringify(body),
      })
      return { status: response.status, body: await response.json() }
    },
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
      server.closeAllConnections?.()
    }),
  }
}

const assertExistingSession = (response, user, expectedStatus, message, isProduction = false) => {
  assert.equal(response.statusCode, expectedStatus)
  assert.deepEqual(response.body, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name || '',
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    message,
  })

  const claims = jwt.verify(response.cookies.token.value, testJwtSecret)
  assert.deepEqual(Object.keys(claims).sort(), ['email', 'exp', 'iat', 'id', 'role'])
  assert.deepEqual({ id: claims.id, email: claims.email, role: claims.role }, {
    id: user.id,
    email: user.email,
    role: user.role,
  })
  assert.equal(claims.exp - claims.iat, 7 * 24 * 60 * 60)
  assert.deepEqual(response.cookies.token.options, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

test('India-only phone parser normalizes national and international input', () => {
  assert.equal(normalizeIndianPhone('9876543210'), phone)
  assert.equal(normalizeIndianPhone('919876543210'), phone)
  assert.equal(normalizeIndianPhone(phone), phone)
  assert.equal(normalizeIndianPhone('+14155552671'), null)
  assert.equal(normalizeIndianPhone('123'), null)
})

test('SendOTP uses isolated configured request details and requires explicit success', async () => {
  let captured
  const service = createMsg91OtpService({
    env: { MSG91_AUTH_KEY: 'test-auth-key', MSG91_OTP_TEMPLATE_ID: 'test-template-id' },
    fetchImpl: async (url, options) => {
      captured = { url: new URL(url), options }
      return { ok: true, json: async () => ({ type: 'success', request_id: 'test-request-id' }) }
    },
  })

  assert.equal(await service.sendOtp(phone), true)
  assert.equal(captured.url.pathname, '/api/v5/otp')
  assert.equal(captured.url.searchParams.get('template_id'), 'test-template-id')
  assert.equal(captured.url.searchParams.get('mobile'), phone)
  assert.equal(captured.options.method, 'POST')
  assert.deepEqual(JSON.parse(captured.options.body), { otp_expiry: 5 })
  assert.equal(captured.options.headers.authkey, 'test-auth-key')
})

test('Verify accepts only an explicit provider success and treats ambiguous payloads as failure', async () => {
  let captured
  const responseQueue = [
    { ok: true, body: { message: 'OTP verified success' } },
    { ok: true, body: { type: 'success', message: 'OTP verified success' } },
    { ok: true, body: { type: 'success', message: 'verified' } },
    { ok: true, body: { type: 'success', message: 'OTP expired' } },
    { ok: true, body: { type: 'error', message: 'OTP verified success' } },
    { ok: true, body: { type: 'error', message: 'Invalid OTP' } },
    { ok: true, body: { type: 'error', message: 'OTP Expired' } },
    { ok: true, body: { message: 'verified' } },
    { ok: true, body: { type: 'success' } },
    { ok: false, body: { type: 'success', message: 'verified' } },
    { ok: true, invalidJson: true },
  ]
  const service = createMsg91OtpService({
    env: { MSG91_AUTH_KEY: 'test-auth-key', MSG91_OTP_TEMPLATE_ID: 'test-template-id' },
    fetchImpl: async (url, options) => {
      captured = { url: new URL(url), options }
      const result = responseQueue.shift()
      return { ok: result.ok, json: async () => {
        if (result.invalidJson) throw new Error('invalid JSON')
        return result.body
      } }
    },
  })

  assert.equal(await service.verifyOtp(phone, '123456'), true)
  assert.equal(await service.verifyOtp(phone, '123456'), true)
  assert.equal(captured.url.pathname, '/api/v5/otp/verify')
  assert.equal(captured.url.searchParams.get('mobile'), phone)
  assert.equal(captured.url.searchParams.get('otp'), '123456')
  assert.equal(captured.options.headers.authkey, 'test-auth-key')
  for (let index = 0; index < 8; index += 1) assert.equal(await service.verifyOtp(phone, '123456'), false)
})

test('unconfigured provider fails closed without calling fetch', async () => {
  let calls = 0
  const service = createMsg91OtpService({ env: {}, fetchImpl: async () => { calls += 1 } })
  assert.equal(await service.sendOtp(phone), false)
  assert.equal(await service.verifyOtp(phone, '123456'), false)
  assert.equal(calls, 0)
})

test('registration verifies first, creates both records transactionally, then issues existing session', async () => {
  const database = makeDatabase()
  let verificationCalls = 0
  const handlers = createHandlers({
    database,
    otpService: {
      sendOtp: async () => true,
      verifyOtp: async (mobile, otp) => {
        verificationCalls += 1
        return mobile === phone && otp === '123456'
      },
    },
  })
  const response = makeResponse()
  await handlers.registerVerify(makeRequest({ body: {
    phone: '9876543210', otp: '123456', name: 'New Customer', email: 'NEW@example.test', password: 'password-123',
  } }), response)

  assert.equal(verificationCalls, 1)
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.identities.length, 1)
  assert.equal(database.state.users[0].email, 'new@example.test')
  assert.equal(database.state.identities[0].provider, 'phone')
  assert.equal(database.state.identities[0].providerSubject, phone)
  assert.equal(database.state.consumedPhoneOtps.length, 1)
  assert.match(database.state.consumedPhoneOtps[0].digest, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(database.state.consumedPhoneOtps).includes('123456'), false)
  assertExistingSession(response, database.state.users[0], 201, 'Registration successful')
  assert.equal(response.headers['Cache-Control'], 'no-store')
})

test('registration does not create an account or session when provider verification fails', async () => {
  const database = makeDatabase()
  const handlers = createHandlers({ database, otpService: { sendOtp: async () => true, verifyOtp: async () => false } })
  const response = makeResponse()
  await handlers.registerVerify(makeRequest({ body: {
    phone, otp: '123456', name: 'New Customer', email: 'new@example.test', password: 'password-123',
  } }), response)
  assert.equal(response.statusCode, 401)
  assert.equal(database.state.users.length, 0)
  assert.equal(database.state.identities.length, 0)
  assert.equal(response.cookies.token, undefined)
})

test('registration store-context conflict logs a correlated sanitized diagnostic', async () => {
  const events = []
  const requestId = 'a5108d34-ecc9-4f0f-a958-c9161f5a2334'
  const handlers = createHandlers({
    logger: { warn: (entry) => events.push(JSON.parse(entry)) },
    requestIdFactory: () => { throw new Error('existing request ID should be reused') },
  })
  const req = makeRequest({
    body: { phone, otp: '123456', name: 'Private Name', email: 'private@example.test', password: 'private-password' },
    store: { id: 8, slug: 'other-store' },
  })
  req.requestId = requestId
  const response = makeResponse()

  await handlers.registerVerify(req, response)

  assert.equal(response.statusCode, 409)
  assert.deepEqual(response.body, { message: 'Registration could not be completed' })
  assert.deepEqual(events, [{
    event: 'phone_registration_failure',
    requestId,
    stage: 'store_context',
    reasonCode: 'PHONE_REGISTRATION_STORE_CONTEXT_MISMATCH',
  }])
  assert.equal(JSON.stringify(events).includes(phone), false)
  assert.equal(JSON.stringify(events).includes('private@example.test'), false)
  assert.equal(JSON.stringify(events).includes('private-password'), false)
})

test('duplicate email rejects registration without linking an existing account', async () => {
  const existing = testUser()
  const database = makeDatabase({ users: [existing] })
  const events = []
  const requestId = '97510d01-8119-45f4-bae0-f4c3b5fe56fb'
  const handlers = createHandlers({
    database,
    logger: { warn: (entry) => events.push(JSON.parse(entry)) },
    requestIdFactory: () => requestId,
  })
  const response = makeResponse()
  await handlers.registerVerify(makeRequest({ body: {
    phone, otp: '123456', name: 'Other Customer', email: existing.email, password: 'password-123',
  } }), response)
  assert.equal(response.statusCode, 409)
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.identities.length, 0)
  assert.equal(response.cookies.token, undefined)
  assert.deepEqual(events, [{
    event: 'phone_registration_failure',
    requestId,
    stage: 'account_creation',
    reasonCode: 'PHONE_REGISTRATION_UNIQUE_CONFLICT',
    exceptionType: 'Error',
    uniqueConstraint: 'user_email',
    operation: 'user_create',
  }])
  assert.equal(JSON.stringify(events).includes(phone), false)
  assert.equal(JSON.stringify(events).includes(existing.email), false)
  assert.equal(JSON.stringify(events).includes('unique email'), false)
})

test('duplicate phone identity rejects registration and rolls back its new user', async () => {
  const existing = testUser()
  const database = makeDatabase({
    users: [existing],
    identities: [{ id: 1, provider: 'phone', providerSubject: phone, userId: existing.id }],
  })
  const response = makeResponse()
  const events = []
  const handlers = createHandlers({
    database,
    logger: { warn: (entry) => events.push(JSON.parse(entry)) },
    requestIdFactory: () => '851487f8-7ca0-4769-a3a7-ea85901ebf55',
  })
  await handlers.registerVerify(makeRequest({ body: {
    phone, otp: '123456', name: 'Second Customer', email: 'second@example.test', password: 'password-123',
  } }), response)

  assert.equal(response.statusCode, 409)
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.identities.length, 1)
  assert.equal(database.state.identities[0].userId, existing.id)
  assert.equal(response.cookies.token, undefined)
  assert.equal(events[0].uniqueConstraint, 'provider_subject')
  assert.equal(events[0].operation, 'auth_identity_create')
})

test('unique-conflict diagnostics classify known index targets and hide unknown or malformed targets', async () => {
  const cases = [
    { target: 'User_email_key', expected: 'user_email', createAt: 'user', expectedOperation: 'user_create' },
    { target: 'User_pkey', expected: 'user_id', createAt: 'user', expectedOperation: 'user_create' },
    { target: 'AuthIdentity_pkey', expected: 'auth_identity_id', expectedOperation: 'auth_identity_create' },
    { target: 'AuthIdentity_provider_providerSubject_key', expected: 'provider_subject', expectedOperation: 'auth_identity_create' },
    { target: ['userId', 'provider'], expected: 'user_provider', expectedOperation: 'auth_identity_create' },
    { target: 'AuthIdentity_userId_provider_key', expected: 'user_provider', expectedOperation: 'auth_identity_create' },
    { target: ['id'], expected: 'unknown', expectedOperation: 'auth_identity_create' },
    { target: ['unexpected_private_field'], expected: 'unknown', expectedOperation: 'auth_identity_create' },
    { target: ['email', {}], expected: 'unknown', expectedOperation: 'auth_identity_create' },
    { target: 'Unknown_private_constraint', expected: 'unknown', expectedOperation: 'auth_identity_create' },
    { target: { target: 'private raw metadata' }, expected: 'unknown', expectedOperation: 'auth_identity_create' },
    { target: ['private transaction metadata'], expected: 'unknown', createAt: 'transaction', expectedOperation: 'unknown' },
  ]

  for (const [index, { target, expected, createAt = 'identity', expectedOperation }] of cases.entries()) {
    const rawErrorText = 'private database detail containing person@example.test and +919876543210'
    const uniqueError = Object.assign(new Error(rawErrorText), { code: 'P2002', meta: { target } })
    const database = makeDatabase(createAt === 'user'
      ? { userCreateError: uniqueError }
      : createAt === 'transaction'
        ? { accountCreationTransactionError: uniqueError }
        : { identityCreateError: uniqueError })
    const events = []
    const requestId = `aa458529-e61f-4abf-9d8c-2df31b7ad${String(index).padStart(3, '0')}`
    const handlers = createHandlers({
      database,
      logger: { warn: (entry) => events.push(JSON.parse(entry)) },
      requestIdFactory: () => requestId,
    })
    const response = makeResponse()
    await handlers.registerVerify(makeRequest({ body: {
      phone, otp: '123456', name: 'New Customer', email: `new-${index}@example.test`, password: 'password-123',
    } }), response)

    assert.equal(response.statusCode, 409)
    assert.deepEqual(response.body, { message: 'Registration could not be completed' })
    assert.deepEqual(events, [{
      event: 'phone_registration_failure',
      requestId,
      stage: 'account_creation',
      reasonCode: 'PHONE_REGISTRATION_UNIQUE_CONFLICT',
      exceptionType: 'Error',
      uniqueConstraint: expected,
      operation: expectedOperation,
    }])
    const serialized = JSON.stringify(events)
    for (const privateValue of [phone, rawErrorText, JSON.stringify(target), `new-${index}@example.test`, 'New Customer', 'password-123', '123456']) {
      assert.equal(serialized.includes(privateValue), false)
    }
  }
})

test('concurrent registration for one phone consumes the OTP only once', async () => {
  const database = makeDatabase()
  const handlers = createHandlers({ database })
  const payload = (email) => makeRequest({ body: {
    phone, otp: '123456', name: 'Customer', email, password: 'password-123',
  } })
  const responses = [makeResponse(), makeResponse()]
  await Promise.all([
    handlers.registerVerify(payload('one@example.test'), responses[0]),
    handlers.registerVerify(payload('two@example.test'), responses[1]),
  ])

  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [201, 401])
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.identities.length, 1)
  assert.equal(responses.filter((response) => response.cookies.token).length, 1)
  assert.equal(responses.filter((response) => response.statusCode === 409).every((response) => !response.cookies.token), true)
  assert.equal(database.state.identities[0].providerSubject, phone)
  assert.equal(database.state.identities[0].userId, database.state.users[0].id)
})

test('the same verified OTP cannot be replayed across registration, login, and phone linking', async () => {
  const database = makeDatabase()
  const handlers = createHandlers({ database })
  const registrationResponse = makeResponse()
  await handlers.registerVerify(makeRequest({ body: {
    phone, otp: '123456', name: 'New Customer', email: 'new@example.test', password: 'password-123',
  } }), registrationResponse)
  const user = database.state.users[0]

  const loginResponse = makeResponse()
  await handlers.loginVerify(makeRequest({ body: { phone, otp: '123456' } }), loginResponse)
  const linkResponse = makeResponse()
  await handlers.linkVerify(makeRequest({ body: { phone, otp: '123456' }, user }), linkResponse)

  assert.equal(registrationResponse.statusCode, 201)
  assert.equal(loginResponse.statusCode, 401)
  assert.equal(loginResponse.cookies.token, undefined)
  assert.equal(linkResponse.statusCode, 401)
  assert.equal(database.state.consumedPhoneOtps.length, 1)
  assert.equal(database.state.identities.length, 1)
})

test('concurrent claims for one verified OTP have exactly one winner', async () => {
  const database = makeDatabase()
  const claimOtp = createConsumedPhoneOtpClaimer({ getJwtSecret: () => testJwtSecret })

  const results = await Promise.all([
    claimOtp(database.client, phone, '123456'),
    claimOtp(database.client, phone, '123456'),
  ])

  assert.deepEqual(results.sort(), [false, true])
  assert.equal(database.state.consumedPhoneOtps.length, 1)
})

test('an expired OTP claim can be claimed again', async () => {
  const database = makeDatabase()
  let now = Date.parse('2026-10-12T12:00:00.000Z')
  const claimOtp = createConsumedPhoneOtpClaimer({
    clock: () => now,
    getJwtSecret: () => testJwtSecret,
  })

  assert.equal(await claimOtp(database.client, phone, '123456'), true)
  assert.equal(await claimOtp(database.client, phone, '123456'), false)
  now += 5 * 60 * 1000 + 1
  assert.equal(await claimOtp(database.client, phone, '123456'), true)
  assert.equal(database.state.consumedPhoneOtps.length, 1)
})

test('OTP claim storage failures fail closed in registration, login, and phone linking', async () => {
  const user = testUser()
  const database = makeDatabase({ users: [user] })
  database.client.$transaction = async () => { throw new Error('storage unavailable') }
  const handlers = createHandlers({ database })

  const registrationResponse = makeResponse()
  await handlers.registerVerify(makeRequest({ body: {
    phone, otp: '123456', name: 'New Customer', email: 'new@example.test', password: 'password-123',
  } }), registrationResponse)
  const loginResponse = makeResponse()
  await handlers.loginVerify(makeRequest({ body: { phone, otp: '123456' } }), loginResponse)
  const linkResponse = makeResponse()
  await handlers.linkVerify(makeRequest({ body: { phone, otp: '123456' }, user }), linkResponse)

  assert.deepEqual([registrationResponse.statusCode, loginResponse.statusCode, linkResponse.statusCode], [500, 500, 500])
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.identities.length, 0)
  assert.equal(registrationResponse.cookies.token, undefined)
  assert.equal(loginResponse.cookies.token, undefined)
})

test('concurrent registrations for one email create only one account and identity', async () => {
  const database = makeDatabase()
  const handlers = createHandlers({ database })
  const payload = (mobile) => makeRequest({ body: {
    phone: mobile, otp: '123456', name: 'Customer', email: 'shared@example.test', password: 'password-123',
  } })
  const responses = [makeResponse(), makeResponse()]
  await Promise.all([
    handlers.registerVerify(payload(phone), responses[0]),
    handlers.registerVerify(payload('+919876543211'), responses[1]),
  ])

  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [201, 409])
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.users[0].email, 'shared@example.test')
  assert.equal(database.state.identities.length, 1)
  assert.equal(database.state.identities[0].userId, database.state.users[0].id)
  assert.equal(responses.filter((response) => response.cookies.token).length, 1)
})

test('phone login requires a linked active HASTON customer and issues the existing session', async () => {
  const user = testUser()
  const database = makeDatabase({ users: [user], identities: [{ id: 1, provider: 'phone', providerSubject: phone, userId: user.id }] })
  const handlers = createHandlers({ database })
  const response = makeResponse()
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    await handlers.loginVerify(makeRequest({ body: { phone, otp: '123456' } }), response)
    assertExistingSession(response, user, 200, 'Login successful', true)
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  }

  const unlinkedHandlers = createHandlers({ database: makeDatabase({ users: [user] }) })
  const unlinkedResponse = makeResponse()
  await unlinkedHandlers.loginVerify(makeRequest({ body: { phone, otp: '123456' } }), unlinkedResponse)
  assert.equal(unlinkedResponse.statusCode, 401)
  assert.deepEqual(unlinkedResponse.body, {
    code: 'PHONE_ACCOUNT_NOT_FOUND',
    message: 'No account is linked to this phone number.',
  })
  assert.equal(unlinkedResponse.cookies.token, undefined)
})

test('phone login returns a specific unlinked-account response without creating an account', async () => {
  const database = makeDatabase()
  const response = makeResponse()
  await createHandlers({ database }).loginVerify(makeRequest({ body: { phone, otp: '123456' } }), response)

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.body, {
    code: 'PHONE_ACCOUNT_NOT_FOUND',
    message: 'No account is linked to this phone number.',
  })
  assert.equal(response.cookies.token, undefined)
  assert.equal(database.state.users.length, 0)
  assert.equal(database.state.identities.length, 0)
  assert.equal(database.state.consumedPhoneOtps.length, 1)
})

test('phone login keeps invalid OTP responses generic', async () => {
  const database = makeDatabase()
  const response = makeResponse()
  const handlers = createHandlers({
    database,
    otpService: { sendOtp: async () => true, verifyOtp: async () => false },
  })

  await handlers.loginVerify(makeRequest({ body: { phone, otp: '123456' } }), response)

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.body, { message: 'Phone authentication failed' })
  assert.equal(response.cookies.token, undefined)
  assert.equal(database.state.users.length, 0)
  assert.equal(database.state.identities.length, 0)
  assert.equal(database.state.consumedPhoneOtps.length, 0)
})

test('phone login rejects inactive, non-customer, and wrong-store users', async (t) => {
  for (const [name, user, userId] of [
    ['missing user', null, 999],
    ['inactive', testUser({ isActive: false }), 41],
    ['non-customer', testUser({ role: 'ADMIN' }), 41],
    ['wrong store', testUser({ storeId: 8 }), 41],
  ]) {
    await t.test(name, async () => {
      const database = makeDatabase({
        users: user ? [user] : [],
        identities: [{ id: 1, provider: 'phone', providerSubject: phone, userId }],
      })
      const response = makeResponse()
      await createHandlers({ database }).loginVerify(makeRequest({ body: { phone, otp: '123456' } }), response)
      assert.equal(response.statusCode, 401)
      assert.deepEqual(response.body, {
        code: 'PHONE_ACCOUNT_NOT_FOUND',
        message: 'No account is linked to this phone number.',
      })
      assert.equal(response.cookies.token, undefined)
      assert.equal(database.state.users.length, user ? 1 : 0)
      assert.equal(database.state.identities.length, 1)
    })
  }
})

test('authenticated phone linking rejects an identity owned by another user', async () => {
  const currentUser = testUser({ id: 41 })
  const otherUser = testUser({ id: 42, email: 'other@example.test' })
  const database = makeDatabase({
    users: [currentUser, otherUser],
    identities: [{ id: 1, provider: 'phone', providerSubject: phone, userId: otherUser.id }],
  })
  const response = makeResponse()
  await createHandlers({ database }).linkVerify(makeRequest({ body: { phone, otp: '123456' }, user: currentUser }), response)
  assert.equal(response.statusCode, 409)
  assert.equal(database.state.identities[0].userId, otherUser.id)
})

test('authenticated phone linking attaches only the verified number to the current account', async () => {
  const currentUser = testUser()
  const database = makeDatabase({ users: [currentUser] })
  const response = makeResponse()
  await createHandlers({ database }).linkVerify(makeRequest({ body: { phone, otp: '123456' }, user: currentUser }), response)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(database.state.identities.map(({ provider, providerSubject, userId }) => ({ provider, providerSubject, userId })), [
    { provider: 'phone', providerSubject: phone, userId: currentUser.id },
  ])
  assert.deepEqual(response.body, { message: 'Phone linked successfully' })
  assert.equal(response.cookies.token, undefined)
})

test('authenticated phone linking is idempotent and cannot replace the account phone', async (t) => {
  await t.test('same phone is idempotent', async () => {
    const currentUser = testUser()
    const identity = { id: 1, provider: 'phone', providerSubject: phone, userId: currentUser.id }
    const database = makeDatabase({ users: [currentUser], identities: [identity] })
    const response = makeResponse()
    await createHandlers({ database }).linkVerify(makeRequest({ body: { phone, otp: '123456' }, user: currentUser }), response)

    assert.equal(response.statusCode, 200)
    assert.equal(database.state.identities.length, 1)
    assert.deepEqual(response.body, { message: 'Phone linked successfully' })
  })

  await t.test('different phone cannot replace an existing link', async () => {
    const currentUser = testUser()
    const originalPhone = '+919876543211'
    const database = makeDatabase({
      users: [currentUser],
      identities: [{ id: 1, provider: 'phone', providerSubject: originalPhone, userId: currentUser.id }],
    })
    const response = makeResponse()
    await createHandlers({ database }).linkVerify(makeRequest({ body: { phone, otp: '123456' }, user: currentUser }), response)

    assert.equal(response.statusCode, 409)
    assert.deepEqual(database.state.identities.map(({ providerSubject, userId }) => ({ providerSubject, userId })), [
      { providerSubject: originalPhone, userId: currentUser.id },
    ])
    assert.equal(response.cookies.token, undefined)
  })
})

test('phone linking rejects inactive, non-customer, and wrong-store users before OTP verification', async (t) => {
  for (const [name, changes] of [
    ['inactive', { isActive: false }],
    ['non-customer', { role: 'ADMIN' }],
    ['wrong store', { storeId: 8 }],
  ]) {
    await t.test(name, async () => {
      let verificationCalls = 0
      const user = testUser(changes)
      const database = makeDatabase({ users: [user] })
      const response = makeResponse()
      const handlers = createHandlers({
        database,
        otpService: { sendOtp: async () => true, verifyOtp: async () => { verificationCalls += 1; return true } },
      })

      await handlers.linkVerify(makeRequest({ body: { phone, otp: '123456' }, user }), response)

      assert.equal(response.statusCode, 403)
      assert.equal(verificationCalls, 0)
      assert.equal(database.state.identities.length, 0)
    })
  }
})

test('send cooldown and IP/phone attempt limits are enforced in memory', () => {
  let now = 1_000
  const controls = createPhoneOtpControls({ clock: () => now })
  assert.equal(controls.reserveCooldown(phone), true)
  assert.equal(controls.reserveCooldown(phone), false)
  controls.releaseCooldown(phone)
  assert.equal(controls.reserveCooldown(phone), true)

  const sendControls = createPhoneOtpControls({ clock: () => now })
  for (let attempt = 0; attempt < 3; attempt += 1) assert.equal(sendControls.allowSend(`ip-${attempt}`, phone), true)
  assert.equal(sendControls.allowSend('ip-other', phone), false)

  const verifyControls = createPhoneOtpControls({ clock: () => now })
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal(verifyControls.allowVerify(`ip-${attempt}`, phone), true)
  assert.equal(verifyControls.allowVerify('ip-other', phone), false)

  const ipControls = createPhoneOtpControls({ clock: () => now })
  for (let attempt = 0; attempt < 20; attempt += 1) assert.equal(ipControls.allowSend('one-ip', `+91987654${String(attempt).padStart(4, '0')}`), true)
  assert.equal(ipControls.allowSend('one-ip', '+919999999999'), false)
  now += 15 * 60 * 1000
  assert.equal(ipControls.allowSend('one-ip', '+919999999999'), true)
})

test('mounted auth routes enforce Origin and CSRF middleware before OTP handlers', async (t) => {
  let sendCalls = 0
  const mounted = await mountAuthRouter({
    otpService: { sendOtp: async () => { sendCalls += 1; return true }, verifyOtp: async () => true },
  })
  t.after(mounted.close)

  const wrongOrigin = await mounted.post('/phone/login/send', { phone }, { origin: 'https://evil.test' })
  assert.equal(wrongOrigin.status, 403)
  const missingCsrf = await mounted.post('/phone/login/send', { phone }, { 'x-csrf-token': '' })
  assert.equal(missingCsrf.status, 403)
  const mismatchedCsrf = await mounted.post('/phone/login/send', { phone }, {
    cookie: 'csrf_token=csrf123; token=authenticated-cookie',
    'x-csrf-token': 'wrong',
  })
  assert.equal(mismatchedCsrf.status, 403)
  const unauthenticatedLink = await mounted.post('/phone/link/send', { phone })
  assert.equal(unauthenticatedLink.status, 401)
  const valid = await mounted.post('/phone/login/send', { phone })
  assert.equal(valid.status, 200)
  assert.equal(sendCalls, 1)
})

test('legacy phone send and login routes alias the guarded OTP handlers', async (t) => {
  const user = testUser()
  const database = makeDatabase({
    users: [user],
    identities: [{ id: 1, provider: 'phone', providerSubject: phone, userId: user.id }],
  })
  let sendCalls = 0
  let verifyCalls = 0
  const mounted = await mountAuthRouter({
    database,
    otpService: {
      sendOtp: async () => { sendCalls += 1; return true },
      verifyOtp: async () => { verifyCalls += 1; return true },
    },
  })
  t.after(mounted.close)

  const sendResponse = await mounted.post('/phone/send-otp', { phone })
  assert.equal(sendResponse.status, 200)
  assert.equal(sendCalls, 1)

  const loginResponse = await mounted.post('/phone/login', { phone, otp: '123456' })
  assert.equal(loginResponse.status, 200)
  assert.equal(verifyCalls, 1)
})

test('OTP IP limiter uses the nearest untrusted forwarded address behind a loopback proxy', async (t) => {
  const observedIps = []
  const baseControls = createPhoneOtpControls()
  const controls = {
    allowSend(ip, normalizedPhone) {
      observedIps.push(ip)
      return baseControls.allowSend(ip, normalizedPhone)
    },
    allowVerify: (...args) => baseControls.allowVerify(...args),
    reserveCooldown: (...args) => baseControls.reserveCooldown(...args),
    releaseCooldown: (...args) => baseControls.releaseCooldown(...args),
  }
  const mounted = await mountAuthRouter({
    controls,
    trustProxy: 'loopback',
    otpService: { sendOtp: async () => true, verifyOtp: async () => true },
  })
  t.after(mounted.close)

  const response = await mounted.post('/phone/login/send', { phone }, {
    'x-forwarded-for': '198.51.100.23, 203.0.113.45',
  })

  assert.equal(response.status, 200)
  assert.deepEqual(observedIps, ['203.0.113.45'])
})

test('mounted auth routes enforce send and verify phone and IP limits', async (t) => {
  await t.test('send limit per phone', async (t) => {
    let now = 1_000
    let sendCalls = 0
    const controls = createPhoneOtpControls({ clock: () => now })
    const mounted = await mountAuthRouter({
      controls,
      otpService: { sendOtp: async () => { sendCalls += 1; return true }, verifyOtp: async () => true },
    })
    t.after(mounted.close)

    const statuses = []
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt > 0) now += 60_001
      statuses.push((await mounted.post('/phone/register/send', { phone })).status)
    }
    assert.deepEqual(statuses, [200, 200, 200, 429])
    assert.equal(sendCalls, 3)
  })

  await t.test('verify limit per phone', async (t) => {
    let verifyCalls = 0
    const mounted = await mountAuthRouter({
      otpService: { sendOtp: async () => true, verifyOtp: async () => { verifyCalls += 1; return true } },
    })
    t.after(mounted.close)

    const statuses = []
    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push((await mounted.post('/phone/login/verify', { phone, otp: '123456' })).status)
    }
    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429])
    assert.equal(verifyCalls, 5)
  })

  await t.test('send limit per IP', async (t) => {
    const mounted = await mountAuthRouter()
    t.after(mounted.close)

    const statuses = []
    for (let attempt = 0; attempt < 21; attempt += 1) {
      statuses.push((await mounted.post('/phone/login/send')).status)
    }
    assert.deepEqual(statuses, [...Array(20).fill(400), 429])
  })

  await t.test('verify limit per IP', async (t) => {
    const mounted = await mountAuthRouter()
    t.after(mounted.close)

    const statuses = []
    for (let attempt = 0; attempt < 61; attempt += 1) {
      statuses.push((await mounted.post('/phone/login/verify')).status)
    }
    assert.deepEqual(statuses, [...Array(60).fill(400), 429])
  })
})