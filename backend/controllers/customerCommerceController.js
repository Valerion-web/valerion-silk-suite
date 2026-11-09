import crypto from 'node:crypto'
import prisma from '../lib/prisma.js'
import { createOrderTrackingHandler } from '../services/customerOrderTracking.js'
import { queueShipment } from '../services/shipmentQueue.js'

const productInclude = {
  category: true,
  brandRelation: true,
  imagesList: true,
  variants: true,
}

const parseImages = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : value.split(',').map((item) => item.trim()).filter(Boolean)
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
}

const serializeProduct = (product) => {
  const images = product.imagesList?.length ? product.imagesList.sort((a, b) => a.sortOrder - b.sortOrder).map((image) => image.url) : parseImages(product.images)
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description || product.fullDescription || product.shortDescription || null,
    price: Number(product.price),
    brand: product.brandRelation || (product.brand ? { name: product.brand, slug: null } : null),
    category: product.category,
    images,
    image: images[0] || null,
    hoverImage: product.hoverImage || images[1] || images[0] || null,
    countInStock: product.countInStock,
    availability: product.availability,
    sizes: typeof product.size === 'string' && product.size ? product.size.split(',').map((item) => item.trim()) : [],
    colors: typeof product.color === 'string' && product.color ? product.color.split(',').map((item) => item.trim()) : [],
    material: product.material,
    collection: product.collection,
    tags: typeof product.tags === 'string' && product.tags ? product.tags.split(',').map((item) => item.trim()) : [],
    status: product.status,
  }
}

const priceFor = (item) => Number(item.variant?.priceOverride ?? item.product.price)
const stockFor = (item) => item.variant ? Number(item.variant.quantityOnHand) : Number(item.product.countInStock)

const findCart = (tx, req) => tx.cart.findUnique({
  where: { userId_storeId: { userId: req.user.id, storeId: req.store.id } },
  include: { items: { include: { product: { include: productInclude }, variant: true }, orderBy: { id: 'asc' } } },
})

const ensureCart = async (tx, req) => tx.cart.upsert({
  where: { userId_storeId: { userId: req.user.id, storeId: req.store.id } },
  create: { userId: req.user.id, storeId: req.store.id },
  update: {},
})

const ensureWishlist = async (tx, req) => tx.wishlist.upsert({
  where: { userId_storeId: { userId: req.user.id, storeId: req.store.id } },
  create: { userId: req.user.id, storeId: req.store.id },
  update: {},
})

const cartPayload = (cart) => ({
  id: cart?.id || null,
  items: (cart?.items || []).map((item) => ({
    id: item.id,
    product: serializeProduct(item.product),
    variant: item.variant,
    quantity: item.quantity,
    unitPrice: priceFor(item),
    lineTotal: priceFor(item) * item.quantity,
    availableQuantity: stockFor(item),
  })),
})

const getValidatedLineItems = async (tx, req) => {
  const cart = await findCart(tx, req)
  if (!cart || cart.items.length === 0) {
    const error = new Error('Cart is empty')
    error.statusCode = 400
    throw error
  }
  for (const item of cart.items) {
    if (item.product.status !== 'ACTIVE' || item.product.storeId !== req.store.id) {
      const error = new Error(`Product ${item.product.name} is not available in this store`)
      error.statusCode = 409
      throw error
    }
    if (item.variant && item.variant.productId !== item.product.id) {
      const error = new Error('Cart variant does not belong to its product')
      error.statusCode = 409
      throw error
    }
    if (stockFor(item) < item.quantity) {
      const error = new Error(`Insufficient stock for ${item.product.name}`)
      error.statusCode = 409
      throw error
    }
  }
  return cart
}

const normalizeCheckoutString = (value) => typeof value === 'string' ? value.trim() : ''

const checkoutError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })

const normalizeCodAddress = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw checkoutError('A valid shipping address is required')
  }
  const name = normalizeCheckoutString(value.name)
  const line1 = normalizeCheckoutString(value.line1 ?? value.address)
  const line2 = normalizeCheckoutString(value.line2 ?? value.apartment)
  const city = normalizeCheckoutString(value.city)
  const state = normalizeCheckoutString(value.state)
  const postalCode = normalizeCheckoutString(value.postalCode ?? value.pincode)
  const country = normalizeCheckoutString(value.country)
  const phone = normalizeCheckoutString(value.phone ?? value.mobile)
  const email = normalizeCheckoutString(value.email)
  const phoneDigits = phone.replace(/\D/g, '')
  if (!name || name.length > 120 || !line1 || line1.length > 250
    || line2.length > 250 || !city || city.length > 100 || !state || state.length > 100
    || !/^[\p{L}\p{N} -]{4,12}$/u.test(postalCode) || !country || country.length > 80
    || phoneDigits.length < 10 || phoneDigits.length > 15
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw checkoutError('Enter valid shipping contact and address details')
  }
  return { name, line1, line2: line2 || null, city, state, postalCode, country, phone, email }
}

