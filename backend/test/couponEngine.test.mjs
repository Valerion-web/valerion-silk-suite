import assert from 'node:assert/strict'
import { test } from 'node:test'
import prisma from '../lib/prisma.js'
import { calculateTotals, finalizeOrderFromCart } from '../controllers/customerCommerceController.js'
import { deleteAdminCoupon } from '../controllers/adminController.js'

const makeReq = (overrides = {}) => ({
  user: { id: 42 },
  store: { id: 7 },
  body: {},
  ...overrides,
})

const makeItem = ({ id, productId, name, price, categoryId, quantity = 1, variantPrice = null }) => ({
  id,
  productId,
  variantId: null,
  quantity,
  product: {
    id: productId,
    name,
    price,
    categoryId,
    status: 'ACTIVE',
    storeId: 7,
    imagesList: [],
    category: { id: categoryId },
    variants: [],
  },
  variant: variantPrice !== null ? { productId, priceOverride: variantPrice, quantityOnHand: 999, status: 'ACTIVE' } : null,
})

const makeCoupon = (overrides = {}) => ({
  id: 10,
  code: 'SAVE20',
  discountType: 'PERCENTAGE',
  value: 20,
  active: true,
  usageLimit: null,
  usageCount: 0,
  userUsageLimit: null,
  minOrderValue: null,
  maxOrderValue: null,
  maxDiscount: null,
  startsAt: null,
  endsAt: null,
  allowFreeShipping: false,
  storeId: 7,
  ...overrides,
})

test('global percentage coupon applies to cart subtotal', async () => {
  const tx = {
    cart: {
      findUnique: async () => ({
        id: 1,
        items: [
          makeItem({ id: 1, productId: 101, name: 'A', price: 2000, categoryId: 10, quantity: 1 }),
          makeItem({ id: 2, productId: 102, name: 'B', price: 3000, categoryId: 11, quantity: 1 }),
        ],
      }),
    },
    coupon: { findFirst: async () => makeCoupon() },
    couponProduct: { findMany: async () => [] },
    couponCategory: { findMany: async () => [] },
    couponUsage: { count: async () => 0 },
  }

  const result = await calculateTotals(tx, makeReq({ body: { couponCode: 'save20' } }), 'save20')

  assert.equal(result.subtotal, 5000)
  assert.equal(result.discount, 1000)
  assert.equal(result.shipping, 500)
  assert.equal(result.total, 4500)
})

test('product-restricted coupon applies only to eligible subset', async () => {
  const tx = {
    cart: {
      findUnique: async () => ({
        id: 1,
        items: [
          makeItem({ id: 1, productId: 101, name: 'A', price: 2000, categoryId: 10, quantity: 1 }),
          makeItem({ id: 2, productId: 102, name: 'B', price: 3000, categoryId: 11, quantity: 1 }),
        ],
      }),
    },
    coupon: { findFirst: async () => makeCoupon({ code: 'ELIGIBLE20', value: 20, maxDiscount: null, couponProducts: [{ productId: 101 }], couponCategories: [] }) },
    couponProduct: { findMany: async () => [{ productId: 101 }] },
    couponCategory: { findMany: async () => [] },
    couponUsage: { count: async () => 0 },
  }

  const result = await calculateTotals(tx, makeReq({ body: { couponCode: 'eligible20' } }), 'eligible20')

  assert.equal(result.subtotal, 5000)
  assert.equal(result.eligibleSubtotal, 2000)
  assert.equal(result.discount, 400)
  assert.equal(result.shipping, 500)
  assert.equal(result.total, 5100)
})

test('user usage limit is enforced', async () => {
  const tx = {
    cart: {
      findUnique: async () => ({
        id: 1,
        items: [
          makeItem({ id: 1, productId: 101, name: 'A', price: 2000, categoryId: 10, quantity: 1 }),
        ],
      }),
    },
    coupon: { findFirst: async () => makeCoupon({ code: 'USERLIMIT10', value: 10, userUsageLimit: 1 }) },
    couponProduct: { findMany: async () => [] },
    couponCategory: { findMany: async () => [] },
    couponUsage: { count: async () => 1 },
  }

  await assert.rejects(
    () => calculateTotals(tx, makeReq({ body: { couponCode: 'userlimit10' } }), 'userlimit10'),
    /Coupon is invalid or not applicable/
  )
})

