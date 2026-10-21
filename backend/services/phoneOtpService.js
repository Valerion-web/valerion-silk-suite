export const normalizePhoneNumber = (value) => {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const digitsOnly = trimmed.replace(/\D+/g, '')
  if (!digitsOnly) return null

  if (trimmed.startsWith('+')) {
    const normalized = `+${digitsOnly}`
    return /^\+\d{8,15}$/.test(normalized) ? normalized : null
  }

  if (digitsOnly.length === 10) {
    const normalized = `+91${digitsOnly}`
    return /^\+\d{8,15}$/.test(normalized) ? normalized : null
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    const normalized = `+91${digitsOnly.slice(1)}`
    return /^\+\d{8,15}$/.test(normalized) ? normalized : null
  }

  if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
    const normalized = `+${digitsOnly}`
    return /^\+\d{8,15}$/.test(normalized) ? normalized : null
  }

  return null
}

const parseResponse = async (response) => {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const isSuccessResponse = (response, payload) => response.ok && payload?.type === 'success'

const mockOtpStore = new Map()

const isLocalMockEnabled = () => {
  const value = String(process.env.ENABLE_LOCAL_OTP_MOCK ?? '').trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes' || value === 'on'
}

export const createLocalMockOtpProvider = ({
  fetchImpl = globalThis.fetch,
  logImpl = console.log,
} = {}) => ({
  async send({ phone }) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'not-allowed' }
    }
    if (!isLocalMockEnabled()) {
      return { ok: false, reason: 'not-configured' }
    }
    if (!fetchImpl) {
      return { ok: false, reason: 'not-configured' }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    mockOtpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 })
    logImpl(`[LOCAL OTP MOCK] phone=${phone} OTP=${otp}`)
    return { ok: true }
  },

  async verify({ phone, otp }) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'not-allowed' }
    }
    if (!isLocalMockEnabled()) {
      return { ok: false, reason: 'not-configured' }
    }

    const entry = mockOtpStore.get(phone)
    const isValid = !!entry && String(otp) === String(entry.otp) && Date.now() <= entry.expiresAt

    if (isValid) {
      mockOtpStore.delete(phone)
      return { ok: true }
    }

    return { ok: false, reason: 'invalid-or-expired' }
  },
})

export const resolvePhoneOtpProvider = ({
  fetchImpl = globalThis.fetch,
  logImpl = console.log,
} = {}) => {
  if (process.env.NODE_ENV === 'production') {
    return msg91OtpProvider
  }
  if (isLocalMockEnabled()) {
    return createLocalMockOtpProvider({ fetchImpl, logImpl })
  }
  return msg91OtpProvider
}

export const createMsg91OtpProvider = ({
  fetchImpl = globalThis.fetch,
  baseUrl = process.env.MSG91_BASE_URL?.trim() || 'https://control.msg91.com',
} = {}) => ({
  async send({ phone }) {
    const authKey = process.env.MSG91_AUTHKEY?.trim()
    const templateId = process.env.MSG91_TEMPLATE_ID?.trim()

    if (!fetchImpl || !authKey || !templateId) {
      return { ok: false, reason: 'not-configured' }
    }

    const url = new URL('/api/v5/otp', baseUrl)
    url.searchParams.set('template_id', templateId)
    url.searchParams.set('mobile', phone.replace(/^\+/, ''))

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          authkey: authKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({}),
      })
      const payload = await parseResponse(response)

      return isSuccessResponse(response, payload)
        ? { ok: true }
        : { ok: false, reason: 'provider-error' }
    } catch {
      return { ok: false, reason: 'provider-error' }
    }
  },

  async verify({ phone, otp }) {
    const authKey = process.env.MSG91_AUTHKEY?.trim()

    if (!fetchImpl || !authKey) {
      return { ok: false, reason: 'not-configured' }
    }

    const url = new URL('/api/v5/otp/verify', baseUrl)
    url.searchParams.set('otp', String(otp))
    url.searchParams.set('mobile', phone.replace(/^\+/, ''))

    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          authkey: authKey,
          Accept: 'application/json',
        },
      })
      const payload = await parseResponse(response)

      return isSuccessResponse(response, payload)
        ? { ok: true }
        : { ok: false, reason: 'invalid-or-expired' }
    } catch {
      return { ok: false, reason: 'provider-error' }
    }
  },
})

export const msg91OtpProvider = createMsg91OtpProvider()
