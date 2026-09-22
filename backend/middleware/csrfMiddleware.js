import crypto from 'node:crypto'

const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const isProduction = () => process.env.NODE_ENV === 'production'

const getCookie = (req, name) => {
  const cookieHeader = req.headers.cookie
  if (typeof cookieHeader !== 'string') return null

  const cookie = cookieHeader.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`))
  return cookie ? cookie.slice(`${name}=`.length) : null
}

const setCsrfCookie = (res, token) => {
  res.cookie(CSRF_COOKIE_NAME, token, {
    ...(isProduction() ? { domain: '.haston.in' } : {}),
    httpOnly: false,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax',
    path: '/',
  })
}

const clearLegacyCsrfCookie = (res) => {
  if (isProduction()) res.clearCookie(CSRF_COOKIE_NAME, { path: '/' })
}

const csrfMiddleware = (req, res, next) => {
  let csrfCookie = getCookie(req, CSRF_COOKIE_NAME)
  if (!csrfCookie) {
    csrfCookie = crypto.randomBytes(32).toString('hex')
  }
  clearLegacyCsrfCookie(res)
  setCsrfCookie(res, csrfCookie)

  if (SAFE_METHODS.has(req.method)) return next()

  const authCookie = getCookie(req, 'token')
  const authHeader = req.headers.authorization || req.headers.Authorization

  // Explicit bearer authentication remains compatible during the cookie migration.
  if (!authCookie || (typeof authHeader === 'string' && authHeader.startsWith('Bearer '))) return next()

  const csrfHeader = req.get(CSRF_HEADER_NAME)
  if (!csrfHeader || csrfHeader !== csrfCookie) {
    res.status(403)
    return res.json({ message: 'CSRF validation failed' })
  }

  next()
}

export default csrfMiddleware