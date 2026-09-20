import express from 'express'
import { getProducts, getProductById, getProductBySlug, createProduct } from '../controllers/productController.js'
import { getCategories, getCategoryBySlug, getBrands, getBrandBySlug } from '../controllers/catalogController.js'
import { protect, requireAdmin } from '../middleware/authMiddleware.js'
import { requireConcreteStore } from '../middleware/storeMiddleware.js'

const router = express.Router()

router.route('/').get(getProducts).post(protect, requireAdmin, requireConcreteStore, createProduct)
router.get('/slug/:slug', getProductBySlug)
router.route('/:id').get(getProductById)

export const categoryRouter = express.Router()
categoryRouter.get('/', getCategories)
categoryRouter.get('/:slug', getCategoryBySlug)

export const brandRouter = express.Router()
brandRouter.get('/', getBrands)
brandRouter.get('/:slug', getBrandBySlug)

export default router
