import fs from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import crypto from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { parse } from 'csv-parse'
import { readSheet } from 'read-excel-file/node'
import yauzl from 'yauzl'
import prisma from '../lib/prisma.js'

const IMAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const REQUIRED = ['name', 'sku', 'slug', 'price', 'countInStock', 'category', 'brand']
const NUMERIC = ['price', 'discountPercent', 'tax', 'countInStock', 'lowStockAlert']
const STATUSES = new Set(['ACTIVE', 'DRAFT', 'ARCHIVED'])
const AVAILABILITIES = new Set(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'])
const XLSX_FORMULA_WARNING = 'XLSX formula metadata is unavailable: formulas are not evaluated, but cached results cannot be distinguished from literal values.'
const FIELDS = [
  'name', 'sku', 'slug', 'shortDescription', 'fullDescription', 'description', 'price', 'discountPercent', 'tax',
  'countInStock', 'lowStockAlert', 'availability', 'warehouse', 'category', 'brand', 'collection', 'tags', 'size',
  'color', 'material', 'status', 'metaTitle', 'metaDescription', 'keywords', 'images',
]
const ALIASES = {
  productname: 'name', productsku: 'sku', categoryname: 'category', brandname: 'brand',
  countinstock: 'countInStock', lowstockalert: 'lowStockAlert', discountpercent: 'discountPercent',
  fulldescription: 'fullDescription', shortdescription: 'shortDescription', metatitle: 'metaTitle',
  metadescription: 'metaDescription',
}

export const BULK_IMPORT_LIMITS = Object.freeze({
  productFileBytes: 20 * 1024 * 1024,
  zipFileBytes: 100 * 1024 * 1024,
  archiveEntries: 510,
  imageCount: 500,
  imageBytes: 10 * 1024 * 1024,
  expandedBytes: 250 * 1024 * 1024,
  compressionRatio: 200,
})

export class BulkImportInputError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'BulkImportInputError'
    this.statusCode = statusCode
  }
}

const text = (value) => String(value ?? '').trim()
const normalized = (value) => text(value).toLocaleLowerCase('en-US')
const headerKey = (value) => text(value).replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const headerName = (value) => {
  const key = headerKey(value)
  return ALIASES[key] || FIELDS.find((field) => headerKey(field) === key) || key
}

const indexNames = (records) => {
  const index = new Map()
  for (const record of records) {
    const key = normalized(record.name)
    if (key) index.set(key, [...(index.get(key) || []), record])
  }
  return index
}

const resolveName = (index, value, label, errors) => {
  const matches = index.get(normalized(value)) || []
  if (matches.length === 0) {
    errors.push(`${label} name was not found`)
    return null
  }
  if (matches.length > 1) {
    errors.push(`${label} name is ambiguous in this store`)
    return null
  }
  return matches[0]
}

const parseCsvRows = async (filePath) => {
  const rows = []
  try {
    const parser = createReadStream(filePath).pipe(parse({ bom: true, skip_empty_lines: false, relax_column_count: true }))
    for await (const record of parser) rows.push(record)
  } catch {
    throw new BulkImportInputError('Product CSV file is invalid or could not be read')
  }
  return rows
}

const parseSpreadsheet = async (filePath) => {
  const extension = path.extname(filePath).toLowerCase()
  let matrix
  let warnings = []
  if (extension === '.csv') {
    matrix = await parseCsvRows(filePath)
  } else {
    try {
      matrix = await readSheet(filePath)
    } catch {
      throw new BulkImportInputError('Product XLSX file is invalid or could not be read')
    }
    warnings = [XLSX_FORMULA_WARNING]
  }
  if (!matrix.length) throw new BulkImportInputError('Product data file is empty')
  const headers = matrix[0].map(headerName)
  const rows = matrix.slice(1)
    .map((cells, index) => ({ cells, rowNumber: index + 2 }))
    .filter(({ cells }) => cells.some((cell) => text(cell)))
    .map(({ cells, rowNumber }) => {
      const errors = []
      const values = Object.fromEntries(FIELDS.map((field) => {
        const column = headers.findIndex((header) => header === field)
        const cell = column < 0 ? null : cells[column]
        if (NUMERIC.includes(field) && cell instanceof Date) errors.push(`${field} contains a date; enter a literal number`)
        return [field, text(cell)]
      }))
      return { rowNumber, values, errors, warnings: [...warnings] }
    })
  return rows
}

