import prisma from '../lib/prisma.js'
import { Prisma } from '@prisma/client'
import { generateSlug } from '../utils/generateSlug.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// Ensure product response always has images as array
const formatProduct = (product) => ({
  ...product,
  images: Array.isArray(product.images) ? product.images : [],
  price: typeof product.price === 'string'
    ? parseFloat(product.price)
    : (product.price && typeof product.price.toNumber === 'function')
      ? product.price.toNumber()
      : product.price,
})

const loadMockProducts = async () => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const candidates = [
    path.resolve(process.cwd(), 'backend', 'mock', 'products.json'),
    path.resolve(process.cwd(), 'mock', 'products.json'),
    path.join(__dirname, '..', 'mock', 'products.json'),
  ]

  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, 'utf8')
      return JSON.parse(raw)
    } catch (e) {
      // try next
    }
  }
  throw new Error('Mock products file not found in candidates: ' + JSON.stringify(candidates))
}

export const getProducts = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: 'asc' },
      include: { category: true },
    })

    const withoutImages = products.filter(p => !p.images || p.images.length === 0)
    if (withoutImages.length > 0) {
      console.warn(`⚠️  ${withoutImages.length} products without images. Run seed script to populate.`)
    }

    return res.json(products.map(formatProduct))
  } catch (error) {
    console.error('Product listing DB error:', error && error.stack ? error.stack : error)
    try {
      const products = await loadMockProducts()
      return res.json(products)
    } catch (fsErr) {
      console.error('Failed to load mock products:', fsErr)
      return next(error)
    }
  }
}

export const getProductById = async (req, res, next) => {
  try {
    const productId = Number(req.params.id)
    if (Number.isNaN(productId)) {
      res.status(400)
      throw new Error('Invalid product ID')
    }
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    })

    if (product) {
      return res.json(formatProduct(product))
    }

    res.status(404)
    throw new Error('Product not found')
  } catch (error) {
    console.error('Product fetch DB error:', error && error.stack ? error.stack : error)
    try {
      const products = await loadMockProducts()
      const productId = Number(req.params.id)
      const product = products.find(p => p.id === productId)
      if (!product) {
        res.status(404)
        throw new Error('Product not found (mock)')
      }
      return res.json(product)
    } catch (fsErr) {
      console.error('Failed to load mock product:', fsErr)
      return next(error)
    }
  }
}

export const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, countInStock, brand, categoryId, images } = req.body

    const createdProduct = await prisma.product.create({
      data: {
        name,
        slug: generateSlug(name),
        description,
        brand,
        price: new Prisma.Decimal(price),
        countInStock,
        images: images || [],
        category: categoryId ? { connect: { id: Number(categoryId) } } : undefined,
      },
    })

    res.status(201).json(createdProduct)
  } catch (error) {
    next(error)
  }
}
