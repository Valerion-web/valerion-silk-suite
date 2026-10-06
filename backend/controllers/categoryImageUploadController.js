import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const imageFormats = [
  {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    extension: 'png',
    matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: 'image/webp',
    extension: 'webp',
    matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    mimeType: 'image/gif',
    extension: 'gif',
    matches: (buffer) => buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6)),
  },
]

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const isSupportedImage = imageFormats.some((format) => format.mimeType === file.mimetype)
    callback(isSupportedImage ? null : new Error('Upload a JPEG, PNG, WebP, or GIF image'), isSupportedImage)
  },
}).single('image')

export const uploadAdminCategoryImage = (req, res, next) => {
  upload(req, res, async (uploadError) => {
    if (uploadError) {
      const isFileTooLarge = uploadError.code === 'LIMIT_FILE_SIZE'
      return res.status(isFileTooLarge ? 413 : 400).json({
        message: isFileTooLarge ? 'Image exceeds the 10 MB limit' : uploadError.message,
      })
    }
    if (!req.file) return res.status(400).json({ message: 'An image file is required' })

    const imageFormat = imageFormats.find((format) => format.mimeType === req.file.mimetype && format.matches(req.file.buffer))
    if (!imageFormat) return res.status(400).json({ message: 'The uploaded file is not a supported image' })

    const filename = `${crypto.randomUUID()}.${imageFormat.extension}`
    const uploadDirectory = path.resolve(__dirname, '../uploads', 'categories')
    const imagePath = path.join(uploadDirectory, filename)
    const url = `/uploads/categories/${filename}`

    try {
      await fs.mkdir(uploadDirectory, { recursive: true })
      await fs.writeFile(imagePath, req.file.buffer, { flag: 'wx' })
      return res.status(201).json({ url })
    } catch (error) {
      return next(error)
    }
  })
}