const normalizedChoice = (value) => normalizeCheckoutString(value).toLowerCase()

const resolveCodCheckoutItems = async (tx, req, rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 100) {
    throw checkoutError('A valid checkout cart is required')
  }
  const requested = rawItems.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw checkoutError('A checkout item is invalid')
    const slug = normalizeCheckoutString(item.slug)
    const size = normalizeCheckoutString(item.size)
    const color = normalizeCheckoutString(item.color)
    const quantity = Number(item.quantity)
    if (!slug || slug.length > 160 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100
      || size.length > 80 || color.length > 80) {
      throw checkoutError('A checkout item is invalid')
    }
    return { slug, size, color, quantity }
  })
  const products = await tx.product.findMany({
    where: { storeId: req.store.id, status: 'ACTIVE', slug: { in: [...new Set(requested.map((item) => item.slug))] } },
    include: { variants: true },
  })
  const productBySlug = new Map(products.map((product) => [product.slug, product]))
  const seenSelections = new Set()
  return requested.map((selection, index) => {
    const product = productBySlug.get(selection.slug)
    if (!product) throw checkoutError('A selected product is unavailable', 409)
    const activeVariants = (product.variants || []).filter((variant) => variant.status === 'ACTIVE')
    let variant = null
    if (activeVariants.length) {
      const requestedSize = normalizedChoice(selection.size)
      const requestedColor = normalizedChoice(selection.color)
      const matches = activeVariants.filter((candidate) => (
        normalizedChoice(candidate.size) === requestedSize
        && [candidate.color, candidate.colorCode].some((value) => normalizedChoice(value) === requestedColor)
      ))
      if (matches.length !== 1) throw checkoutError('A selected product option is unavailable', 409)
      variant = matches[0]
    } else if (selection.size || selection.color) {
      throw checkoutError('This product option is not configured for ordering', 409)
    }
    const selectionKey = `${product.id}:${variant?.id ?? 'none'}`
    if (seenSelections.has(selectionKey)) throw checkoutError('Duplicate product options are not allowed')
    seenSelections.add(selectionKey)
    if (!normalizeCheckoutString(variant?.sku || product.sku)) {
      throw checkoutError('A selected product is not ready for shipment', 409)
    }
    const item = {
      id: index + 1,
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity: selection.quantity,
      product,
      variant,
    }
    if (stockFor(item) < item.quantity) throw checkoutError('A selected product quantity is unavailable', 409)
    return item
  })
}

const normalizeCouponCode = (value) => String(value ?? '').trim().toUpperCase()

const parseCouponNumeric = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const resolveRestrictedCartSubtotal = (cart, coupon) => {
  if (!coupon) return { eligibleSubtotal: cart.items.reduce((sum, item) => sum + priceFor(item) * item.quantity, 0), matches: true }

  const allowedProductIds = new Set((coupon.couponProducts || []).map((entry) => Number(entry.productId)).filter((value) => Number.isFinite(value)))
  const allowedCategoryIds = new Set((coupon.couponCategories || []).map((entry) => Number(entry.categoryId)).filter((value) => Number.isFinite(value)))

  if (allowedProductIds.size === 0 && allowedCategoryIds.size === 0) {
    return { eligibleSubtotal: cart.items.reduce((sum, item) => sum + priceFor(item) * item.quantity, 0), matches: true }
  }

  const hasProductRestriction = allowedProductIds.size > 0
  const hasCategoryRestriction = allowedCategoryIds.size > 0

  let eligibleSubtotal = 0
  for (const item of cart.items) {
    const productId = Number(item.productId ?? item.product?.id)
    const categoryId = Number(item.product?.categoryId ?? item.product?.category?.id)
    const isProductMatch = !hasProductRestriction || allowedProductIds.has(productId)
    const isCategoryMatch = !hasCategoryRestriction || allowedCategoryIds.has(categoryId)
    const isEligible = !hasProductRestriction && !hasCategoryRestriction
      ? true
      : hasProductRestriction && hasCategoryRestriction
        ? isProductMatch || isCategoryMatch
        : hasProductRestriction
          ? isProductMatch
          : isCategoryMatch
    if (isEligible) {
      eligibleSubtotal += priceFor(item) * item.quantity
    }
  }

  return { eligibleSubtotal, matches: eligibleSubtotal > 0 }
}

