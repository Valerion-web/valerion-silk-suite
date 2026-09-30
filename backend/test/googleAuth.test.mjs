import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { after, test } from 'node:test'
import {
  createGoogleLoginHandler,
  createGoogleLoginNonceHandler,
  createLoginUserHandler,
} from '../controllers/authController.js'
import { protectGoogleLoginRequest } from '../routes/authRoutes.js'
import { createGoogleNonceStore, GOOGLE_NONCE_TTL_MS } from '../services/googleNonceStore.js'

const testClientId = 'haston-test-web-client-id'
const testNonce = 'haston-google-login-test-nonce'
const testCsrfToken = 'haston-csrf-test-token'
const originalEnv = {
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
}

process.env.JWT_SECRET = 'test-jwt-secret-that-is-not-a-placeholder'
process.env.JWT_EXPIRES_IN = '7d'
process.env.GOOGLE_CLIENT_ID = testClientId
process.env.CORS_ORIGINS = 'http://localhost:5173'

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

const makeGooglePayload = (overrides = {}) => ({
  aud: testClientId,
  iss: 'https://accounts.google.com',
  exp: Math.floor(Date.now() / 1000) + 300,
  sub: 'google-subject-123',
  email: 'customer@example.test',
  email_verified: true,
  name: 'Google Customer',
  nonce: testNonce,
  ...overrides,
})

const makeUser = (overrides = {}) => ({
  id: 21,
  email: 'customer@example.test',
  name: 'Google Customer',
  password: '$2a$10$existing-hash',
  role: 'CUSTOMER',
  isActive: true,
  storeId: 7,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  ...overrides,
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
          throw Object.assign(new Error('unique email'), { code: 'P2002' })
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
          throw Object.assign(new Error('unique provider subject'), { code: 'P2002' })
        }
        if (target.identities.some((identity) => identity.userId === data.userId && identity.provider === data.provider)) {
          throw Object.assign(new Error('unique user provider'), { code: 'P2002' })
        }
        const identity = { id: target.identities.length + 1, ...data }
        target.identities.push(identity)
        return identity
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
      nextUserId: state.nextUserId,
    }
    try {
      const result = await operation(makeClient(draft))
      state.users = draft.users
      state.identities = draft.identities
      state.nextUserId = draft.nextUserId
      return result
    } finally {
      release()
    }
  }

  return { client, state }
}

const makeRequest = ({ body = {}, nonce = testNonce, store = { id: 7, slug: 'haston' }, contextType = 'STORE' } = {}) => ({
  body: { credential: 'verified-google-id-token', ...body },
  headers: { cookie: `csrf_token=${testCsrfToken}; google_login_nonce=${nonce}` },
  store,
  contextType,
})

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  cookies: {},
  clearedCookies: [],
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
  clearCookie(name, options) {
    this.clearedCookies.push({ name, options })
    return this
  },
  set(name, value) {
    this.headers[name] = value
    return this
  },
})

const createHandler = (database, nonceStore, payload = makeGooglePayload(), verifyCredential) => createGoogleLoginHandler({
  prismaClient: database.client,
  nonceStore,
  verifyCredential: verifyCredential || (async (credential, audience) => {
    assert.equal(credential, 'verified-google-id-token')
    assert.equal(audience, testClientId)
    return payload
  }),
})

const makeHandler = (database, payload = makeGooglePayload(), verifyCredential) => {
  const nonceStore = createGoogleNonceStore()
  nonceStore.issue(testNonce)
  const handler = createHandler(database, nonceStore, payload, verifyCredential)
  handler.nonceStore = nonceStore
  return handler
}

test('valid nonce succeeds once and the same nonce cannot be replayed', async () => {
  const user = makeUser()
  const database = makeDatabase({ users: [user], identities: [{ id: 1, provider: 'google', providerSubject: 'google-subject-123', userId: user.id }] })
  const response = makeResponse()
  const handler = makeHandler(database)

  await handler(makeRequest(), response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.body.user.id, user.id)
  assert.equal(response.cookies.token.options.httpOnly, true)
  assert.equal(response.cookies.token.options.sameSite, 'lax')
  assert.equal(jwt.verify(response.cookies.token.value, process.env.JWT_SECRET).id, user.id)
  assert.equal(response.clearedCookies[0].name, 'google_login_nonce')
  assert.equal(database.state.users.length, 1)
  assert.equal(handler.nonceStore.has(testNonce), false)

  const replayResponse = makeResponse()
  await handler(makeRequest(), replayResponse)
  assert.equal(replayResponse.statusCode, 401)
  assert.equal(replayResponse.cookies.token, undefined)
})

