const SEND_OTP_ENDPOINT = 'https://control.msg91.com/api/v5/otp'
const VERIFY_OTP_ENDPOINT = 'https://control.msg91.com/api/v5/otp/verify'
const OTP_EXPIRY_MINUTES = 5

const isExplicitSuccess = (payload, operation) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  if (operation === 'send') {
    return payload.type === 'success' && typeof payload.request_id === 'string' && Boolean(payload.request_id.trim())
  }
  return (payload.type === undefined || payload.type === 'success') && payload.message === 'OTP verified success'
}

export const createMsg91OtpService = ({ fetchImpl = globalThis.fetch, env = process.env, logger = console } = {}) => {
  const getConfiguration = () => {
    const authKey = env.MSG91_AUTH_KEY?.trim()
    const templateId = env.MSG91_OTP_TEMPLATE_ID?.trim()
    return authKey && templateId ? { authKey, templateId } : null
  }

  const logFailure = (operation, category, details = {}) => {
    try {
      if (typeof logger?.warn !== 'function') return
      logger.warn(JSON.stringify({ event: 'msg91_otp_failure', operation, category, ...details }))
    } catch {
      return
    }
  }

  const readSuccessfulResponse = async (response, operation) => {
    if (!response || typeof response.ok !== 'boolean') {
      logFailure(operation, 'invalid_response_format')
      return false
    }
    if (!response.ok) {
      const httpStatus = Number.isInteger(response.status) ? response.status : null
      logFailure(operation, 'http_non_2xx', httpStatus === null ? {} : { httpStatus })
      return false
    }

    let payload
    try {
      payload = await response.json()
    } catch {
      logFailure(operation, 'invalid_response_format')
      return false
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      (operation === 'send' && typeof payload.type !== 'string') ||
      (operation !== 'send' && payload.type !== undefined && typeof payload.type !== 'string')) {
      logFailure(operation, 'invalid_response_format')
      return false
    }
    if (operation === 'send' && payload.type === 'success' &&
        (typeof payload.request_id !== 'string' || !payload.request_id.trim())) {
      logFailure(operation, 'invalid_response_format')
      return false
    }
    if (operation !== 'send' && (typeof payload.message !== 'string' || !payload.message.trim())) {
      logFailure(operation, 'invalid_response_format')
      return false
    }
    if (!isExplicitSuccess(payload, operation)) {
      logFailure(operation, 'provider_rejected')
      return false
    }
    return true
  }

  return {
    async sendOtp(mobile) {
      const configuration = getConfiguration()
      if (!configuration) {
        logFailure('send', 'configuration_unavailable')
        return false
      }
      if (typeof fetchImpl !== 'function') {
        logFailure('send', 'transport_unavailable')
        return false
      }

      const url = new URL(SEND_OTP_ENDPOINT)
      url.searchParams.set('template_id', configuration.templateId)
      url.searchParams.set('mobile', mobile)

      try {
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            authkey: configuration.authKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ otp_expiry: OTP_EXPIRY_MINUTES }),
          signal: AbortSignal.timeout(10_000),
        })
        return readSuccessfulResponse(response, 'send')
      } catch (error) {
        const category = error?.name === 'AbortError' || error?.name === 'TimeoutError'
          ? 'timeout'
          : 'network_failure'
        logFailure('send', category)
        return false
      }
    },

    async verifyOtp(mobile, otp) {
      const configuration = getConfiguration()
      if (!configuration) {
        logFailure('verify', 'configuration_unavailable')
        return false
      }
      if (typeof fetchImpl !== 'function') {
        logFailure('verify', 'transport_unavailable')
        return false
      }

      const url = new URL(VERIFY_OTP_ENDPOINT)
      url.searchParams.set('mobile', mobile)
      url.searchParams.set('otp', otp)

      try {
        const response = await fetchImpl(url, {
          method: 'GET',
          headers: { authkey: configuration.authKey },
          signal: AbortSignal.timeout(10_000),
        })
        return readSuccessfulResponse(response, 'verify')
      } catch (error) {
        const category = error?.name === 'AbortError' || error?.name === 'TimeoutError'
          ? 'timeout'
          : 'network_failure'
        logFailure('verify', category)
        return false
      }
    },
  }
}

export const msg91OtpService = createMsg91OtpService()