const safeZipBaseName = (fileName) => {
  const validationError = yauzl.validateFileName(fileName)
  if (validationError) throw new BulkImportInputError('ZIP contains an unsafe entry path')
  if (fileName.includes('\\') || fileName.startsWith('/') || path.win32.isAbsolute(fileName) || /^[A-Za-z]:/.test(fileName)) {
    throw new BulkImportInputError('ZIP contains an absolute or invalid entry path')
  }
  if (fileName.split('/').some((segment) => segment === '..' || segment === '.')) {
    throw new BulkImportInputError('ZIP contains a path traversal entry')
  }
  const baseName = path.posix.basename(fileName)
  if (!baseName || baseName === '.' || baseName === '..') throw new BulkImportInputError('ZIP contains an invalid filename')
  return baseName
}

const extractImagesZip = async (zipPath, outputDirectory) => {
  const stat = await fs.stat(zipPath)
  if (stat.size <= 0) throw new BulkImportInputError('Images ZIP is empty')
  if (stat.size > BULK_IMPORT_LIMITS.zipFileBytes) throw new BulkImportInputError('Images ZIP exceeds the 100 MB limit', 413)

  let zip
  try {
    zip = await yauzl.openPromise(zipPath, { decodeStrings: true, strictFileNames: true, validateEntrySizes: true })
  } catch {
    throw new BulkImportInputError('Images ZIP is invalid or could not be opened')
  }
  if (zip.entryCount > BULK_IMPORT_LIMITS.archiveEntries) {
    zip.close()
    throw new BulkImportInputError('Images ZIP contains too many entries')
  }

  await fs.mkdir(outputDirectory, { recursive: true })
  const names = new Set()
  const paths = new Set()
  const extracted = new Map()
  let imageCount = 0
  let totalExpanded = 0

  try {
    for await (const entry of zip.eachEntry()) {
      const baseName = safeZipBaseName(entry.fileName)
      const isDirectory = entry.fileName.endsWith('/')
      const normalizedPath = entry.fileName.toLocaleLowerCase('en-US')
      if (paths.has(normalizedPath)) throw new BulkImportInputError(`ZIP contains a duplicate archive entry: ${entry.fileName}`)
      paths.add(normalizedPath)
      if (isDirectory) continue

      const extension = path.posix.extname(baseName).toLowerCase()
      if (!IMAGE_EXTENSIONS.has(extension)) {
        throw new BulkImportInputError(`ZIP contains an unsupported image extension: ${entry.fileName}`)
      }
      const nameKey = baseName.toLocaleLowerCase('en-US')
      if (names.has(nameKey)) throw new BulkImportInputError(`ZIP contains duplicate image filenames: ${baseName}`)
      names.add(nameKey)

      imageCount += 1
      if (imageCount > BULK_IMPORT_LIMITS.imageCount) throw new BulkImportInputError('ZIP exceeds the 500 image limit')
      if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize <= 0 || entry.uncompressedSize > BULK_IMPORT_LIMITS.imageBytes) {
        throw new BulkImportInputError(`Image ${baseName} is empty or exceeds the 10 MB per-image limit`)
      }
      totalExpanded += entry.uncompressedSize
      if (totalExpanded > BULK_IMPORT_LIMITS.expandedBytes) throw new BulkImportInputError('ZIP exceeds the 250 MB expanded-size limit')
      if (entry.compressedSize <= 0 || entry.uncompressedSize / entry.compressedSize > BULK_IMPORT_LIMITS.compressionRatio) {
        throw new BulkImportInputError(`Image ${baseName} exceeds the allowed compression ratio`)
      }

      const target = path.join(outputDirectory, baseName)
      let actualSize = 0
      const sizeLimiter = new Transform({
        transform(chunk, encoding, callback) {
          actualSize += chunk.length
          if (actualSize > BULK_IMPORT_LIMITS.imageBytes) return callback(new BulkImportInputError(`Image ${baseName} exceeds the 10 MB per-image limit`))
          callback(null, chunk)
        },
      })
      await pipeline(await zip.openReadStreamPromise(entry), sizeLimiter, createWriteStream(target, { flags: 'wx' }))
      if (actualSize !== entry.uncompressedSize) throw new BulkImportInputError(`Image ${baseName} has an invalid expanded size`)
      extracted.set(baseName, target)
    }
  } catch (error) {
    if (error instanceof BulkImportInputError) throw error
    throw new BulkImportInputError('Images ZIP is corrupt or could not be safely extracted')
  }
  return extracted
}