test('new Google identity creates a CUSTOMER in the current store with an unusable password hash', async () => {
  const database = makeDatabase()
  const response = makeResponse()

  await makeHandler(database)(makeRequest(), response)

  assert.equal(response.statusCode, 200)
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.users[0].role, 'CUSTOMER')
  assert.equal(database.state.users[0].storeId, 7)
  assert.match(database.state.users[0].password, /^\$2[aby]\$10\$/)
  assert.equal(await bcrypt.compare('shared/default', database.state.users[0].password), false)
  assert.deepEqual(database.state.identities.map(({ provider, providerSubject, userId }) => ({ provider, providerSubject, userId })), [
    { provider: 'google', providerSubject: 'google-subject-123', userId: database.state.users[0].id },
  ])
})

test('invalid Google token is rejected', async () => {
  const response = makeResponse()
  const handler = makeHandler(makeDatabase(), undefined, async () => { throw new Error('invalid signature') })

  await handler(makeRequest(), response)

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.body, { message: 'Google authentication failed' })
  assert.equal(handler.nonceStore.has(testNonce), true)
})

test('expired Google token is rejected', async () => {
  const response = makeResponse()
  const handler = makeHandler(makeDatabase(), undefined, async () => { throw Object.assign(new Error('expired'), { name: 'TokenExpiredError' }) })

  await handler(makeRequest(), response)

  assert.equal(response.statusCode, 401)
  assert.equal(handler.nonceStore.has(testNonce), true)
})

test('expired nonce is rejected before creating an account', async () => {
  let now = 1000
  const nonceStore = createGoogleNonceStore({ clock: () => now })
  nonceStore.issue(testNonce)
  now += GOOGLE_NONCE_TTL_MS
  const database = makeDatabase()
  const response = makeResponse()

  await createHandler(database, nonceStore)(makeRequest(), response)

  assert.equal(response.statusCode, 401)
  assert.equal(database.state.users.length, 0)
  assert.equal(nonceStore.has(testNonce), false)
})

test('unknown nonce is rejected before creating an account', async () => {
  const nonceStore = createGoogleNonceStore()
  const database = makeDatabase()
  const response = makeResponse()

  await createHandler(database, nonceStore)(makeRequest(), response)

  assert.equal(response.statusCode, 401)
  assert.equal(database.state.users.length, 0)
})

test('nonce mismatch is rejected without consuming the issued nonce', async () => {
  const nonceStore = createGoogleNonceStore()
  nonceStore.issue(testNonce)
  const database = makeDatabase()
  const response = makeResponse()

  await createHandler(database, nonceStore, makeGooglePayload({ nonce: 'different-nonce' }))(makeRequest(), response)

  assert.equal(response.statusCode, 401)
  assert.equal(nonceStore.has(testNonce), true)
})

test('wrong audience is rejected', async () => {
  const response = makeResponse()
  const handler = makeHandler(makeDatabase(), makeGooglePayload({ aud: 'another-web-client-id' }))

  await handler(makeRequest(), response)

  assert.equal(response.statusCode, 401)
})

test('missing, malformed, or unverified Google email is rejected', async (t) => {
  for (const payload of [
    makeGooglePayload({ email: undefined }),
    makeGooglePayload({ email: 'not-an-email' }),
    makeGooglePayload({ email_verified: false }),
  ]) {
    await t.test(JSON.stringify({ email: payload.email, email_verified: payload.email_verified }), async () => {
      const response = makeResponse()
      await makeHandler(makeDatabase(), payload)(makeRequest(), response)
      assert.equal(response.statusCode, 401)
    })
  }
})

test('duplicate Google subject signs in through its existing identity', async () => {
  const user = makeUser()
  const database = makeDatabase({ users: [user], identities: [{ id: 1, provider: 'google', providerSubject: 'google-subject-123', userId: user.id }] })
  const response = makeResponse()

  await makeHandler(database)(makeRequest(), response)

  assert.equal(response.statusCode, 200)
  assert.equal(database.state.identities.length, 1)
  assert.equal(database.state.users.length, 1)
})

test('Google identity belonging to another store is rejected', async () => {
  const user = makeUser({ storeId: 9 })
  const database = makeDatabase({ users: [user], identities: [{ id: 1, provider: 'google', providerSubject: 'google-subject-123', userId: user.id }] })
  const response = makeResponse()

  await makeHandler(database)(makeRequest(), response)

  assert.equal(response.statusCode, 401)
  assert.equal(response.cookies.token, undefined)
})

