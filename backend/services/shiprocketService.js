const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external'
const REQUEST_TIMEOUT_MS = 10_000

const createShiprocketError = (code, message, statusCode) => {
  const error = new Error(message)
  error.code = code
  if (statusCode) error.statusCode = statusCode
  return error
}

const parseJsonResponse = async (response, errorCode, errorMessage) => {
  try {
    return await response.json()
  } catch {
    throw createShiprocketError(errorCode, errorMessage, response.status)
  }
}

export const createShiprocketClient = ({
  fetchImpl = globalThis.fetch,
  env = process.env,
  timeoutSignal = (milliseconds) => AbortSignal.timeout(milliseconds),
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A fetch implementation is required')
  }
  if (typeof timeoutSignal !== 'function') {
    throw new TypeError('A timeout signal factory is required')
  }

  let accessToken = null
  let authenticationRequest = null

  const authenticate = async () => {
    if (accessToken) return
    if (authenticationRequest) return authenticationRequest

    authenticationRequest = (async () => {
      const email = env.SHIPROCKET_EMAIL?.trim()
      const password = env.SHIPROCKET_PASSWORD?.trim()
      if (!email || !password) {
        throw createShiprocketError(
          'SHIPROCKET_CONFIG_MISSING',
          'Shiprocket server configuration is unavailable',
        )
      }

      let response
      try {
        response = await fetchImpl(`${SHIPROCKET_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: timeoutSignal(REQUEST_TIMEOUT_MS),
        })
      } catch {
        throw createShiprocketError(
          'SHIPROCKET_AUTH_UNAVAILABLE',
          'Shiprocket authentication is unavailable',
        )
      }

      if (!response.ok) {
        throw createShiprocketError(
          'SHIPROCKET_AUTH_FAILED',
          'Shiprocket authentication failed',
          response.status,
        )
      }

      const payload = await parseJsonResponse(
        response,
        'SHIPROCKET_AUTH_FAILED',
        'Shiprocket authentication failed',
      )
      if (typeof payload?.token !== 'string' || !payload.token.trim()) {
        throw createShiprocketError(
          'SHIPROCKET_AUTH_FAILED',
          'Shiprocket authentication failed',
          response.status,
        )
      }
      accessToken = payload.token
    })()

    try {
      await authenticationRequest
    } finally {
      authenticationRequest = null
    }
  }

  const request = async (path, { method = 'GET', body } = {}) => {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
      throw createShiprocketError(
        'SHIPROCKET_INVALID_REQUEST',
        'Invalid Shiprocket request path',
      )
    }

    const url = new URL(path.slice(1), `${SHIPROCKET_BASE_URL}/`)
    if (url.origin !== 'https://apiv2.shiprocket.in' || !url.pathname.startsWith('/v1/external/')) {
      throw createShiprocketError(
        'SHIPROCKET_INVALID_REQUEST',
        'Invalid Shiprocket request path',
      )
    }

    await authenticate()
    const requestToken = accessToken

    let response
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${requestToken}`,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: timeoutSignal(REQUEST_TIMEOUT_MS),
      })
    } catch {
      throw createShiprocketError(
        'SHIPROCKET_REQUEST_UNAVAILABLE',
        'Shiprocket request is unavailable',
      )
    }

    if (!response.ok) {
      if (response.status === 401 && accessToken === requestToken) {
        accessToken = null
      }
      throw createShiprocketError(
        'SHIPROCKET_REQUEST_FAILED',
        'Shiprocket request failed',
        response.status,
      )
    }

    return parseJsonResponse(
      response,
      'SHIPROCKET_INVALID_RESPONSE',
      'Shiprocket returned an invalid response',
    )
  }

  return Object.freeze({
    request,
    createCustomOrder: (order) => {
      if (!order || typeof order !== 'object' || Array.isArray(order)) {
        throw createShiprocketError(
          'SHIPROCKET_INVALID_REQUEST',
          'A Shiprocket order object is required',
        )
      }
      return request('/orders/create/adhoc', { method: 'POST', body: order })
    },
    assignAwb: ({ shipmentId, courierId }) => request('/courier/assign/awb', {
      method: 'POST',
      body: {
        shipment_id: shipmentId,
        ...(courierId === undefined ? {} : { courier_id: courierId }),
      },
    }),
    generateLabel: (shipmentId) => request('/courier/generate/label', {
      method: 'POST',
      body: { shipment_id: [shipmentId] },
    }),
    requestPickup: (shipmentId) => request('/courier/generate/pickup', {
      method: 'POST',
      body: { shipment_id: [shipmentId] },
    }),
    generateManifest: (shipmentIds) => request('/manifests/generate', {
      method: 'POST',
      body: { shipment_id: shipmentIds },
    }),
    printManifest: (orderIds) => request('/manifests/print', {
      method: 'POST',
      body: { order_ids: orderIds },
    }),
  })
}

export const shiprocketClient = createShiprocketClient()
