import express from 'express'
import { protect, requireAdmin, requireCapability, requireSuperAdmin } from '../middleware/authMiddleware.js'
import { requireConcreteStore } from '../middleware/storeMiddleware.js'
import {
  getAdminDashboard,
  getAdminAnalytics,
  getAdminStores,
  getRecentOrders,
  getAdminProducts,
  getAdminProductById,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  getAdminOrders,
  updateAdminOrderStatus,
  deleteAdminOrder,
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  getAdminBrands,
  createAdminBrand,
  updateAdminBrand,
  deleteAdminBrand,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  getAdminReviews,
  updateAdminReview,
  deleteAdminReview,
  getAdminSettings,
  updateAdminSettings,
  getAdminInventory,
  updateAdminInventory,
  getLowStockInventory,
  getSalesReports,
  exportAdminReport,
  getAdminInventoryHistory,
  getAdminOrderById,
} from '../controllers/adminController.js'

const router = express.Router()

router.use(protect, requireAdmin)
router.get('/dashboard', requireCapability('analytics'), getAdminDashboard)
router.get('/analytics', requireCapability('analytics'), getAdminAnalytics)
router.get('/stores', requireCapability('analytics'), getAdminStores)
router.get('/recent-orders', requireCapability('orders'), getRecentOrders)
router.route('/products').get(requireCapability('products'), getAdminProducts).post(requireCapability('products'), requireConcreteStore, createAdminProduct)
router.route('/products/:id').get(requireCapability('products'), getAdminProductById).put(requireCapability('products'), requireConcreteStore, updateAdminProduct).delete(requireCapability('products'), requireConcreteStore, deleteAdminProduct)
router.route('/orders').get(requireCapability('orders'), getAdminOrders)
router.patch('/orders/:id/status', requireCapability('orders'), requireConcreteStore, updateAdminOrderStatus)
router.route('/orders/:id').delete(requireCapability('orders'), requireConcreteStore, deleteAdminOrder)
router.get('/inventory', requireCapability('inventory'), getAdminInventory)
router.get('/inventory/low-stock', requireCapability('inventory'), getLowStockInventory)
router.patch('/inventory/:id', requireCapability('inventory'), requireConcreteStore, updateAdminInventory)
router.get('/inventory/:id/history', requireCapability('inventory'), getAdminInventoryHistory)
router.get('/sales-reports', requireCapability('analytics'), getSalesReports)
router.get('/export/:resource', requireCapability('analytics'), exportAdminReport)
router.route('/categories').get(requireCapability('catalog'), getAdminCategories).post(requireCapability('catalog'), requireConcreteStore, createAdminCategory)
router.route('/categories/:id').put(requireCapability('catalog'), requireConcreteStore, updateAdminCategory).delete(requireCapability('catalog'), requireConcreteStore, deleteAdminCategory)
router.route('/brands').get(requireCapability('catalog'), getAdminBrands).post(requireCapability('catalog'), requireConcreteStore, createAdminBrand)
router.route('/brands/:id').put(requireCapability('catalog'), requireConcreteStore, updateAdminBrand).delete(requireCapability('catalog'), requireConcreteStore, deleteAdminBrand)
router.route('/users').get(requireCapability('users'), getAdminUsers)
router.post('/users', requireSuperAdmin, requireConcreteStore, createAdminUser)
router.route('/users/:id').put(requireSuperAdmin, requireConcreteStore, updateAdminUser).delete(requireSuperAdmin, requireConcreteStore, deleteAdminUser)
router.route('/coupons').get(requireCapability('marketing'), getAdminCoupons).post(requireCapability('marketing'), requireConcreteStore, createAdminCoupon)
router.route('/coupons/:id').put(requireCapability('marketing'), requireConcreteStore, updateAdminCoupon).delete(requireCapability('marketing'), requireConcreteStore, deleteAdminCoupon)
router.route('/reviews').get(requireCapability('marketing'), getAdminReviews)
router.patch('/reviews/:id/approve', requireCapability('marketing'), requireConcreteStore, updateAdminReview)
router.patch('/reviews/:id/reject', requireCapability('marketing'), requireConcreteStore, updateAdminReview)
router.route('/reviews/:id').delete(requireCapability('marketing'), requireConcreteStore, deleteAdminReview)
router.route('/settings').get(requireCapability('users'), getAdminSettings).put(requireSuperAdmin, updateAdminSettings)
router.get('/orders/:id', requireCapability('orders'), getAdminOrderById)

export default router