const prepareBulkProductImport = async ({ productFilePath, imagesZipPath, temporaryDirectory, storeId, prismaClient = prisma }) => {
  if (!Number.isInteger(storeId) || storeId < 1) throw new BulkImportInputError('A concrete store is required', 409)
  const productStat = await fs.stat(productFilePath)
  if (productStat.size <= 0) throw new BulkImportInputError('Product data file is empty')
  if (productStat.size > BULK_IMPORT_LIMITS.productFileBytes) throw new BulkImportInputError('Product data file exceeds the 20 MB limit', 413)

  const rows = await parseSpreadsheet(productFilePath)
  const images = await extractImagesZip(imagesZipPath, path.join(temporaryDirectory, 'extracted-images'))
  const [categories, brands] = await Promise.all([
    prismaClient.category.findMany({ where: { storeId }, select: { id: true, name: true } }),
    prismaClient.brand.findMany({ where: { storeId }, select: { id: true, name: true } }),
  ])
  const categoryIndex = indexNames(categories)
  const brandIndex = indexNames(brands)
  const skuCounts = new Map()
  const slugCounts = new Map()
  for (const { values } of rows) {
    const sku = normalized(values.sku)
    const slug = normalized(values.slug)
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1)
    if (slug) slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1)
  }
  const slugs = [...new Set(rows.map(({ values }) => values.slug).filter(Boolean))]
  const existing = slugs.length
    ? await prismaClient.product.findMany({ where: { slug: { in: slugs } }, select: { slug: true } })
    : []
  const existingSlugs = new Set(existing.map(({ slug }) => normalized(slug)))

  for (const row of rows) {
    const { values, errors, warnings } = row
    for (const field of REQUIRED) if (!values[field]) errors.push(`${field} is required`)
    for (const field of NUMERIC) if (values[field] && !Number.isFinite(Number(values[field]))) errors.push(`${field} must be numeric`)
    if (values.price && Number(values.price) <= 0) errors.push('price must be greater than zero')
    for (const field of ['countInStock', 'lowStockAlert']) {
      if (values[field] && Number.isFinite(Number(values[field])) && (!Number.isInteger(Number(values[field])) || Number(values[field]) < 0)) {
        errors.push(`${field} must be a non-negative integer`)
      }
    }
    for (const field of ['discountPercent', 'tax']) {
      if (values[field] && Number.isFinite(Number(values[field])) && Number(values[field]) < 0) errors.push(`${field} cannot be negative`)
    }
    if (values.status && !STATUSES.has(values.status.toUpperCase())) errors.push('status must be ACTIVE, DRAFT, or ARCHIVED')
    if (values.availability && !AVAILABILITIES.has(values.availability.toUpperCase())) errors.push('availability must be IN_STOCK, LOW_STOCK, or OUT_OF_STOCK')
    if (values.sku && skuCounts.get(normalized(values.sku)) > 1) errors.push('duplicate SKU in uploaded file')
    if (values.slug && slugCounts.get(normalized(values.slug)) > 1) errors.push('duplicate slug in uploaded file')
    if (values.slug && existingSlugs.has(normalized(values.slug))) errors.push('slug already exists')

    row.category = resolveName(categoryIndex, values.category, 'Category', errors)
    row.brand = resolveName(brandIndex, values.brand, 'Brand', errors)
    if (!values.images) {
      warnings.push('No images referenced')
      row.imageFilenames = []
    } else {
      const filenames = values.images.split('|').map((filename) => filename.trim())
      row.imageFilenames = filenames.filter(Boolean)
      if (filenames.some((filename) => !filename)) errors.push('images contains an empty filename entry')
      for (const filename of filenames.filter(Boolean)) {
        if (/^blob:/i.test(filename)) errors.push(`images contains a blob URL: ${filename}`)
        else if (/^https?:\/\//i.test(filename)) errors.push(`images must contain filenames, not URLs: ${filename}`)
        else if (/(^|[\\/])\.\.([\\/]|$)/.test(filename)) errors.push(`images contains a path traversal value: ${filename}`)
        else if (!IMAGE_PATTERN.test(filename)) errors.push(`images contains an invalid image filename: ${filename}`)
        else if (!images.has(filename)) errors.push(`image file was not found in ZIP: ${filename}`)
      }
    }
    row.status = errors.length ? 'failed' : 'valid'
  }

  const valid = rows.filter((row) => row.status === 'valid').length
  const validationResult = {
    summary: { total: rows.length, valid, failed: rows.length - valid },
    rows: rows.map(({ rowNumber, values, status, errors, warnings, category, brand, imageFilenames }) => ({
      rowNumber, sku: values.sku || null, slug: values.slug || null, status, errors, warnings,
      categoryId: category?.id ?? null, brandId: brand?.id ?? null, imageFilenames,
    })),
  }
  const plans = rows.map(({ rowNumber, values, status, errors, warnings, category, brand, imageFilenames }) => ({
    rowNumber,
    values,
    status,
    errors,
    warnings,
    categoryId: category?.id ?? null,
    brandId: brand?.id ?? null,
    brandName: brand?.name ?? values.brand,
    imageFilenames,
  }))
  return { validationResult, plans, images }
}