test('category-restricted coupon applies only to eligible category subtotal', async () => {
  const tx = {
    cart: {
      findUnique: async () => ({
        id: 1,
        items: [
          makeItem({ id: 1, productId: 101, name: 'A', price: 2000, categoryId: 10, quantity: 1 }),
          makeItem({ id: 2, productId: 102, name: 'B', price: 3000, categoryId: 11, quantity: 1 }),
        ],
      }),
    },
    coupon: { findFirst: async () => makeCoupon({ code: 'CAT20', value: 20, couponProducts: [], couponCategories: [{ categoryId: 10 }] }) },
    couponProduct: { findMany: async () => [] },
    couponCategory: { findMany: async () => [{ categoryId: 10 }] },
    couponUsage: { count: async () => 0 },
  }

  const result = await calculateTotals(tx, makeReq({ body: { couponCode: 'cat20' } }), 'cat20')

  assert.equal(result.subtotal, 5000)
  assert.equal(result.eligibleSubtotal, 2000)
  assert.equal(result.discount, 400)
})

test('fixed discount coupon applies the fixed amount', async () => {
  const tx = {
    cart: {
      findUnique: async () => ({
        id: 1,
        items: [
          makeItem({ id: 1, productId: 101, name: 'A', price: 5000, categoryId: 10, quantity: 1 }),
        ],
      }),
    },
    coupon: { findFirst: async () => makeCoupon({ code: 'FIXED500', discountType: 'FIXED', value: 500 }) },
    couponProduct: { findMany: async () => [] },
    couponCategory: { findMany: async () => [] },
    couponUsage: { count: async () => 0 },
  }

  const result = await calculateTotals(tx, makeReq({ body: { couponCode: 'fixed500' } }), 'fixed500')

  assert.equal(result.discount, 500)
  assert.equal(result.total, 5000)
})

test('maxDiscount caps the percentage discount', async () => {
  const tx = {
    cart: {
      findUnique: async () => ({
        id: 1,
        items: [
          makeItem({ id: 1, productId: 101, name: 'A', price: 10000, categoryId: 10, quantity: 1 }),
        ],
      }),
    },
    coupon: { findFirst: async () => makeCoupon({ code: 'MAXDISC20', value: 20, maxDiscount: 1000 }) },
    couponProduct: { findMany: async () => [] },
    couponCategory: { findMany: async () => [] },
    couponUsage: { count: async () => 0 },
  }

  const result = await calculateTotals(tx, makeReq({ body: { couponCode: 'maxdisc20' } }), 'maxdisc20')

  assert.equal(result.discount, 1000)
})

test('minOrderValue rejects coupons below threshold', async () => {
  const tx = {
    cart: {
      findUnique: async () => ({
        id: 1,
        items: [
          makeItem({ id: 1, productId: 101, name: 'A', price: 4999, categoryId: 10, quantity: 1 }),
        ],
      }),
    },
    coupon: { findFirst: async () => makeCoupon({ code: 'MIN5000', value: 10, minOrderValue: 5000 }) },
    couponProduct: { findMany: async () => [] },
    couponCategory: { findMany: async () => [] },
    couponUsage: { count: async () => 0 },
  }

  await assert.rejects(
    () => calculateTotals(tx, makeReq({ body: { couponCode: 'min5000' } }), 'min5000'),
    /Coupon is invalid or not applicable/
  )
})

test('maxOrderValue rejects coupons above the eligible threshold', async () => {
  const tx = {
    cart: {
      findUnique: async () => ({
        id: 1,
        items: [
          makeItem({ id: 1, productId: 101, name: 'A', price: 10001, categoryId: 10, quantity: 1 }),
        ],
      }),
    },
    coupon: { findFirst: async () => makeCoupon({ code: 'MAX10000', value: 10, maxOrderValue: 10000 }) },
    couponProduct: { findMany: async () => [] },
    couponCategory: { findMany: async () => [] },
    couponUsage: { count: async () => 0 },
  }

  await assert.rejects(
    () => calculateTotals(tx, makeReq({ body: { couponCode: 'max10000' } }), 'max10000'),
    /Coupon is invalid or not applicable/
  )
})

