import Product from '../models/Product.js'
import { generateSlug } from '../utils/generateSlug.js'

export const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find({})
    res.json(products)
  } catch (error) {
    next(error)
  }
}

export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      res.status(404)
      throw new Error('Product not found')
    }

    res.json(product)
  } catch (error) {
    next(error)
  }
}

export const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, countInStock, brand, category, images } = req.body

    const product = new Product({
      name,
      slug: generateSlug(name),
      description,
      brand,
      category,
      price,
      countInStock,
      images: images || []
    })

    const createdProduct = await product.save()
    res.status(201).json(createdProduct)
  } catch (error) {
    next(error)
  }
}
