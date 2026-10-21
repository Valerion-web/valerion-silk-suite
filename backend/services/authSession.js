import jwt from 'jsonwebtoken'

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret.includes('change-me')) {
    console.error('[Auth] JWT_SECRET is missing or still using a placeholder value')
    return null
  }
  return secret
}

const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d'

export const createToken = (user) => {
  const secret = getJwtSecret()
  if (!secret) throw new Error('Authentication failed')

  try {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
      expiresIn: getJwtExpiresIn(),
    })
  } catch {
    throw new Error('Authentication failed')
  }
}

export const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name || '',
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

export const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production'
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

export const issueAuthSession = (user, res) => {
  const token = createToken(user)
  setAuthCookie(res, token)
  return sanitizeUser(user)
}