export const validateBulkProductImport = async (options) => (await prepareBulkProductImport(options)).validationResult

const serializeStringArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join(',')
  if (typeof value === 'string') return value
  return ''
}

const createProductData = (plan, imagePaths, storeId) => {
  const { values } = plan
  return {
    name: values.name,
    slug: values.slug,
    sku: values.sku,
    shortDescription: values.shortDescription || undefined,
    fullDescription: values.fullDescription || values.description || values.shortDescription || undefined,
    description: values.description || values.fullDescription || values.shortDescription || undefined,
    brand: plan.brandName || values.brand || null,
    price: Number(values.price),
    discountPercent: Number(values.discountPercent || 0),
    tax: Number(values.tax || 0),
    countInStock: Number(values.countInStock) || 0,
    lowStockAlert: Number(values.lowStockAlert || 5),
    availability: values.availability || 'IN_STOCK',
    warehouse: values.warehouse || 'Main',
    images: serializeStringArray(imagePaths),
    collection: values.collection || undefined,
    tags: serializeStringArray(values.tags),
    size: values.size || undefined,
    color: values.color || undefined,
    material: values.material || undefined,
    metaTitle: values.metaTitle || undefined,
    metaDescription: values.metaDescription || undefined,
    keywords: serializeStringArray(values.keywords),
    status: values.status || 'ACTIVE',
    storeId,
    categoryId: plan.categoryId,
    brandId: plan.brandId,
  }
}

export const importBulkProducts = async ({
  productFilePath,
  imagesZipPath,
  temporaryDirectory,
  storeId,
  prismaClient = prisma,
  uploadDirectory = path.resolve(process.cwd(), 'uploads', 'products'),
}) => {
  const prepared = await prepareBulkProductImport({ productFilePath, imagesZipPath, temporaryDirectory, storeId, prismaClient })
  const { validationResult, plans, images } = prepared
  if (validationResult.summary.failed > 0) {
    return { ...validationResult, summary: { ...validationResult.summary, created: 0 } }
  }

  const referencedFilenames = [...new Set(plans.flatMap((plan) => plan.imageFilenames))]
  const persistedPaths = new Map()
  const createdImageFiles = []
  let products

  try {
    if (referencedFilenames.length > 0) await fs.mkdir(uploadDirectory, { recursive: true })
    for (const filename of referencedFilenames) {
      const storedFilename = `${crypto.randomUUID()}${path.extname(filename).toLowerCase()}`
      const destination = path.join(uploadDirectory, storedFilename)
      await fs.copyFile(images.get(filename), destination, fsConstants.COPYFILE_EXCL)
      createdImageFiles.push(destination)
      persistedPaths.set(filename, `/uploads/products/${storedFilename}`)
    }

    products = await prismaClient.$transaction(async (transaction) => {
      const createdProducts = []
      for (const plan of plans) {
        const imagePaths = plan.imageFilenames.map((filename) => persistedPaths.get(filename))
        createdProducts.push(await transaction.product.create({ data: createProductData(plan, imagePaths, storeId) }))
      }
      return createdProducts
    })
  } catch (error) {
    const cleanupResults = await Promise.allSettled(createdImageFiles.map((filePath) => fs.rm(filePath, { force: true })))
    for (const result of cleanupResults) {
      if (result.status === 'rejected') console.warn('Bulk import image rollback failed', result.reason)
    }
    throw error
  }

  return {
    summary: { ...validationResult.summary, created: products.length },
    rows: plans.map((plan, index) => ({
      ...validationResult.rows[index],
      status: 'created',
      productId: products[index].id,
      images: plan.imageFilenames.map((filename) => persistedPaths.get(filename)),
    })),
  }
}