import express from 'express'
import { protect } from '../middleware/authMiddleware.js'
import { requireConcreteStore } from '../middleware/storeMiddleware.js'
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  validateCheckout,
  createOrder,
  getOrders,
  getOrder,
  getOrderTracking,
} from '../controllers/customerCommerceController.js'

const router = express.Router()
router.use(protect)

router.get('/cart', requireConcreteStore, getCart)
router.post('/cart/items', requireConcreteStore, addCartItem)
router.patch('/cart/items/:id', requireConcreteStore, updateCartItem)
router.delete('/cart/items/:id', requireConcreteStore, removeCartItem)
router.delete('/cart', requireConcreteStore, clearCart)

router.get('/wishlist', requireConcreteStore, getWishlist)
router.post('/wishlist/items', requireConcreteStore, addWishlistItem)
router.delete('/wishlist/items/:productId', requireConcreteStore, removeWishlistItem)

router.post('/checkout/validate', requireConcreteStore, validateCheckout)
router.post('/checkout', requireConcreteStore, createOrder)
router.post('/orders', requireConcreteStore, createOrder)
router.get('/orders', requireConcreteStore, getOrders)
router.get('/orders/:id/tracking', requireConcreteStore, getOrderTracking)
router.get('/orders/:id', requireConcreteStore, getOrder)

export default router