const calculateTotalsForCart = async (tx, req, cart, couponCode) => {
  const subtotal = cart.items.reduce((sum, item) => sum + priceFor(item) * item.quantity, 0)
  let discount = 0
  let coupon = null
  let eligibleSubtotal = subtotal

  const normalizedCouponCode = normalizeCouponCode(couponCode)
  if (normalizedCouponCode) {
    const couponRecord = await tx.coupon.findFirst({
      where: { storeId: req.store.id, code: normalizedCouponCode, active: true },
      include: { couponProducts: { select: { productId: true } }, couponCategories: { select: { categoryId: true } } },
    })

    const couponId = couponRecord?.id ?? null
    const [productRestrictions, categoryRestrictions, userUsageCount] = await Promise.all([
      couponId ? tx.couponProduct.findMany({ where: { couponId }, select: { productId: true } }) : Promise.resolve([]),
      couponId ? tx.couponCategory.findMany({ where: { couponId }, select: { categoryId: true } }) : Promise.resolve([]),
      couponId ? tx.couponUsage.count({ where: { couponId, userId: req.user.id } }) : Promise.resolve(0),
    ])

    coupon = couponRecord || null

    const now = new Date()
    if (!coupon || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now) || (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) || (coupon.userUsageLimit !== null && userUsageCount >= coupon.userUsageLimit) || (coupon.minOrderValue !== null && subtotal < coupon.minOrderValue)) {
      const error = new Error('Coupon is invalid or not applicable')
      error.statusCode = 400
      throw error
    }

    const restrictions = {
      ...coupon,
      couponProducts: (coupon.couponProducts || productRestrictions || []).map((entry) => ({ productId: entry.productId })),
      couponCategories: (coupon.couponCategories || categoryRestrictions || []).map((entry) => ({ categoryId: entry.categoryId })),
    }

    const resolved = resolveRestrictedCartSubtotal(cart, restrictions)
    if (!resolved.matches || resolved.eligibleSubtotal <= 0) {
      const error = new Error('Coupon is invalid or not applicable')
      error.statusCode = 400
      throw error
    }

    eligibleSubtotal = resolved.eligibleSubtotal
    const maxOrderValue = parseCouponNumeric(coupon.maxOrderValue, null)
    if (maxOrderValue !== null && eligibleSubtotal > maxOrderValue) {
      const error = new Error('Coupon is invalid or not applicable')
      error.statusCode = 400
      throw error
    }

    const rawDiscount = coupon.discountType === 'PERCENTAGE'
      ? eligibleSubtotal * (parseCouponNumeric(coupon.value, 0) / 100)
      : parseCouponNumeric(coupon.value, 0)

    discount = Math.min(eligibleSubtotal, Math.max(0, rawDiscount))
    const maxDiscount = parseCouponNumeric(coupon.maxDiscount, null)
    if (maxDiscount !== null) {
      discount = Math.min(discount, maxDiscount)
    }
  }

  const discountedSubtotal = Math.max(0, subtotal - discount)
  const shipping = coupon && coupon.allowFreeShipping ? 0 : discountedSubtotal >= 15000 ? 0 : 500
  return {
    cart,
    subtotal,
    eligibleSubtotal,
    discount,
    shipping,
    total: discountedSubtotal + shipping,
    coupon,
    couponCode: coupon ? coupon.code : null,
    couponId: coupon ? coupon.id : null,
    discountAmount: discount,
    subtotalBeforeDiscount: subtotal,
    shippingCost: shipping,
  }
}

export const calculateTotals = async (tx, req, couponCode) => (
  calculateTotalsForCart(tx, req, await getValidatedLineItems(tx, req), couponCode)
)

const paymentCheckoutLineFor = (item) => {
  const unitPrice = priceFor(item)
  return {
    cartItemId: item.id,
    productId: item.productId,
    variantId: item.variantId ?? null,
    quantity: item.quantity,
    unitPrice,
    lineAmount: unitPrice * item.quantity,
  }
}

export const createPaymentCheckoutSnapshot = (totals, req, idempotencyKey) => {
  const shippingAddress = JSON.stringify(req.body?.shippingAddress || {})
  const billingAddress = JSON.stringify(req.body?.billingAddress || req.body?.shippingAddress || {})
  return {
    version: 1,
    cartId: totals.cart.id,
    items: totals.cart.items.map(paymentCheckoutLineFor),
    subtotal: totals.subtotal,
    eligibleSubtotal: totals.eligibleSubtotal,
    discountAmount: totals.discountAmount,
    shippingCost: totals.shippingCost,
    total: totals.total,
    currency: 'INR',
    coupon: totals.coupon ? {
      id: totals.coupon.id,
      code: totals.coupon.code,
      eligibleSubtotal: totals.eligibleSubtotal,
      discountAmount: totals.discountAmount,
      usageLimit: totals.coupon.usageLimit,
      userUsageLimit: totals.coupon.userUsageLimit,
    } : null,
    shippingAddress,
    billingAddress,
    requestFingerprint: fingerprintFor({ shippingAddress, billingAddress, couponCode: req.body?.couponCode || null }),
    requestContextFingerprint: fingerprintFor({ userId: req.user.id, storeId: req.store.id, idempotencyKey }),
  }
}

