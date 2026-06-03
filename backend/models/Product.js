import mongoose from 'mongoose'

const productSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    slug: {
      type: String,
      required: true,
      unique: true
    },
    description: {
      type: String,
      required: true
    },
    brand: {
      type: String
    },
    category: {
      type: String
    },
    price: {
      type: Number,
      required: true,
      default: 0
    },
    countInStock: {
      type: Number,
      required: true,
      default: 0
    },
    images: [
      {
        type: String
      }
    ]
  },
  {
    timestamps: true
  }
)

const Product = mongoose.model('Product', productSchema)
export default Product
