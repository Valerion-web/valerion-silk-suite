import { createHmac } from 'node:crypto'

const OTP_EXPIRY_MS = 5 * 60 * 1000
const DIGEST_DOMAIN_SEPARATOR = 'HASTON:MSG91:PHONE-OTP:CONSUMED:v1\0'

export const createConsumedPhoneOtpClaimer = ({ clock = Date.now, getJwtSecret = () => process.env.JWT_SECRET } = {}) => (
  async (prismaClient, phone, otp) => {
    const jwtSecret = getJwtSecret()
    if (typeof jwtSecret !== 'string' || !jwtSecret) throw new Error('JWT_SECRET is required for OTP claims')

    const digest = createHmac('sha256', jwtSecret)
      .update(DIGEST_DOMAIN_SEPARATOR)
      .update(phone)
      .update('\0')
      .update(otp)
      .digest('hex')
    const now = new Date(clock())

    try {
      await prismaClient.$transaction(async (transaction) => {
        await transaction.consumedPhoneOtp.deleteMany({
          where: { digest, expiresAt: { lte: now } },
        })
        await transaction.consumedPhoneOtp.create({
          data: { digest, expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS) },
        })
      })
      return true
    } catch (error) {
      if (error?.code === 'P2002') return false
      throw error
    }
  }
)

export const claimConsumedPhoneOtp = createConsumedPhoneOtpClaimer()