export const assertPaymentCheckoutSnapshotMatchesRequest = async (tx, req, payment) => {
  const snapshot = payment.checkoutSnapshot
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.items) || !Number.isInteger(snapshot.cartId)) {
    const error = new Error('Payment checkout snapshot is unavailable or invalid')
    error.statusCode = 409
    throw error
  }

  const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : ''
  const shippingAddress = JSON.stringify(req.body?.shippingAddress || {})
  const billingAddress = JSON.stringify(req.body?.billingAddress || req.body?.shippingAddress || {})
  const requestFingerprint = fingerprintFor({ shippingAddress, billingAddress, couponCode: req.body?.couponCode || null })
  const requestContextFingerprint = fingerprintFor({ userId: req.user.id, storeId: req.store.id, idempotencyKey })
  if (payment.idempotencyKey !== idempotencyKey || snapshot.requestFingerprint !== requestFingerprint || snapshot.requestContextFingerprint !== requestContextFingerprint) {
    const error = new Error('Payment attempt key was reused with different checkout context')
    error.statusCode = 409
    throw error
  }

  if (payment.orderId) return snapshot

  const cart = await findCart(tx, req)
  const currentLines = (cart?.items || []).map(paymentCheckoutLineFor)
  const savedLines = [...snapshot.items].sort((left, right) => left.cartItemId - right.cartItemId)
  if (!cart || cart.id !== snapshot.cartId || currentLines.length !== savedLines.length || currentLines.some((line, index) => {
    const saved = savedLines[index]
    return line.cartItemId !== saved.cartItemId || line.productId !== saved.productId || line.variantId !== (saved.variantId ?? null) || line.quantity !== saved.quantity || line.unitPrice !== saved.unitPrice || line.lineAmount !== saved.lineAmount
  })) {
    const error = new Error('Payment attempt key was reused with a changed cart')
    error.statusCode = 409
    throw error
  }
  return snapshot
}

export const getCart = async (req, res, next) => {
  try {
    const cart = await findCart(prisma, req)
    res.json(cartPayload(cart))
  } catch (error) {
    next(error)
  }
}

export const addCartItem = async (req, res, next) => {
  try {
    const productId = Number(req.body?.productId)
    const variantId = req.body?.variantId == null || req.body.variantId === '' ? null : Number(req.body.variantId)
    const quantity = Number(req.body?.quantity)
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
      res.status(400)
      throw new Error('productId and a positive integer quantity are required')
    }

    const product = await prisma.product.findFirst({ where: { id: productId, storeId: req.store.id, status: 'ACTIVE' }, include: { variants: true } })
    if (!product) {
      res.status(404)
      throw new Error('Product not found in selected store')
    }
    const variant = variantId === null ? null : product.variants.find((item) => item.id === variantId)
    if (variantId !== null && !variant) {
      res.status(400)
      throw new Error('Variant does not belong to product')
    }
    const available = variant ? variant.quantityOnHand : product.countInStock
    if (available < quantity) {
      res.status(409)
      throw new Error('Requested quantity is unavailable')
    }

    const cart = await ensureCart(prisma, req)
    const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId, variantId } })
    const nextQuantity = (existing?.quantity || 0) + quantity
    if (available < nextQuantity) {
      res.status(409)
      throw new Error('Requested quantity exceeds available stock')
    }
    if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } })
    else await prisma.cartItem.create({ data: { cartId: cart.id, productId, variantId, quantity } })
    res.status(201).json(cartPayload(await findCart(prisma, req)))
  } catch (error) {
    next(error)
  }
}

export const updateCartItem = async (req, res, next) => {
  try {
    const quantity = Number(req.body?.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400)
      throw new Error('Quantity must be a positive integer')
    }
    const item = await prisma.cartItem.findFirst({ where: { id: Number(req.params.id), cart: { userId: req.user.id, storeId: req.store.id } }, include: { product: true, variant: true } })
    if (!item) {
      res.status(404)
      throw new Error('Cart item not found')
    }
    if (stockFor(item) < quantity) {
      res.status(409)
      throw new Error('Requested quantity is unavailable')
    }
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } })
    res.json(cartPayload(await findCart(prisma, req)))
  } catch (error) {
    next(error)
  }
}

export const removeCartItem = async (req, res, next) => {
  try {
    const item = await prisma.cartItem.findFirst({ where: { id: Number(req.params.id), cart: { userId: req.user.id, storeId: req.store.id } } })
    if (!item) {
      res.status(404)
      throw new Error('Cart item not found')
    }
    await prisma.cartItem.delete({ where: { id: item.id } })
    res.json(cartPayload(await findCart(prisma, req)))
  } catch (error) {
    next(error)
  }
}

export const clearCart = async (req, res, next) => {
  try {
    const cart = await findCart(prisma, req)
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
    res.json({ id: cart?.id || null, items: [] })
  } catch (error) {
    next(error)
  }
}

