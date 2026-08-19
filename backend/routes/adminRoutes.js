import express from 'express'
import { protect, requireAdmin } from '../middleware/authMiddleware.js'
import {
  getAdminDashboard,
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
router.get('/dashboard', getAdminDashboard)
router.route('/products').get(getAdminProducts).post(createAdminProduct)
router.route('/products/:id').get(getAdminProductById).put(updateAdminProduct).delete(deleteAdminProduct)
router.route('/orders').get(getAdminOrders)
router.patch('/orders/:id/status', updateAdminOrderStatus)
router.route('/orders/:id').delete(deleteAdminOrder)
router.get('/inventory', getAdminInventory)
router.get('/inventory/low-stock', getLowStockInventory)
router.patch('/inventory/:id', updateAdminInventory)
router.get('/inventory/:id/history', getAdminInventoryHistory)
router.get('/sales-reports', getSalesReports)
router.get('/export/:resource', exportAdminReport)
router.route('/categories').get(getAdminCategories).post(createAdminCategory)
router.route('/categories/:id').put(updateAdminCategory).delete(deleteAdminCategory)
router.route('/brands').get(getAdminBrands).post(createAdminBrand)
router.route('/brands/:id').put(updateAdminBrand).delete(deleteAdminBrand)
router.route('/users').get(getAdminUsers)
router.route('/users/:id').put(updateAdminUser).delete(deleteAdminUser)
router.route('/coupons').get(getAdminCoupons).post(createAdminCoupon)
router.route('/coupons/:id').put(updateAdminCoupon).delete(deleteAdminCoupon)
router.route('/reviews').get(getAdminReviews)
router.patch('/reviews/:id/approve', updateAdminReview)
router.patch('/reviews/:id/reject', updateAdminReview)
router.route('/reviews/:id').delete(deleteAdminReview)
router.route('/settings').get(getAdminSettings).put(updateAdminSettings)
router.get('/orders/:id', getAdminOrderById)

export default router