test('allowFreeShipping coupon sets shipping to zero', async () => {
  const tx = {
    cart: {
      findUnique: async () => ({
        id: 1,
        items: [
          makeItem({ id: 1, productId: 101, name: 'A', price: 5000, categoryId: 10, quantity: 1 }),
        ],
      }),
    },
    coupon: { findFirst: async () => makeCoupon({ code: 'FREESHIP', value: 10, allowFreeShipping: true }) },
    couponProduct: { findMany: async () => [] },
    couponCategory: { findMany: async () => [] },
    couponUsage: { count: async () => 0 },
  }

  const result = await calculateTotals(tx, makeReq({ body: { couponCode: 'freeship' } }), 'freeship')

  assert.equal(result.discount, 500)
  assert.equal(result.shipping, 0)
})

test('no coupon order snapshot keeps coupon fields null and zeroed', async () => {
  const tx = {
    cart: {
      findUnique: async () => ({
        id: 1,
        items: [
          makeItem({ id: 1, productId: 101, name: 'A', price: 5000, categoryId: 10, quantity: 1 }),
        ],
      }),
    },
    order: {
      findUnique: async () => null,
      create: async ({ data }) => {
        const order = { id: 99, ...data }
        return order
      },
    },
    product: { updateMany: async () => ({ count: 1 }) },
    productVariant: { updateMany: async () => ({ count: 1 }) },
    stockHistory: { create: async () => ({}) },
    cartItem: { deleteMany: async () => ({ count: 1 }) },
    coupon: { update: async () => ({}) },
    couponProduct: { findMany: async () => [] },
    couponCategory: { findMany: async () => [] },
    couponUsage: { create: async () => ({ id: 1 }), count: async () => 0 },
  }

  let createdData
  const originalOrderCreate = tx.order.create
  tx.order.create = async ({ data }) => {
    createdData = data
    return { id: 99, ...data }
  }

  const result = await finalizeOrderFromCart(tx, makeReq({ body: { shippingAddress: { line1: '1 Main' } } }), { idempotencyKey: 'snapshot-key' })

  assert.equal(result.order.couponId, null)
  assert.equal(result.order.couponCode, null)
  assert.equal(result.order.discountAmount, 0)
  assert.equal(result.order.subtotalBeforeDiscount, 5000)
  assert.equal(result.order.shippingCost, 500)
  assert.equal(createdData.couponId, null)
  assert.equal(createdData.couponCode, null)
  assert.equal(createdData.discountAmount, 0)
  assert.equal(createdData.subtotalBeforeDiscount, 5000)
  assert.equal(createdData.shippingCost, 500)
  tx.order.create = originalOrderCreate
})

test('used coupon cannot be deleted', async () => {
  const originalCoupon = prisma.coupon
  const originalCouponUsage = prisma.couponUsage
  let deleted = false
  prisma.coupon = {
    findFirst: async () => ({ id: 12, code: 'USED', usageCount: 2, usages: [{ id: 1 }], storeId: 7 }),
    delete: async () => {
      deleted = true
      return { id: 12 }
    },
  }
  prisma.couponUsage = { findFirst: async () => ({ id: 1 }) }

  const req = makeReq({ params: { id: '12' } })
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
  let nextError = null
  try {
    await deleteAdminCoupon(req, res, (error) => {
      nextError = error
    })
    assert.fail('expected coupon delete to be rejected')
  } catch (error) {
    assert.ok(error)
  }

  assert.equal(deleted, false)
  assert.equal(res.statusCode, 409)
  assert.match(String(nextError?.message || ''), /This coupon has usage history and cannot be deleted. Deactivate it instead./)

  prisma.coupon = originalCoupon
  prisma.couponUsage = originalCouponUsage
})

test('unused coupon can still be deleted', async () => {
  const originalCoupon = prisma.coupon
  let deleted = false
  prisma.coupon = {
    findFirst: async () => ({ id: 13, code: 'UNUSED', usageCount: 0, usages: [], storeId: 7 }),
    delete: async () => {
      deleted = true
      return { id: 13 }
    },
  }

  const req = makeReq({ params: { id: '13' } })
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }

  await deleteAdminCoupon(req, res, () => {})

  assert.equal(deleted, true)
  assert.deepEqual(res.body, { message: 'Coupon deleted successfully' })

  prisma.coupon = originalCoupon
})
