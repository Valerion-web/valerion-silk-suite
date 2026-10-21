import { parsePhoneNumberFromString } from 'libphonenumber-js'

export const normalizeIndianPhone = (input) => {
  if (typeof input !== 'string') return null

  let candidate = input.trim()
  if (/^91\d{10}$/.test(candidate)) candidate = `+${candidate}`

  const phone = parsePhoneNumberFromString(candidate, 'IN')
  if (!phone || phone.country !== 'IN' || !phone.isValid()) return null
  return phone.number
}