export const getWishlist = async (req, res, next) => {
  try {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId_storeId: { userId: req.user.id, storeId: req.store.id } }, include: { items: { include: { product: { include: productInclude } }, orderBy: { id: 'asc' } } } })
    res.json({ id: wishlist?.id || null, items: (wishlist?.items || []).map((item) => ({ id: item.id, product: serializeProduct(item.product), createdAt: item.createdAt })) })
  } catch (error) {
    next(error)
  }
}

export const addWishlistItem = async (req, res, next) => {
  try {
    const productId = Number(req.body?.productId)
    const product = await prisma.product.findFirst({ where: { id: productId, storeId: req.store.id, status: 'ACTIVE' } })
    if (!product) {
      res.status(404)
      throw new Error('Product not found in selected store')
    }
    const wishlist = await ensureWishlist(prisma, req)
    await prisma.wishlistItem.upsert({ where: { wishlistId_productId: { wishlistId: wishlist.id, productId } }, create: { wishlistId: wishlist.id, productId }, update: {} })
    return getWishlist(req, res, next)
  } catch (error) {
    next(error)
  }
}

export const removeWishlistItem = async (req, res, next) => {
  try {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId_storeId: { userId: req.user.id, storeId: req.store.id } } })
    if (wishlist) await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, productId: Number(req.params.productId) } })
    return getWishlist(req, res, next)
  } catch (error) {
    next(error)
  }
}

export const validateCheckout = async (req, res, next) => {
  try {
    const result = await calculateTotals(prisma, req, req.body?.couponCode)
    res.json({ subtotal: result.subtotal, discount: result.discount, shipping: result.shipping, total: result.total, currency: 'INR', items: cartPayload(result.cart).items })
  } catch (error) {
    next(error)
  }
}

const idempotencyKeyFor = (req) => {
  const bodyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : ''
  const headerKey = typeof req.get('Idempotency-Key') === 'string' ? req.get('Idempotency-Key').trim() : ''
  return bodyKey || headerKey || null
}

const fingerprintFor = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const COD_MAX_TOTAL_CENTS = 5_000_000

const codRequestFingerprint = ({ items, shippingAddress, billingAddress, couponCode }) => {
  const normalizedItems = items.map((item) => ({
    slug: item.slug.trim().toLowerCase(),
    size: item.size.trim().toLowerCase(),
    color: item.color.trim().toLowerCase(),
    quantity: item.quantity,
  })).sort((left, right) => (
    left.slug.localeCompare(right.slug)
    || left.size.localeCompare(right.size)
    || left.color.localeCompare(right.color)
    || left.quantity - right.quantity
  ))
  return fingerprintFor({
    items: normalizedItems,
    shippingAddress,
    billingAddress,
    couponCode: normalizeCouponCode(couponCode),
  })
}

const codAmountInCents = (amount) => {
  const cents = Math.round(Number(amount) * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw checkoutError('The COD collection amount is invalid')
  }
  return cents
}

const findExistingCodPayment = async (tx, req, idempotencyKey, fingerprint) => {
  const payments = await tx.payment.findMany({
    where: { userId: req.user.id, storeId: req.store.id, idempotencyKey },
    include: { order: { select: { id: true } } },
  })
  if (payments.length > 1) throw checkoutError('This checkout key is already associated with another payment', 409)
  const payment = payments[0]
  if (!payment) return null
  if (payment.provider !== 'COD'
    || payment.status !== 'PENDING_COLLECTION'
    || payment.checkoutSnapshot?.type !== 'COD'
    || payment.checkoutSnapshot?.requestFingerprint !== fingerprint
    || !payment.orderId) {
    throw checkoutError('This checkout key is already associated with a different payment request', 409)
  }
  return { orderId: payment.orderId, paymentStatus: payment.status, amount: payment.amount }
}

const codEligibilityFor = async (tx, req) => {
  const items = await resolveCodCheckoutItems(tx, req, req.body?.items)
  const cart = { id: null, items }
  const totals = await calculateTotalsForCart(tx, req, cart, req.body?.couponCode)
  const totalCents = codAmountInCents(totals.total)
  return {
    eligible: totalCents < COD_MAX_TOTAL_CENTS,
    reason: totalCents < COD_MAX_TOTAL_CENTS ? null : 'COD is available only for orders below ₹50,000',
    subtotal: totals.subtotal,
    discount: totals.discount,
    shipping: totals.shipping,
    total: totals.total,
    currency: 'INR',
    items: items.map((item) => ({
      slug: item.product.slug,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: priceFor(item),
      lineTotal: priceFor(item) * item.quantity,
    })),
  }
}

