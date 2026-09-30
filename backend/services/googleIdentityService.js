let cachedClient
let cachedClientId

export const verifyGoogleIdToken = async (credential, clientId = process.env.GOOGLE_CLIENT_ID?.trim()) => {
  if (!clientId) {
    const error = new Error('Google sign-in is not configured')
    error.code = 'GOOGLE_AUTH_NOT_CONFIGURED'
    throw error
  }

  if (!cachedClient || cachedClientId !== clientId) {
    const { OAuth2Client } = await import('google-auth-library')
    cachedClient = new OAuth2Client(clientId)
    cachedClientId = clientId
  }

  const ticket = await cachedClient.verifyIdToken({ idToken: credential, audience: clientId })
  return ticket.getPayload()
}