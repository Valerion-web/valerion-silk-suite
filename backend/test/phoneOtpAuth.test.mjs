import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import { after, test } from 'node:test'
import {
  createPhoneLoginUserHandler,
  createSendPhoneOtpHandler,
} from '../controllers/authController.js'
import { createPhoneOtpRateLimiters } from '../routes/authRoutes.js'
import { createPostgresRateLimitStore } from '../services/postgresRateLimitStore.js'
import {
  createLocalMockOtpProvider,
  createMsg91OtpProvider,
  normalizePhoneNumber,
  resolvePhoneOtpProvider,
} from '../services/phoneOtpService.js'

const originalEnv = {
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  MSG91_AUTHKEY: process.env.MSG91_AUTHKEY,
  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID,
  MSG91_BASE_URL: process.env.MSG91_BASE_URL,
  ENABLE_LOCAL_OTP_MOCK: process.env.ENABLE_LOCAL_OTP_MOCK,
  NODE_ENV: process.env.NODE_ENV,
}

process.env.JWT_SECRET = 'test-jwt-secret-that-is-not-a-placeholder'
process.env.JWT_EXPIRES_IN = '7d'

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
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
  cookie(name, value, options) {
    this.cookies[name] = { value, options }
    return this
  },
})

const makeDatabase = ({ users = [], identities = [] } = {}) => {
  const state = {
    users: users.map((user) => ({ ...user })),
    identities: identities.map((identity) => ({ ...identity })),
    nextUserId: Math.max(0, ...users.map((user) => user.id || 0)) + 1,
  }

  const makeClient = (target) => ({
    user: {
      findUnique: async ({ where }) => target.users.find((user) => (
        (where.email !== undefined && user.email === where.email) ||
        (where.id !== undefined && user.id === where.id)
      )) || null,
      create: async ({ data }) => {
        if (target.users.some((user) => user.email === data.email)) {
          throw Object.assign(new Error('duplicate email'), { code: 'P2002' })
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
        const key = where.provider_providerSubject
        const identity = target.identities.find((candidate) => (
          candidate.provider === key.provider && candidate.providerSubject === key.providerSubject
        ))
        if (!identity) return null
        return include?.user
          ? { ...identity, user: target.users.find((user) => user.id === identity.userId) || null }
          : identity
      },
      create: async ({ data }) => {
        if (target.identities.some((identity) => (
          identity.provider === data.provider && identity.providerSubject === data.providerSubject
        ))) {
          throw Object.assign(new Error('duplicate provider subject'), { code: 'P2002' })
        }
        if (target.identities.some((identity) => identity.userId === data.userId && identity.provider === data.provider)) {
          throw Object.assign(new Error('duplicate user provider'), { code: 'P2002' })
        }
        const identity = { id: target.identities.length + 1, ...data }
        target.identities.push(identity)
        return identity
      },
    },
    $transaction: async (operation) => {
      const draft = {
        users: state.users.map((user) => ({ ...user })),
        identities: state.identities.map((identity) => ({ ...identity })),
        nextUserId: state.nextUserId,
      }
      const result = await operation(makeClient(draft))
      state.users = draft.users
      state.identities = draft.identities
      state.nextUserId = draft.nextUserId
      return result
    },
  })

  return { client: makeClient(state), state }
}

const makeUser = (overrides = {}) => ({
  id: 1,
  email: 'customer@example.test',
  name: 'Customer',
  password: '$2a$10$existing-hash',
  role: 'CUSTOMER',
  isActive: true,
  storeId: 7,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  ...overrides,
})

const makeRateLimitDatabase = ({ shouldFail = false } = {}) => {
  const records = new Map()
  let now = Date.now()
  const client = {
    async $queryRaw(strings, ...values) {
      if (shouldFail) throw new Error('database unavailable')

      const query = strings.join('?')
      if (query.includes('INSERT INTO "PhoneOtpRateLimit"')) {
        const [namespace, keyHash, initialWindowMs, resetWindowMs] = values
        const recordKey = `${namespace}:${keyHash}`
        const current = records.get(recordKey)
        const expired = !current || current.expiresAt <= now
        const record = {
          hits: expired ? 1 : current.hits + 1,
          expiresAt: expired ? now + initialWindowMs : current.expiresAt,
        }
        records.set(recordKey, record)
        assert.equal(initialWindowMs, resetWindowMs)
        return [{ hits: record.hits, expiresAt: new Date(record.expiresAt) }]
      }

      if (query.includes('SELECT "hits", "expiresAt"')) {
        const [namespace, keyHash] = values
        const record = records.get(`${namespace}:${keyHash}`)
        return record && record.expiresAt > now
          ? [{ hits: record.hits, expiresAt: new Date(record.expiresAt) }]
          : []
      }

      throw new Error('Unexpected rate-limit query')
    },
    async $executeRaw(strings, ...values) {
      if (shouldFail) throw new Error('database unavailable')

      const query = strings.join('?')
      if (query.includes('DELETE FROM "PhoneOtpRateLimit" WHERE "namespace" = ?')) {
        const [namespace] = values
        for (const key of records.keys()) {
          if (key.startsWith(`${namespace}:`)) records.delete(key)
        }
        return 1
      }
      return 0
    },
  }

  return {
    client,
    records,
    advanceTime(milliseconds) {
      now += milliseconds
    },
  }
}

const runLimiterRequests = async (limiters, requests) => {
  const app = express()
  app.use(express.json())
  app.post('/limit', limiters.ipLimiter, limiters.phoneLimiter, (req, res) => res.sendStatus(204))
  app.use((error, req, res, next) => res.sendStatus(500))

  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()
  const statuses = []

  try {
    for (const phone of requests) {
      const response = await fetch(`http://127.0.0.1:${port}/limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      statuses.push(response.status)
      await response.arrayBuffer()
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }

  return statuses
}

test('normalizePhoneNumber converts mobile numbers to E.164 format', () => {
  assert.equal(normalizePhoneNumber('9876543210'), '+919876543210')
  assert.equal(normalizePhoneNumber('+91 98765 43210'), '+919876543210')
  assert.equal(normalizePhoneNumber('  +1 (415) 555-0101 '), '+14155550101')
  assert.equal(normalizePhoneNumber('bad-data'), null)
})

test('PostgreSQL rate-limit counters are shared, hashed, and expire', async () => {
  const database = makeRateLimitDatabase()
  const firstStore = createPostgresRateLimitStore({ namespace: 'phone-otp-number', prismaClient: database.client })
  const secondStore = createPostgresRateLimitStore({ namespace: 'phone-otp-number', prismaClient: database.client })
  firstStore.init({ windowMs: 60 * 60 * 1000 })
  secondStore.init({ windowMs: 60 * 60 * 1000 })

  assert.equal((await firstStore.increment('+919876543210')).totalHits, 1)
  assert.equal((await secondStore.increment('+919876543210')).totalHits, 2)
  assert.equal([...database.records.keys()].some((key) => key.includes('+919876543210')), false)

  database.advanceTime(60 * 60 * 1000 + 1)
  assert.equal((await secondStore.increment('+919876543210')).totalHits, 1)
})

test('phone and IP quotas retain their configured hourly limits', async () => {
  const phoneDb = makeRateLimitDatabase()
  const phoneStatuses = await runLimiterRequests(
    createPhoneOtpRateLimiters({ prismaClient: phoneDb.client }),
    ['9876543210', '+919876543210', '+919876543210', '+919876543210', '+919876543210', '+919876543210'],
  )
  assert.deepEqual(phoneStatuses, [204, 204, 204, 204, 204, 429])

  const ipDb = makeRateLimitDatabase()
  const ipStatuses = await runLimiterRequests(
    createPhoneOtpRateLimiters({ prismaClient: ipDb.client }),
    Array.from({ length: 31 }, (_, index) => String(9000000000 + index)),
  )
  assert.deepEqual(ipStatuses.slice(0, 30), Array(30).fill(204))
  assert.equal(ipStatuses[30], 429)
})

test('phone and IP limiters fail closed when PostgreSQL is unavailable', async () => {
  const database = makeRateLimitDatabase({ shouldFail: true })
  const statuses = await runLimiterRequests(
    createPhoneOtpRateLimiters({ prismaClient: database.client }),
    ['9876543210'],
  )

  assert.deepEqual(statuses, [500])
})

test('MSG91 provider uses documented send and verify endpoints', async () => {
  const originalAuthKey = process.env.MSG91_AUTHKEY
  const originalTemplateId = process.env.MSG91_TEMPLATE_ID
  process.env.MSG91_AUTHKEY = 'test-auth-key'
  process.env.MSG91_TEMPLATE_ID = 'test-template-id'
  const calls = []
  const provider = createMsg91OtpProvider({
    fetchImpl: async (url, options) => {
      calls.push({ url: new URL(url), options })
      return { ok: true, text: async () => JSON.stringify({ type: 'success', message: 'success' }) }
    },
  })

  try {
    assert.deepEqual(await provider.send({ phone: '+919876543210' }), { ok: true })
    assert.deepEqual(await provider.verify({ phone: '+919876543210', otp: '123456' }), { ok: true })

    assert.equal(calls[0].options.method, 'POST')
    assert.equal(calls[0].url.pathname, '/api/v5/otp')
    assert.equal(calls[0].url.searchParams.get('template_id'), 'test-template-id')
    assert.equal(calls[0].url.searchParams.get('mobile'), '919876543210')
    assert.equal(calls[0].options.headers.authkey, 'test-auth-key')
    assert.equal(JSON.parse(calls[0].options.body).otp, undefined)

    assert.equal(calls[1].options.method, 'GET')
    assert.equal(calls[1].url.pathname, '/api/v5/otp/verify')
    assert.equal(calls[1].url.searchParams.get('mobile'), '919876543210')
    assert.equal(calls[1].url.searchParams.get('otp'), '123456')
    assert.equal(calls[1].options.headers.authkey, 'test-auth-key')
  } finally {
    if (originalAuthKey === undefined) delete process.env.MSG91_AUTHKEY
    else process.env.MSG91_AUTHKEY = originalAuthKey
    if (originalTemplateId === undefined) delete process.env.MSG91_TEMPLATE_ID
    else process.env.MSG91_TEMPLATE_ID = originalTemplateId
  }
})

test('local mock provider generates a visible OTP without calling MSG91', async () => {
  const originalFlag = process.env.ENABLE_LOCAL_OTP_MOCK
  const originalNodeEnv = process.env.NODE_ENV
  process.env.ENABLE_LOCAL_OTP_MOCK = 'true'
  process.env.NODE_ENV = 'development'

  let loggedMessage = ''
  let fetchCalls = 0
  const provider = createLocalMockOtpProvider({
    fetchImpl: async () => {
      fetchCalls += 1
      return { ok: true, text: async () => JSON.stringify({ type: 'success' }) }
    },
    logImpl: (message) => {
      loggedMessage = message
    },
  })

  try {
    const sendResult = await provider.send({ phone: '+919876543210' })
    assert.deepEqual(sendResult, { ok: true })
    assert.equal(fetchCalls, 0)
    const otpMatch = loggedMessage.match(/OTP\s*[:=]\s*(\d{4,8})/i)
    assert.ok(otpMatch, 'expected a visible local mock OTP in the backend log')
    const otp = otpMatch[1]
    assert.deepEqual(await provider.verify({ phone: '+919876543210', otp }), { ok: true })
    assert.deepEqual(await provider.verify({ phone: '+919876543210', otp: '000000' }), { ok: false, reason: 'invalid-or-expired' })
  } finally {
    if (originalFlag === undefined) delete process.env.ENABLE_LOCAL_OTP_MOCK
    else process.env.ENABLE_LOCAL_OTP_MOCK = originalFlag
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  }
})

test('production rejects the local mock provider and keeps MSG91 as the default', async () => {
  const originalFlag = process.env.ENABLE_LOCAL_OTP_MOCK
  const originalNodeEnv = process.env.NODE_ENV
  process.env.ENABLE_LOCAL_OTP_MOCK = 'true'
  process.env.NODE_ENV = 'production'

  try {
    const provider = resolvePhoneOtpProvider()
    assert.deepEqual(await provider.send({ phone: '+919876543210' }), { ok: false, reason: 'not-configured' })
    const mockProvider = createLocalMockOtpProvider({ fetchImpl: async () => ({ ok: true }) })
    assert.deepEqual(await mockProvider.send({ phone: '+919876543210' }), { ok: false, reason: 'not-allowed' })
    assert.deepEqual(await mockProvider.verify({ phone: '+919876543210', otp: '123456' }), { ok: false, reason: 'not-allowed' })
  } finally {
    if (originalFlag === undefined) delete process.env.ENABLE_LOCAL_OTP_MOCK
    else process.env.ENABLE_LOCAL_OTP_MOCK = originalFlag
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  }
})

test('send OTP uses provider-managed code and returns no OTP value', async () => {
  let sentPhone
  const response = makeResponse()
  await createSendPhoneOtpHandler({
    messageProvider: {
      send: async ({ phone }) => {
        sentPhone = phone
        return { ok: true }
      },
    },
  })({
    body: { phone: '9876543210' },
    contextType: 'STORE',
    store: { id: 7, slug: 'haston' },
  }, response)

  assert.equal(sentPhone, '+919876543210')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { message: 'OTP sent successfully.' })
})

test('phone OTP sending is restricted to HASTON store context', async () => {
  let providerCalls = 0
  const response = makeResponse()

  await createSendPhoneOtpHandler({
    messageProvider: {
      send: async () => {
        providerCalls += 1
        return { ok: true }
      },
    },
  })({
    body: { phone: '9876543210' },
    contextType: 'STORE',
    store: { id: 8, slug: 'another-store' },
  }, response)

  assert.equal(response.statusCode, 409)
  assert.equal(providerCalls, 0)
})

test('phone login keeps invalid OTP failures generic and preserves successful login sessions', async () => {
  const user = makeUser({ id: 9, email: 'linked.customer@example.test', name: 'Linked Customer' })
  const database = makeDatabase({ users: [user], identities: [{ id: 1, provider: 'phone', providerSubject: '+919876543210', userId: user.id }] })
  const response = makeResponse()

  await createPhoneLoginUserHandler({
    prismaClient: database.client,
    messageProvider: { verify: async () => ({ ok: false }) },
  })({
    body: { phone: '+919876543210', otp: '123456' },
    contextType: 'STORE',
    store: { id: 7, slug: 'haston' },
  }, response)

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.body, { message: 'Authentication failed' })
  assert.equal(response.cookies.token, undefined)
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.identities.length, 1)

  const successResponse = makeResponse()
  await createPhoneLoginUserHandler({
    prismaClient: database.client,
    messageProvider: {
      verify: async ({ phone, otp }) => ({ ok: phone === '+919876543210' && otp === '123456' }),
    },
  })({
    body: { phone: '+919876543210', otp: '123456' },
    contextType: 'STORE',
    store: { id: 7, slug: 'haston' },
  }, successResponse)

  assert.equal(successResponse.statusCode, 200)
  assert.equal(successResponse.body.user.email, user.email)
  assert.equal(successResponse.cookies.token.options.httpOnly, true)
  assert.equal(successResponse.cookies.token.options.sameSite, 'lax')
  assert.equal(jwt.verify(successResponse.cookies.token.value, process.env.JWT_SECRET).id, user.id)
})

test('phone login reports an unlinked account only after OTP verification succeeds', async () => {
  const database = makeDatabase()
  const response = makeResponse()
  let verificationCalls = 0

  await createPhoneLoginUserHandler({
    prismaClient: database.client,
    messageProvider: {
      verify: async () => {
        verificationCalls += 1
        return { ok: true }
      },
    },
  })({
    body: { phone: '+919876543210', otp: '123456' },
    contextType: 'STORE',
    store: { id: 7, slug: 'haston' },
  }, response)

  assert.equal(verificationCalls, 1)
  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.body, {
    code: 'PHONE_ACCOUNT_NOT_FOUND',
    message: 'No account is linked to this phone number.',
  })
  assert.equal(response.cookies.token, undefined)
  assert.equal(database.state.users.length, 0)
  assert.equal(database.state.identities.length, 0)
})

test('phone login returns the same account-not-found response for ineligible identities', async (t) => {
  const cases = [
    { name: 'inactive customer', overrides: { isActive: false } },
    { name: 'non-customer', overrides: { role: 'ADMIN' } },
    { name: 'customer in another store', overrides: { storeId: 8 } },
  ]

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const user = makeUser({ id: 10, ...testCase.overrides })
      const database = makeDatabase({
        users: [user],
        identities: [{ id: 1, provider: 'phone', providerSubject: '+919876543210', userId: user.id }],
      })
      const response = makeResponse()

      await createPhoneLoginUserHandler({
        prismaClient: database.client,
        messageProvider: { verify: async () => ({ ok: true }) },
      })({
        body: { phone: '+919876543210', otp: '123456' },
        contextType: 'STORE',
        store: { id: 7, slug: 'haston' },
      }, response)

      assert.equal(response.statusCode, 401)
      assert.deepEqual(response.body, {
        code: 'PHONE_ACCOUNT_NOT_FOUND',
        message: 'No account is linked to this phone number.',
      })
      assert.equal(response.cookies.token, undefined)
      assert.equal(database.state.users.length, 1)
      assert.equal(database.state.identities.length, 1)
    })
  }
})

test('phone identity lookup failures remain generic server errors', async () => {
  const database = makeDatabase()
  database.client.authIdentity.findUnique = async () => {
    throw new Error('database unavailable')
  }
  const response = makeResponse()

  await createPhoneLoginUserHandler({
    prismaClient: database.client,
    messageProvider: { verify: async () => ({ ok: true }) },
  })({
    body: { phone: '+919876543210', otp: '123456' },
    contextType: 'STORE',
    store: { id: 7, slug: 'haston' },
  }, response)

  assert.equal(response.statusCode, 500)
  assert.deepEqual(response.body, { message: 'Authentication failed' })
  assert.equal(response.cookies.token, undefined)
  assert.equal(database.state.users.length, 0)
  assert.equal(database.state.identities.length, 0)
})
