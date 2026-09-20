import prisma from '../lib/prisma.js'

export const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'BRAND_MANAGER',
  'INVENTORY_MANAGER',
  'ORDER_MANAGER',
  'MARKETING_MANAGER',
])

export const resolveAdminContext = async (req, user) => {
  if (!ADMIN_ROLES.has(user.role)) return null

  const assignmentWhere = req.store
    ? {
        userId: user.id,
        role: user.role,
        isActive: true,
        OR: [{ storeId: req.store.id }, { storeId: null }],
      }
    : {
        userId: user.id,
        role: user.role,
        isActive: true,
        storeId: null,
      }

  const assignments = await prisma.adminAssignment.findMany({
    where: assignmentWhere,
    include: {
      store: { include: { tenant: true } },
      brand: true,
    },
    orderBy: { storeId: 'asc' },
  })

  const globalAssignment = assignments.find((assignment) => assignment.storeId === null)
  const storeAssignment = req.store ? assignments.find((assignment) => assignment.storeId === req.store.id) : null
  const assignment = user.role === 'SUPER_ADMIN' ? globalAssignment || storeAssignment : storeAssignment

  if (!assignment) return null
  if (req.store && assignment.store && (assignment.store.status !== 'ACTIVE' || assignment.store.tenant.status !== 'ACTIVE')) return null
  if (req.store && assignment.brand && (assignment.brand.storeId !== req.store.id || assignment.brand.status !== 'ACTIVE')) return null

  return {
    userId: user.id,
    role: assignment.role,
    assignmentId: assignment.id,
    storeId: req.store ? req.store.id : null,
    brandId: assignment.brandId || null,
    contextType: req.contextType || (req.store ? 'STORE' : 'ALL_STORES'),
    accessScope: req.store ? 'STORE' : 'ALL_STORES',
  }
}
