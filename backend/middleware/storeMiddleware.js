import prisma from '../lib/prisma.js'

export const DEFAULT_STORE_SLUG = String(process.env.DEFAULT_STORE_SLUG || 'haston').trim().toLowerCase()

const ALL_WEBSITES_SENTINELS = new Set(['all', 'all-websites', 'all-websites-context'])
const PARENT_TENANT_SLUG = 'house-of-valerion'
const PARENT_CONTEXT_SLUG = 'house-of-valerion'

const loadParentContext = async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: PARENT_TENANT_SLUG },
    include: { stores: true },
  })
  if (!tenant || tenant.status !== 'ACTIVE') return null

  const childStores = tenant.stores.filter((store) => store.status === 'ACTIVE' && store.slug !== PARENT_CONTEXT_SLUG)
  return { tenant, childStores }
}

export const resolveStore = async (req, res, next) => {
  try {
    const headerSlug = req.get('x-store-slug')?.trim().toLowerCase() || null
    const querySlug = typeof req.query.store === 'string' ? req.query.store.trim().toLowerCase() : null
    if (headerSlug && querySlug && headerSlug !== querySlug) {
      res.status(400)
      throw new Error('Conflicting store selectors')
    }

    const requestedSlug = headerSlug || querySlug || DEFAULT_STORE_SLUG
    if (ALL_WEBSITES_SENTINELS.has(requestedSlug)) {
      const parent = await loadParentContext()
      if (!parent) {
        res.status(404)
        throw new Error('Parent tenant not found')
      }
      req.store = null
      req.tenant = parent.tenant
      req.childStoreIds = parent.childStores.map((store) => store.id)
      req.contextType = 'PARENT'
      req.storeContext = 'ALL_STORES'
      return next()
    }

    if (requestedSlug === PARENT_CONTEXT_SLUG) {
      const parent = await loadParentContext()
      if (!parent) {
        res.status(404)
        throw new Error('Parent tenant not found')
      }
      req.store = null
      req.tenant = parent.tenant
      req.childStoreIds = parent.childStores.map((store) => store.id)
      req.contextType = 'PARENT'
      req.storeContext = 'PARENT'
      return next()
    }

    const store = await prisma.store.findUnique({
      where: { slug: requestedSlug },
      include: { tenant: true },
    })

    if (!store || store.status !== 'ACTIVE' || store.tenant.status !== 'ACTIVE') {
      res.status(404)
      throw new Error('Store not found')
    }

    req.store = store
    req.tenant = store.tenant
    req.childStoreIds = []
    req.contextType = 'STORE'
    req.storeContext = 'STORE'
    next()
  } catch (error) {
    next(error)
  }
}

export const storeWhere = (req, where = {}) => {
  if (req.contextType === 'PARENT' || req.storeContext === 'ALL_STORES') {
    return { ...where, storeId: { in: req.childStoreIds || [] } }
  }
  return { ...where, storeId: req.store.id }
}

export const requireConcreteStore = (req, res, next) => {
  if (!req.store || req.contextType !== 'STORE') {
    res.status(409)
    return next(new Error('This operation requires a concrete ecommerce store context'))
  }
  next()
}
