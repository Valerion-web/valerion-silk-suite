import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import multer from 'multer'
import { BulkImportInputError, BULK_IMPORT_LIMITS, importBulkProducts } from '../services/bulkProductImportService.js'

const bulkImportUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, callback) => callback(null, req.bulkImportTempDirectory),
    filename: (_req, file, callback) => callback(null, `${file.fieldname}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase()
    const valid = file.fieldname === 'productFile'
      ? extension === '.xlsx' || extension === '.csv'
      : file.fieldname === 'imagesZip' && extension === '.zip'
    callback(valid ? null : new Error('Use productFile (.xlsx/.csv) and imagesZip (.zip) multipart fields'), valid)
  },
  limits: {
    files: 2,
    fields: 0,
    parts: 2,
    fileSize: BULK_IMPORT_LIMITS.zipFileBytes,
  },
}).fields([
  { name: 'productFile', maxCount: 1 },
  { name: 'imagesZip', maxCount: 1 },
])

export const cleanupBulkImportDirectory = async (req) => {
  const temporaryDirectory = req.bulkImportTempDirectory
  if (!temporaryDirectory) return

  let lastError = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(temporaryDirectory, { recursive: true, force: true })
      req.bulkImportTempDirectory = null
      return
    } catch (error) {
      lastError = error
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
      }
    }
  }

  req.bulkImportTempDirectory = null
  if (lastError) {
    console.warn('Bulk import temp cleanup failed for', temporaryDirectory, lastError)
  }
}

export const receiveBulkProductImportFiles = async (req, res, next) => {
  try {
    req.bulkImportTempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'haston-bulk-import-'))
    bulkImportUpload(req, res, (error) => {
      if (!error) return next()
      void cleanupBulkImportDirectory(req).catch(() => {}).finally(() => {
        const isFileTooLarge = error.code === 'LIMIT_FILE_SIZE'
        res.status(isFileTooLarge ? 413 : 400).json({ message: isFileTooLarge ? 'An uploaded file exceeds the 100 MB limit' : error.message })
      })
    })
  } catch (error) {
    await cleanupBulkImportDirectory(req)
    next(error)
  }
}

export const validateBulkProductImportRequest = async (req, res, next) => {
  let responseStatus = 200
  let responseBody
  let nextError

  try {
    const productFile = req.files?.productFile?.[0]
    const imagesZip = req.files?.imagesZip?.[0]
    if (!productFile || !imagesZip) {
      responseStatus = 400
      responseBody = { message: 'Both productFile (.xlsx/.csv) and imagesZip (.zip) are required' }
    } else if (productFile.size > BULK_IMPORT_LIMITS.productFileBytes) {
      responseStatus = 413
      responseBody = { message: 'Product data file exceeds the 20 MB limit' }
    } else {
      responseBody = await importBulkProducts({
        productFilePath: productFile.path,
        imagesZipPath: imagesZip.path,
        temporaryDirectory: req.bulkImportTempDirectory,
        storeId: req.store.id,
      })
    }
  } catch (error) {
    if (error instanceof BulkImportInputError) {
      responseStatus = error.statusCode
      responseBody = { message: error.message }
    } else {
      nextError = error
    }
  }

  try {
    await cleanupBulkImportDirectory(req)
  } catch {
    // Preserve the validation/import error if cleanup fails.
  }

  if (nextError) return next(nextError)
  return res.status(responseStatus).json(responseBody)
}