export const getCodEligibility = async (req, res, next) => {
  try {
    const result = await prisma.$transaction((tx) => codEligibilityFor(tx, req))
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export const createCodOrder = async (req, res, next) => {
  const idempotencyKey = idempotencyKeyFor(req)
  let fingerprint
  try {
    if (!idempotencyKey || !/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)) {
      throw checkoutError('A valid checkout idempotency key is required')
    }
    const shippingAddress = normalizeCodAddress(req.body?.shippingAddress)
    const billingAddress = normalizeCodAddress(req.body?.billingAddress ?? req.body?.shippingAddress)
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    fingerprint = codRequestFingerprint({
      items: items.map((item) => ({
        slug: normalizeCheckoutString(item?.slug),
        size: normalizeCheckoutString(item?.size),
        color: normalizeCheckoutString(item?.color),
        quantity: Number(item?.quantity),
      })),
      shippingAddress,
      billingAddress,
      couponCode: req.body?.couponCode,
    })
    const result = await prisma.$transaction(async (tx) => {
      const existingPayment = await findExistingCodPayment(tx, req, idempotencyKey, fingerprint)
      if (existingPayment) return { ...existingPayment, created: false }
      const existingOrder = await tx.order.findUnique({
        where: { userId_storeId_idempotencyKey: { userId: req.user.id, storeId: req.store.id, idempotencyKey } },
        select: { id: true },
      })
      if (existingOrder) throw checkoutError('This checkout key is already associated with another order', 409)

      const resolvedItems = await resolveCodCheckoutItems(tx, req, items)
      const cart = await ensureCart(tx, req)
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
      await tx.cartItem.createMany({
        data: resolvedItems.map((item) => ({
          cartId: cart.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      })
      const checkoutReq = {
        ...req,
        body: { ...req.body, shippingAddress, billingAddress },
      }
      const finalized = await finalizeOrderFromCart(tx, checkoutReq, {
        idempotencyKey,
        requireIdempotency: true,
      })
      if (!finalized.created) throw checkoutError('This checkout key is already associated with another order', 409)
      const amountCents = codAmountInCents(finalized.order.totalPrice)
      if (amountCents >= COD_MAX_TOTAL_CENTS) {
        throw checkoutError('COD is available only for orders below ₹50,000', 400)
      }
      await tx.payment.create({
        data: {
          userId: req.user.id,
          storeId: req.store.id,
          orderId: finalized.order.id,
          provider: 'COD',
          status: 'PENDING_COLLECTION',
          amount: finalized.order.totalPrice,
          currency: 'INR',
          idempotencyKey,
          paymentAttemptKey: `cod_${idempotencyKey}`,
          checkoutSnapshot: { version: 1, type: 'COD', requestFingerprint: fingerprint },
        },
      })
      await queueShipment(tx, finalized.order.id)
      return {
        orderId: finalized.order.id,
        paymentStatus: 'PENDING_COLLECTION',
        amount: finalized.order.totalPrice,
        created: true,
      }
    }, { isolationLevel: 'Serializable' })
    res.status(result.created ? 201 : 200).json({
      success: true,
      orderId: result.orderId,
      paymentStatus: result.paymentStatus,
      amount: result.amount,
      currency: 'INR',
    })
  } catch (error) {
    if (['P2002', 'P2034'].includes(error?.code) && idempotencyKey && fingerprint) {
      try {
        const replay = await findExistingCodPayment(prisma, req, idempotencyKey, fingerprint)
        if (replay) {
          return res.status(200).json({
            success: true,
            orderId: replay.orderId,
            paymentStatus: replay.paymentStatus,
            amount: replay.amount,
            currency: 'INR',
          })
        }
      } catch (lookupError) {
        if (lookupError?.statusCode) return res.status(lookupError.statusCode).json({ message: lookupError.message })
      }
      if (error.code === 'P2034') {
        return res.status(409).json({ message: 'Checkout is being finalized. Retry with the same idempotency key.' })
      }
    }
    if (error?.statusCode) return res.status(error.statusCode).json({ message: error.message })
    next(error)
  }
}

const totalsFromPaymentSnapshot = async (tx, req, snapshot) => {
  const invalidSnapshot = () => Object.assign(new Error('Payment checkout snapshot is invalid'), { statusCode: 409 })
  if (snapshot?.version !== 1 || snapshot.currency !== 'INR' || !Number.isInteger(snapshot.cartId) || !Array.isArray(snapshot.items) || snapshot.items.length === 0) throw invalidSnapshot()

  const productIds = [...new Set(snapshot.items.map((item) => Number(item.productId)).filter(Number.isInteger))]
  if (productIds.length !== new Set(snapshot.items.map((item) => item.productId)).size) throw invalidSnapshot()
  const products = await tx.product.findMany({ where: { id: { in: productIds }, storeId: req.store.id }, include: productInclude })
  const productById = new Map(products.map((product) => [product.id, product]))
  const items = snapshot.items.map((line) => {
    const product = productById.get(line.productId)
    const cartItemId = Number(line.cartItemId)
    const quantity = Number(line.quantity)
    const unitPrice = Number(line.unitPrice)
    const lineAmount = Number(line.lineAmount)
    const variantId = line.variantId == null ? null : Number(line.variantId)
    const variant = variantId == null ? null : product?.variants?.find((candidate) => candidate.id === variantId)
    if (!product || product.status !== 'ACTIVE' || !Number.isInteger(cartItemId) || cartItemId < 1 || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(lineAmount) || Math.round(unitPrice * quantity * 100) !== Math.round(lineAmount * 100) || (variantId != null && (!variant || variant.productId !== product.id || variant.status !== 'ACTIVE'))) throw invalidSnapshot()
    return {
      id: cartItemId,
      cartId: snapshot.cartId,
      productId: product.id,
      variantId,
      quantity,
      product,
      variant,
      snapshotUnitPrice: unitPrice,
      snapshotLineAmount: lineAmount,
    }
  })

  const subtotal = Number(snapshot.subtotal)
  const eligibleSubtotal = Number(snapshot.eligibleSubtotal)
  const discountAmount = Number(snapshot.discountAmount)
  const shippingCost = Number(snapshot.shippingCost)
  const total = Number(snapshot.total)
  const computedSubtotal = items.reduce((sum, item) => sum + item.snapshotLineAmount, 0)
  const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : ''
  const expectedContextFingerprint = fingerprintFor({ userId: req.user.id, storeId: req.store.id, idempotencyKey })
  if (![subtotal, eligibleSubtotal, discountAmount, shippingCost, total].every(Number.isFinite)
    || subtotal < 0 || eligibleSubtotal < 0 || eligibleSubtotal > subtotal || discountAmount < 0 || discountAmount > subtotal || shippingCost < 0 || total < 0
    || Math.round(computedSubtotal * 100) !== Math.round(subtotal * 100)
    || Math.round(total * 100) !== Math.round((Math.max(0, subtotal - discountAmount) + shippingCost) * 100)
    || typeof snapshot.shippingAddress !== 'string'
    || typeof snapshot.billingAddress !== 'string'
    || typeof snapshot.requestFingerprint !== 'string'
    || snapshot.requestContextFingerprint !== expectedContextFingerprint) throw invalidSnapshot()

  const coupon = snapshot.coupon == null ? null : snapshot.coupon
  if (coupon && (!Number.isInteger(coupon.id)
    || typeof coupon.code !== 'string'
    || (coupon.usageLimit != null && (!Number.isInteger(coupon.usageLimit) || coupon.usageLimit < 0))
    || (coupon.userUsageLimit != null && (!Number.isInteger(coupon.userUsageLimit) || coupon.userUsageLimit < 0)))) throw invalidSnapshot()
  return {
    cart: { id: snapshot.cartId, items },
    subtotal,
    eligibleSubtotal,
    discount: discountAmount,
    discountAmount,
    shipping: shippingCost,
    shippingCost,
    total,
    coupon,
    couponId: coupon?.id ?? null,
    couponCode: coupon?.code ?? null,
    subtotalBeforeDiscount: subtotal,
  }
}

export const finalizeOrderFromCart = async (tx, req, { idempotencyKey = null, requireIdempotency = false, checkoutSnapshot = null } = {}) => {
  if (requireIdempotency && !idempotencyKey) {
    const error = new Error('Payment idempotency reference is required')
    error.statusCode = 400
    throw error
  }

  if (idempotencyKey) {
    const existingOrder = await tx.order.findUnique({
      where: { userId_storeId_idempotencyKey: { userId: req.user.id, storeId: req.store.id, idempotencyKey } },
      include: { items: { include: { product: { include: productInclude }, variant: true } }, statusHistory: true },
    })
    if (existingOrder) return { order: existingOrder, created: false }
  }

  const totals = checkoutSnapshot
    ? await totalsFromPaymentSnapshot(tx, req, checkoutSnapshot)
    : await calculateTotals(tx, req, req.body?.couponCode)
  const shippingAddress = checkoutSnapshot ? checkoutSnapshot.shippingAddress : JSON.stringify(req.body?.shippingAddress || {})
  const billingAddress = checkoutSnapshot ? checkoutSnapshot.billingAddress : JSON.stringify(req.body?.billingAddress || req.body?.shippingAddress || {})
  const requestFingerprint = checkoutSnapshot?.requestFingerprint || fingerprintFor({ shippingAddress, billingAddress, couponCode: req.body?.couponCode || null })
  const requestContextFingerprint = checkoutSnapshot?.requestContextFingerprint || fingerprintFor({ userId: req.user.id, storeId: req.store.id, idempotencyKey })
  const order = await tx.order.create({
    data: {
      userId: req.user.id,
      storeId: req.store.id,
      status: 'PLACED',
      totalPrice: totals.total,
      currency: 'INR',
      shippingAddress,
      billingAddress,
      idempotencyKey,
      requestFingerprint,
      requestContextFingerprint,
      couponId: totals.couponId,
      couponCode: totals.couponCode,
      discountAmount: totals.discountAmount,
      subtotalBeforeDiscount: totals.subtotalBeforeDiscount,
      shippingCost: totals.shippingCost,
      items: { create: totals.cart.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, price: item.snapshotUnitPrice ?? priceFor(item) })) },
      statusHistory: { create: { status: 'PLACED', note: 'Order placed by customer', changedById: req.user.id } },
    },
    include: { items: { include: { product: { include: productInclude }, variant: true } }, statusHistory: true },
  })

  for (const item of totals.cart.items) {
    const available = stockFor(item)
    if (available < item.quantity) {
      const error = new Error(`Insufficient stock for ${item.product.name}`)
      error.statusCode = 409
      throw error
    }
    if (item.variantId) {
      const updated = await tx.productVariant.updateMany({ where: { id: item.variantId, productId: item.productId, quantityOnHand: { gte: item.quantity }, status: 'ACTIVE' }, data: { quantityOnHand: { decrement: item.quantity } } })
      if (updated.count !== 1) {
        const error = new Error('Stock changed while ordering')
        error.statusCode = 409
        throw error
      }
    } else {
      const updated = await tx.product.updateMany({ where: { id: item.productId, storeId: req.store.id, countInStock: { gte: item.quantity }, status: 'ACTIVE' }, data: { countInStock: { decrement: item.quantity } } })
      if (updated.count !== 1) {
        const error = new Error('Stock changed while ordering')
        error.statusCode = 409
        throw error
      }
    }
    await tx.stockHistory.create({ data: { productId: item.productId, variantId: item.variantId, change: -item.quantity, mode: 'SALE', reason: 'Customer order', referenceId: String(order.id) } })
  }
  if (checkoutSnapshot) {
    await tx.cartItem.deleteMany({
      where: {
        cartId: checkoutSnapshot.cartId,
        OR: totals.cart.items.map((item) => ({ id: item.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
      },
    })
  } else {
    await tx.cartItem.deleteMany({ where: { cartId: totals.cart.id } })
  }
  if (totals.coupon) {
    const usageLimit = totals.coupon.usageLimit
    const userUsageLimit = totals.coupon.userUsageLimit
    const usageClaim = await tx.coupon.updateMany({
      where: {
        id: totals.coupon.id,
        storeId: req.store.id,
        ...(usageLimit == null ? {} : { usageCount: { lt: usageLimit } }),
      },
      data: { usageCount: { increment: 1 } },
    })
    if (usageClaim.count !== 1) {
      const error = new Error('Coupon usage limit was reached before order finalization')
      error.statusCode = 409
      throw error
    }
    if (userUsageLimit != null) {
      const userUsageCount = await tx.couponUsage.count({ where: { couponId: totals.coupon.id, userId: req.user.id } })
      if (userUsageCount >= userUsageLimit) {
        const error = new Error('Coupon user usage limit was reached before order finalization')
        error.statusCode = 409
        throw error
      }
    }
    await tx.couponUsage.create({
      data: {
        couponId: totals.coupon.id,
        userId: req.user.id,
        orderId: order.id,
        amountDiscounted: totals.discountAmount,
      },
    })
  }
  return { order, created: true }
}

export const createOrder = async (req, res, next) => {
  try {
    const idempotencyKey = idempotencyKeyFor(req)
    const result = await prisma.$transaction((tx) => finalizeOrderFromCart(tx, req, { idempotencyKey }))
    res.status(result.created ? 201 : 200).json(result.order)
  } catch (error) {
    if (error?.code === 'P2002' && idempotencyKeyFor(req)) {
      const existingOrder = await prisma.order.findUnique({ where: { userId_storeId_idempotencyKey: { userId: req.user.id, storeId: req.store.id, idempotencyKey: idempotencyKeyFor(req) } } })
      if (existingOrder) return res.status(200).json(existingOrder)
    }
    next(error)
  }
}

export const getOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({ where: { userId: req.user.id, storeId: req.store.id }, include: { items: { include: { product: { include: productInclude }, variant: true } }, statusHistory: true }, orderBy: { createdAt: 'desc' } })
    res.json(orders)
  } catch (error) {
    next(error)
  }
}

export const getOrder = async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({ where: { id: Number(req.params.id), userId: req.user.id, storeId: req.store.id }, include: { items: { include: { product: { include: productInclude }, variant: true } }, statusHistory: { orderBy: { createdAt: 'asc' } }, payments: { select: { provider: true, status: true } } } })
    if (!order) {
      res.status(404)
      throw new Error('Order not found')
    }
    res.json(order)
  } catch (error) {
    next(error)
  }
}

export const getOrderTracking = createOrderTrackingHandler({ prismaClient: prisma })
