const WINDOW_MS = 15 * 60 * 1000
const SEND_PHONE_LIMIT = 3
const SEND_IP_LIMIT = 20
const VERIFY_PHONE_LIMIT = 5
const VERIFY_IP_LIMIT = 60
const SEND_COOLDOWN_MS = 60 * 1000
const MAX_ENTRIES = 50_000

export const createPhoneOtpControls = ({ clock = Date.now } = {}) => {
  const counters = new Map()
  const cooldowns = new Map()

  const prune = (now) => {
    for (const [key, entry] of counters) {
      if (entry.expiresAt <= now) counters.delete(key)
    }
    for (const [key, expiresAt] of cooldowns) {
      if (expiresAt <= now) cooldowns.delete(key)
    }
  }

  const consume = (kind, ip, phone) => {
    const now = clock()
    prune(now)
    const isSend = kind === 'send'
    const limits = [
      { key: `${kind}:ip:${ip}`, max: isSend ? SEND_IP_LIMIT : VERIFY_IP_LIMIT },
      ...(phone ? [{ key: `${kind}:phone:${phone}`, max: isSend ? SEND_PHONE_LIMIT : VERIFY_PHONE_LIMIT }] : []),
    ]

    if (limits.some(({ key, max }) => (counters.get(key)?.count || 0) >= max)) return false
  const newEntries = limits.filter(({ key }) => !counters.has(key)).length
  if (counters.size + cooldowns.size + newEntries > MAX_ENTRIES) return false
    for (const { key } of limits) {
      const current = counters.get(key)
      counters.set(key, {
        count: (current?.count || 0) + 1,
        expiresAt: current?.expiresAt || now + WINDOW_MS,
      })
    }
    return true
  }

  return {
    allowSend: (ip, phone) => consume('send', ip, phone),
    allowVerify: (ip, phone) => consume('verify', ip, phone),
    reserveCooldown(phone) {
      const now = clock()
      prune(now)
      if ((cooldowns.get(phone) || 0) > now) return false
      if (!cooldowns.has(phone) && counters.size + cooldowns.size >= MAX_ENTRIES) return false
      cooldowns.set(phone, now + SEND_COOLDOWN_MS)
      return true
    },
    releaseCooldown(phone) {
      cooldowns.delete(phone)
    },
  }
}

export const phoneOtpControls = createPhoneOtpControls()