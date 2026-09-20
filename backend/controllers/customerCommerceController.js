import crypto from 'node:crypto'
import prisma from '../lib/prisma.js'

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

export const calculateTotals = async (tx, req, couponCode) => {
  const cart = await getValidatedLineItems(tx, req)
  const subtotal = cart.items.reduce((sum, item) => sum + priceFor(item) * item.quantity, 0)
  let discount = 0
  let coupon = null

  if (couponCode) {
    coupon = await tx.coupon.findFirst({ where: { storeId: req.store.id, code: String(couponCode).trim().toUpperCase(), active: true } })
    const now = new Date()
    if (!coupon || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now) || (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) || (coupon.minOrderValue !== null && subtotal < coupon.minOrderValue)) {
      const error = new Error('Coupon is invalid or not applicable')
      error.statusCode = 400
      throw error
    }
    discount = coupon.discountType === 'PERCENTAGE' ? subtotal * (coupon.value / 100) : coupon.value
    discount = Math.min(subtotal, Math.max(0, discount))
  }

  const discountedSubtotal = subtotal - discount
  const shipping = discountedSubtotal >= 15000 ? 0 : 500
  return { cart, subtotal, discount, shipping, total: discountedSubtotal + shipping, coupon }
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

export const finalizeOrderFromCart = async (tx, req, { idempotencyKey = null, requireIdempotency = false } = {}) => {
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

  const totals = await calculateTotals(tx, req, req.body?.couponCode)
  const shippingAddress = JSON.stringify(req.body?.shippingAddress || {})
  const billingAddress = JSON.stringify(req.body?.billingAddress || req.body?.shippingAddress || {})
  const requestFingerprint = fingerprintFor({ shippingAddress, billingAddress, couponCode: req.body?.couponCode || null })
  const requestContextFingerprint = fingerprintFor({ userId: req.user.id, storeId: req.store.id, idempotencyKey })
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
      items: { create: totals.cart.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, price: priceFor(item) })) },
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
  await tx.cartItem.deleteMany({ where: { cartId: totals.cart.id } })
  if (totals.coupon) await tx.coupon.update({ where: { id: totals.coupon.id }, data: { usageCount: { increment: 1 } } })
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

export const getOrderTracking = async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({ where: { id: Number(req.params.id), userId: req.user.id, storeId: req.store.id }, select: { id: true, status: true, statusHistory: { orderBy: { createdAt: 'asc' } } } })
    if (!order) {
      res.status(404)
      throw new Error('Order not found')
    }
    res.json(order)
  } catch (error) {
    next(error)
  }
}
