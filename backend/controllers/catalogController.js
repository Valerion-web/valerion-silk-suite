import prisma from '../lib/prisma.js'

const parseList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : value.split(',').map((item) => item.trim()).filter(Boolean)
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
}

const formatProduct = (product) => {
  const images = product.imagesList?.length
    ? product.imagesList.sort((a, b) => a.sortOrder - b.sortOrder).map((image) => image.url)
    : parseList(product.images)

  return {
    ...product,
    price: Number(product.price),
    images,
    image: images[0] || null,
    hoverImage: product.hoverImage || images[1] || images[0] || null,
    tags: parseList(product.tags),
    keywords: parseList(product.keywords),
    sizes: parseList(product.size),
    colors: parseList(product.color),
    brand: product.brandRelation || (product.brand ? { name: product.brand, slug: null } : null),
    category: product.category || null,
    variants: (product.variants || []).map((variant) => ({
      ...variant,
      priceOverride: variant.priceOverride == null ? null : Number(variant.priceOverride),
    })),
  }
}

const productInclude = {
  category: true,
  brandRelation: true,
  imagesList: true,
  variants: true,
}

const isConcreteStoreContext = (req) => Boolean(req.store && req.contextType === 'STORE')

const productWhere = (req) => {
  const where = { storeId: req.store.id, status: 'ACTIVE' }
  const { category, brand, search, q, minPrice, maxPrice } = req.query || {}
  const searchTerm = String(search || q || '').trim()

  if (category) where.category = { slug: String(category).trim().toLowerCase(), storeId: req.store.id }
  if (brand) where.brandRelation = { slug: String(brand).trim().toLowerCase(), storeId: req.store.id }
  if (searchTerm) {
    where.OR = [
      { name: { contains: searchTerm, mode: 'insensitive' } },
      { description: { contains: searchTerm, mode: 'insensitive' } },
      { shortDescription: { contains: searchTerm, mode: 'insensitive' } },
      { tags: { contains: searchTerm, mode: 'insensitive' } },
    ]
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {}
    if (minPrice !== undefined && !Number.isNaN(Number(minPrice))) where.price.gte = Number(minPrice)
    if (maxPrice !== undefined && !Number.isNaN(Number(maxPrice))) where.price.lte = Number(maxPrice)
  }
  return where
}

export const getProducts = async (req, res, next) => {
  try {
    if (!isConcreteStoreContext(req)) return res.json([])
    const products = await prisma.product.findMany({ where: productWhere(req), include: productInclude, orderBy: { id: 'asc' } })
    res.json(products.map(formatProduct))
  } catch (error) {
    next(error)
  }
}

export const getProductById = async (req, res, next) => {
  try {
    if (!isConcreteStoreContext(req)) {
      res.status(404)
      throw new Error('Product not found')
    }
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      res.status(400)
      throw new Error('Invalid product ID')
    }
    const product = await prisma.product.findFirst({ where: { id, storeId: req.store.id, status: 'ACTIVE' }, include: productInclude })
    if (!product) {
      res.status(404)
      throw new Error('Product not found')
    }
    res.json(formatProduct(product))
  } catch (error) {
    next(error)
  }
}

export const getProductBySlug = async (req, res, next) => {
  try {
    if (!isConcreteStoreContext(req)) {
      res.status(404)
      throw new Error('Product not found')
    }
    const product = await prisma.product.findFirst({ where: { slug: req.params.slug, storeId: req.store.id, status: 'ACTIVE' }, include: productInclude })
    if (!product) {
      res.status(404)
      throw new Error('Product not found')
    }
    res.json(formatProduct(product))
  } catch (error) {
    next(error)
  }
}

export const getCategories = async (req, res, next) => {
  try {
    if (!isConcreteStoreContext(req)) return res.json([])
    const categories = await prisma.category.findMany({
      where: { storeId: req.store.id },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    })
    res.json(categories.map((category) => ({ ...category, productCount: category._count.products })))
  } catch (error) {
    next(error)
  }
}

export const getCategoryBySlug = async (req, res, next) => {
  try {
    if (!isConcreteStoreContext(req)) {
      res.status(404)
      throw new Error('Category not found')
    }
    const category = await prisma.category.findFirst({
      where: { slug: req.params.slug, storeId: req.store.id },
      include: { products: { where: { storeId: req.store.id, status: 'ACTIVE' }, include: productInclude, orderBy: { id: 'asc' } } },
    })
    if (!category) {
      res.status(404)
      throw new Error('Category not found')
    }
    res.json({ ...category, products: category.products.map(formatProduct) })
  } catch (error) {
    next(error)
  }
}

export const getBrands = async (req, res, next) => {
  try {
    if (!isConcreteStoreContext(req)) return res.json([])
    const brands = await prisma.brand.findMany({ where: { storeId: req.store.id, status: 'ACTIVE' }, orderBy: { name: 'asc' } })
    res.json(brands)
  } catch (error) {
    next(error)
  }
}

export const getBrandBySlug = async (req, res, next) => {
  try {
    if (!isConcreteStoreContext(req)) {
      res.status(404)
      throw new Error('Brand not found')
    }
    const brand = await prisma.brand.findFirst({
      where: { slug: req.params.slug, storeId: req.store.id, status: 'ACTIVE' },
      include: { products: { where: { storeId: req.store.id, status: 'ACTIVE' }, include: productInclude, orderBy: { id: 'asc' } } },
    })
    if (!brand) {
      res.status(404)
      throw new Error('Brand not found')
    }
    res.json({ ...brand, products: brand.products.map(formatProduct) })
  } catch (error) {
    next(error)
  }
}

export { formatProduct, productInclude }
