import prisma from '../lib/prisma.js'
import { generateSlug } from '../utils/generateSlug.js'
export { getProducts, getProductById, getProductBySlug } from './catalogController.js'

export const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, countInStock, brand, brandId, categoryId, images, hoverImage } = req.body || {}
    if (!name || price === undefined) {
      res.status(400)
      throw new Error('Name and price are required')
    }

    let category
    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
      category = await prisma.category.findFirst({ where: { id: Number(categoryId), storeId: req.store.id } })
      if (!category) {
        res.status(400)
        throw new Error('Category does not belong to the selected store')
      }
    }

    let selectedBrand = null
    if (brandId !== undefined && brandId !== null && brandId !== '') {
      selectedBrand = await prisma.brand.findFirst({ where: { id: Number(brandId), storeId: req.store.id } })
      if (!selectedBrand) {
        res.status(400)
        throw new Error('Brand does not belong to the selected store')
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug: generateSlug(name),
        description,
        brand: selectedBrand?.name || brand || null,
        brandId: selectedBrand?.id || null,
        price: Number(price),
        countInStock: Math.max(0, Number(countInStock || 0)),
        images: Array.isArray(images) ? images.join(',') : images || null,
        hoverImage: hoverImage || null,
        storeId: req.store.id,
        categoryId: category?.id || null,
      },
      include: { category: true, brandRelation: true, imagesList: true, variants: true },
    })

    res.status(201).json(product)
  } catch (error) {
    next(error)
  }
}
