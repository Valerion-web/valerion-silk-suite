import express from 'express'
import { protect } from '../middleware/authMiddleware.js'
import { requireConcreteStore } from '../middleware/storeMiddleware.js'
import {
  getCouponSuggestions,
  getCart,
  getAddresses,
  createAddress,
  setAddressDefault,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  validateCheckout,
  getCodEligibility,
  createCodOrder,
  createOrder,
  getOrders,
  getOrder,
  getOrderTracking,
} from '../controllers/customerCommerceController.js'

const router = express.Router()
router.use(protect)

const requireCustomer = (req, res, next) => {
  if (req.user?.role !== 'CUSTOMER') {
    return res.status(403).json({ message: 'Customer access required' })
  }
  next()
}

router.get('/coupons/suggestions', requireCustomer, requireConcreteStore, getCouponSuggestions)

router.get('/addresses', requireConcreteStore, getAddresses)
router.post('/addresses', requireConcreteStore, createAddress)
router.put('/addresses/:id/default', requireConcreteStore, setAddressDefault)

router.get('/cart', requireConcreteStore, getCart)
router.post('/cart/items', requireConcreteStore, addCartItem)
router.patch('/cart/items/:id', requireConcreteStore, updateCartItem)
router.delete('/cart/items/:id', requireConcreteStore, removeCartItem)
router.delete('/cart', requireConcreteStore, clearCart)

router.get('/wishlist', requireConcreteStore, getWishlist)
router.post('/wishlist/items', requireConcreteStore, addWishlistItem)
router.delete('/wishlist/items/:productId', requireConcreteStore, removeWishlistItem)

router.post('/checkout/validate', requireConcreteStore, validateCheckout)
router.post('/checkout/cod/eligibility', requireConcreteStore, getCodEligibility)
router.post('/checkout/cod', requireConcreteStore, createCodOrder)
router.post('/checkout', requireConcreteStore, createOrder)
router.post('/orders', requireConcreteStore, createOrder)
router.get('/orders', requireConcreteStore, getOrders)
router.get('/orders/:id/tracking', requireConcreteStore, getOrderTracking)
router.get('/orders/:id', requireConcreteStore, getOrder)

export default router