test('inactive Google user is rejected', async () => {
  const user = makeUser({ isActive: false })
  const database = makeDatabase({ users: [user], identities: [{ id: 1, provider: 'google', providerSubject: 'google-subject-123', userId: user.id }] })
  const response = makeResponse()

  await makeHandler(database)(makeRequest(), response)

  assert.equal(response.statusCode, 401)
  assert.equal(response.cookies.token, undefined)
})

test('existing password account is not silently linked', async () => {
  const user = makeUser({ password: '$2a$10$password-account-hash' })
  const database = makeDatabase({ users: [user] })
  const response = makeResponse()

  await makeHandler(database)(makeRequest(), response)

  assert.equal(response.statusCode, 409)
  assert.match(response.body.message, /Sign in with the existing account before linking Google/)
  assert.equal(database.state.identities.length, 0)
})

test('client-supplied role and email cannot change verified identity or elevate role', async () => {
  const database = makeDatabase()
  const response = makeResponse()

  await makeHandler(database)(makeRequest({ body: { email: 'admin@example.test', role: 'ADMIN' } }), response)

  assert.equal(response.statusCode, 200)
  assert.equal(database.state.users[0].email, 'customer@example.test')
  assert.equal(database.state.users[0].role, 'CUSTOMER')
})

test('concurrent first sign-ins create one user and reload the winning identity', async () => {
  const database = makeDatabase()
  const handler = makeHandler(database)
  const responses = [makeResponse(), makeResponse()]

  await Promise.all(responses.map((response) => handler(makeRequest(), response)))

  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 401])
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.identities.length, 1)
  const successfulResponse = responses.find((response) => response.statusCode === 200)
  assert.equal(jwt.verify(successfulResponse.cookies.token.value, process.env.JWT_SECRET).id, database.state.users[0].id)
})

test('normal email/password login still verifies bcrypt and issues the same cookie', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 10)
  const user = makeUser({ password: passwordHash })
  const database = makeDatabase({ users: [user] })
  const handler = createLoginUserHandler({ prismaClient: database.client })
  const response = makeResponse()

  await handler({ body: { email: user.email, password: 'correct-password' }, store: { id: 7 }, contextType: 'STORE' }, response)

  assert.equal(response.statusCode, 200)
  assert.equal(jwt.verify(response.cookies.token.value, process.env.JWT_SECRET).id, user.id)

  const rejectedResponse = makeResponse()
  await handler({ body: { email: user.email, password: 'wrong-password' }, store: { id: 7 }, contextType: 'STORE' }, rejectedResponse)
  assert.equal(rejectedResponse.statusCode, 401)
})

test('Google nonce endpoint creates a short-lived HttpOnly challenge cookie', () => {
  const nonceStore = createGoogleNonceStore()
  const response = makeResponse()

  createGoogleLoginNonceHandler({ nonceStore })(makeRequest(), response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.body.nonce, response.cookies.google_login_nonce.value)
  assert.equal(response.cookies.google_login_nonce.options.httpOnly, true)
  assert.equal(response.cookies.google_login_nonce.options.maxAge, GOOGLE_NONCE_TTL_MS)
  assert.equal(nonceStore.has(response.body.nonce), true)
  assert.equal(response.headers['Cache-Control'], 'no-store')
})

test('Google login requests require an allowlisted Origin and matching CSRF token', () => {
  const runGuard = ({ origin = 'http://localhost:5173', cookie = `csrf_token=${testCsrfToken}`, csrfHeader = testCsrfToken, method = 'POST' } = {}) => {
    const request = {
      method,
      headers: { cookie },
      get(name) {
        return { origin, 'x-csrf-token': csrfHeader }[name.toLowerCase()]
      },
      is: (mediaType) => mediaType === 'application/json',
    }
    const response = makeResponse()
    let nextCalled = false
    protectGoogleLoginRequest(request, response, () => { nextCalled = true })
    return { response, nextCalled }
  }

  assert.equal(runGuard().nextCalled, true)
  assert.equal(runGuard({ origin: 'https://attacker.example' }).response.statusCode, 403)
  assert.equal(runGuard({ csrfHeader: 'mismatch' }).response.statusCode, 403)
  assert.equal(runGuard({ method: 'GET', cookie: '' }).nextCalled, true)
})