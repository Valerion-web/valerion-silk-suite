import assert from 'node:assert/strict'
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readSheet } from 'read-excel-file/node'
import { cleanupBulkImportDirectory } from '../controllers/bulkProductImportController.js'
import { BulkImportInputError, importBulkProducts, validateBulkProductImport } from '../services/bulkProductImportService.js'

const headers = ['name', 'sku', 'slug', 'price', 'countInStock', 'lowStockAlert', 'availability', 'status', 'category', 'brand', 'images']
const row = (overrides = {}) => ({ name: 'Classic Polo', sku: 'HST001', slug: 'classic-polo', price: '145', countInStock: '10', lowStockAlert: '2', availability: 'IN_STOCK', status: 'DRAFT', category: 'Shirts', brand: 'HASTON', images: 'HST001-1.jpg', ...overrides })

const crc32 = (buffer) => {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const makeZip = (entries) => {
  const localParts = []
  const centralParts = []
  let offset = 0
  for (const [fileName, contentValue] of Object.entries(entries)) {
    const fileNameBuffer = Buffer.from(fileName)
    const content = Buffer.from(contentValue)
    const crc = crc32(content)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(content.length, 18)
    local.writeUInt32LE(content.length, 22)
    local.writeUInt16LE(fileNameBuffer.length, 26)
    localParts.push(local, fileNameBuffer, content)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(content.length, 20)
    central.writeUInt32LE(content.length, 24)
    central.writeUInt16LE(fileNameBuffer.length, 28)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, fileNameBuffer)
    offset += local.length + fileNameBuffer.length + content.length
  }
  const directory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(entries).length, 8)
  end.writeUInt16LE(Object.keys(entries).length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, directory, end])
}

const xmlEscape = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const columnName = (index) => {
  let value = index + 1
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

const makeXlsx = (rows) => {
  const worksheetRows = [headers, ...rows].map((values, rowIndex) => {
    const cells = headers.map((header, columnIndex) => {
      const value = rowIndex === 0 ? header : values?.[header] ?? ''
      if (value === '') return ''
      const address = `${columnName(columnIndex)}${rowIndex + 1}`
      if (value && typeof value === 'object' && value.formula) {
        return `<c r="${address}"><f>${xmlEscape(value.formula)}</f><v>${xmlEscape(value.cached)}</v></c>`
      }
      if (NUMERIC_TEST_FIELDS.has(header) && Number.isFinite(Number(value))) {
        return `<c r="${address}"><v>${xmlEscape(value)}</v></c>`
      }
      return `<c r="${address}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`
    }).join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')
  const workbook = '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>'
  const workbookRels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
  const rootRels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  const contentTypes = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${worksheetRows}</sheetData></worksheet>`
  return makeZip({
    '[Content_Types].xml': contentTypes,
    '_rels/.rels': rootRels,
    'xl/workbook.xml': workbook,
    'xl/_rels/workbook.xml.rels': workbookRels,
    'xl/worksheets/sheet1.xml': sheet,
  })
}

const NUMERIC_TEST_FIELDS = new Set(['price', 'discountPercent', 'tax', 'countInStock', 'lowStockAlert'])

const fakePrisma = ({ categories = [{ id: 11, name: 'Shirts' }], brands = [{ id: 21, name: 'HASTON' }], slugs = [] } = {}) => {
  let writes = 0
  return {
    category: { findMany: async () => categories },
    brand: { findMany: async () => brands },
    product: {
      findMany: async () => slugs.map((slug) => ({ slug })),
      create: async () => { writes += 1; throw new Error('product.create must not run in Stage 2A') },
      get writes() { return writes },
    },
  }
}

const fixture = async (t, rows, { zipEntries = { 'HST001-1.jpg': 'image-bytes' }, csv = false } = {}) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'haston-bulk-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const productFilePath = path.join(directory, csv ? 'products.csv' : 'products.xlsx')
  if (csv) {
    await writeFile(productFilePath, [headers, ...rows.map((item) => headers.map((header) => item?.[header] ?? ''))].map((cells) => cells.join(',')).join('\n'))
  } else {
    await writeFile(productFilePath, makeXlsx(rows))
  }
  const imagesZipPath = path.join(directory, 'images.zip')
  await writeFile(imagesZipPath, makeZip(zipEntries))
  return { productFilePath, imagesZipPath, temporaryDirectory: directory }
}

const run = (files, db = fakePrisma()) => validateBulkProductImport({ ...files, storeId: 7, prismaClient: db })

const importPrisma = ({ existingSlugs = [], failOnCreate = 0 } = {}) => {
  const attemptedCreates = []
  const committedProducts = []
  const categoryFilters = []
  const brandFilters = []
  let transactionCount = 0
  let nextId = 100
  const client = {
    category: {
      findMany: async ({ where }) => {
        categoryFilters.push(where)
        return [{ id: 11, name: 'Shirts' }]
      },
    },
    brand: {
      findMany: async ({ where }) => {
        brandFilters.push(where)
        return [{ id: 21, name: 'HASTON' }]
      },
    },
    product: {
      findMany: async ({ where }) => (where.slug?.in || []).filter((slug) => existingSlugs.includes(slug)).map((slug) => ({ slug })),
    },
    $transaction: async (callback) => {
      transactionCount += 1
      const stagedProducts = []
      const transaction = {
        product: {
          create: async ({ data }) => {
            attemptedCreates.push(data)
            if (failOnCreate && attemptedCreates.length === failOnCreate) throw new Error('transaction create failed')
            const product = { id: nextId++, ...data }
            stagedProducts.push(product)
            return product
          },
        },
      }
      const result = await callback(transaction)
      committedProducts.push(...stagedProducts)
      return result
    },
  }
  return { client, attemptedCreates, committedProducts, categoryFilters, brandFilters, get transactionCount() { return transactionCount } }
}

const runImport = (files, db, uploadDirectory) => importBulkProducts({
  ...files,
  storeId: 7,
  prismaClient: db.client,
  uploadDirectory,
})

test('valid XLSX parses and resolves store category/brand without product writes', async (t) => {
  const files = await fixture(t, [row()])
  const db = fakePrisma()
  const result = await run(files, db)
  assert.deepEqual(result.summary, { total: 1, valid: 1, failed: 0 })
  assert.equal(result.rows[0].categoryId, 11)
  assert.equal(result.rows[0].brandId, 21)
  assert.equal(db.product.writes, 0)
})

test('XLSX row numbers preserve blank spreadsheet rows', async (t) => {
  const result = await run(await fixture(t, [row(), null, row({ name: '' })]))
  assert.deepEqual(result.rows.map((item) => item.rowNumber), [2, 4])
  assert.ok(result.rows[1].errors.includes('name is required'))
})

test('XLSX formulas are not evaluated and formula metadata limitation is reported', async (t) => {
  const files = await fixture(t, [row({ price: { formula: '900+100', cached: 145 } })])
  const parsedRows = await readSheet(files.productFilePath)
  assert.equal(parsedRows[1][3], 145)
  const result = await run(files)
  assert.equal(result.rows[0].status, 'valid')
  assert.ok(result.rows[0].warnings.includes('XLSX formula metadata is unavailable: formulas are not evaluated, but cached results cannot be distinguished from literal values.'))
})

test('valid CSV uses the same parser', async (t) => {
  const result = await run(await fixture(t, [row()], { csv: true }))
  assert.equal(result.rows[0].status, 'valid')
})

test('CSV row numbers preserve blank records', async (t) => {
  const result = await run(await fixture(t, [row(), null, row({ name: '' })], { csv: true }))
  assert.deepEqual(result.rows.map((item) => item.rowNumber), [2, 4])
  assert.ok(result.rows[1].errors.includes('name is required'))
})

test('missing required field fails row', async (t) => {
  const result = await run(await fixture(t, [row({ name: '' })]))
  assert.ok(result.rows[0].errors.includes('name is required'))
})

test('invalid price fails row', async (t) => {
  const result = await run(await fixture(t, [row({ price: '0' })]))
  assert.ok(result.rows[0].errors.includes('price must be greater than zero'))
})

test('duplicate SKU fails each duplicate row', async (t) => {
  const result = await run(await fixture(t, [row(), row({ slug: 'another-slug' })]))
  assert.ok(result.rows.every((item) => item.errors.includes('duplicate SKU in uploaded file')))
})

test('duplicate slug fails each duplicate row', async (t) => {
  const result = await run(await fixture(t, [row(), row({ sku: 'HST002' })]))
  assert.ok(result.rows.every((item) => item.errors.includes('duplicate slug in uploaded file')))
})

test('category not found fails row', async (t) => {
  const result = await run(await fixture(t, [row({ category: 'Unknown' })]))
  assert.ok(result.rows[0].errors.includes('Category name was not found'))
})

test('brand not found fails row', async (t) => {
  const result = await run(await fixture(t, [row({ brand: 'Unknown' })]))
  assert.ok(result.rows[0].errors.includes('Brand name was not found'))
})

test('referenced image missing from ZIP fails row', async (t) => {
  const result = await run(await fixture(t, [row({ images: 'missing.jpg' })], { zipEntries: { 'other.jpg': 'bytes' } }))
  assert.ok(result.rows[0].errors.includes('image file was not found in ZIP: missing.jpg'))
})

test('invalid image filename syntax fails row', async (t) => {
  const result = await run(await fixture(t, [row({ images: 'bad name.jpg' })], { zipEntries: { 'bad name.jpg': 'bytes' } }))
  assert.ok(result.rows[0].errors.includes('images contains an invalid image filename: bad name.jpg'))
})

test('ZIP path traversal is rejected', async (t) => {
  await assert.rejects(run(await fixture(t, [row()], { zipEntries: { '../HST001-1.jpg': 'bytes' } })), (error) => error instanceof BulkImportInputError && /ZIP/i.test(error.message))
})

test('unsupported ZIP image extension is rejected', async (t) => {
  await assert.rejects(run(await fixture(t, [row()], { zipEntries: { 'HST001-1.gif': 'bytes' } })), (error) => error instanceof BulkImportInputError && /unsupported image extension/i.test(error.message))
})

test('2 valid rows and matching ZIP create exactly 2 products with persistent image paths', async (t) => {
  const first = row()
  const second = row({ name: 'Oxford Shirt', sku: 'HST002', slug: 'oxford-shirt', images: 'HST002-1.jpg' })
  const files = await fixture(t, [first, second], { zipEntries: { 'HST001-1.jpg': 'image-one', 'HST002-1.jpg': 'image-two' } })
  const uploadDirectory = path.join(files.temporaryDirectory, 'persistent-products')
  const db = importPrisma()

  const result = await runImport(files, db, uploadDirectory)

  assert.deepEqual(result.summary, { total: 2, valid: 2, failed: 0, created: 2 })
  assert.deepEqual(result.rows.map((item) => item.status), ['created', 'created'])
  assert.deepEqual(result.rows.map((item) => item.productId), [100, 101])
  assert.equal(db.committedProducts.length, 2)
  assert.equal(db.transactionCount, 1)
  assert.equal(db.attemptedCreates[0].brandId, 21)
  assert.equal(db.attemptedCreates[0].categoryId, 11)
  assert.equal(db.attemptedCreates[0].brand, 'HASTON')
  assert.equal(db.attemptedCreates[0].storeId, 7)
  assert.equal(db.attemptedCreates[0].price, 145)
  assert.equal(db.attemptedCreates[0].lowStockAlert, 2)
  assert.equal(db.attemptedCreates[0].images, result.rows[0].images[0])
  assert.match(db.attemptedCreates[0].images, /^\/uploads\/products\/[a-f0-9-]+\.jpg$/i)
  const persistedFiles = await readdir(uploadDirectory)
  assert.equal(persistedFiles.length, 2)
  for (const createdRow of result.rows) {
    assert.equal(createdRow.images.length, 1)
    assert.match(createdRow.images[0], /^\/uploads\/products\/[a-f0-9-]+\.jpg$/i)
    assert.ok(!createdRow.images[0].startsWith('blob:'))
    assert.ok(!createdRow.images[0].includes(files.temporaryDirectory))
  }
  assert.deepEqual(db.categoryFilters, [{ storeId: 7 }])
  assert.deepEqual(db.brandFilters, [{ storeId: 7 }])
})

test('any invalid row prevents every product create and image persistence', async (t) => {
  const rows = [
    row(),
    row({ name: 'Oxford Shirt', sku: 'HST002', slug: 'oxford-shirt', images: 'HST002-1.jpg' }),
    row({ name: 'Broken Row', sku: 'HST003', slug: 'broken-row', price: 'bad', images: 'HST003-1.jpg' }),
  ]
  const files = await fixture(t, rows, { zipEntries: { 'HST001-1.jpg': 'one', 'HST002-1.jpg': 'two', 'HST003-1.jpg': 'three' } })
  const uploadDirectory = path.join(files.temporaryDirectory, 'persistent-products')
  const db = importPrisma()

  const result = await runImport(files, db, uploadDirectory)

  assert.deepEqual(result.summary, { total: 3, valid: 2, failed: 1, created: 0 })
  assert.equal(db.attemptedCreates.length, 0)
  assert.equal(db.transactionCount, 0)
  await assert.rejects(access(uploadDirectory), { code: 'ENOENT' })
})

test('missing referenced image prevents all product creates', async (t) => {
  const files = await fixture(t, [row()], { zipEntries: { 'another.jpg': 'bytes' } })
  const db = importPrisma()
  const result = await runImport(files, db, path.join(files.temporaryDirectory, 'persistent-products'))

  assert.equal(result.summary.created, 0)
  assert.equal(result.rows[0].status, 'failed')
  assert.equal(db.attemptedCreates.length, 0)
  assert.equal(db.transactionCount, 0)
})

test('invalid ZIP prevents all product creates', async (t) => {
  const files = await fixture(t, [row()])
  await writeFile(files.imagesZipPath, 'not a ZIP archive')
  const db = importPrisma()

  await assert.rejects(runImport(files, db, path.join(files.temporaryDirectory, 'persistent-products')), BulkImportInputError)
  assert.equal(db.attemptedCreates.length, 0)
  assert.equal(db.transactionCount, 0)
})

test('duplicate SKU and duplicate slug each prevent all product creates', async (t) => {
  const cases = [
    [row(), row({ slug: 'another-slug' })],
    [row(), row({ sku: 'another-sku' })],
  ]
  for (const rows of cases) {
    const files = await fixture(t, rows)
    const db = importPrisma()
    const result = await runImport(files, db, path.join(files.temporaryDirectory, 'persistent-products'))
    assert.equal(result.summary.created, 0)
    assert.equal(result.summary.failed, 2)
    assert.equal(db.attemptedCreates.length, 0)
    assert.equal(db.transactionCount, 0)
  }
})

test('existing slug conflict prevents all product creates', async (t) => {
  const files = await fixture(t, [row()])
  const db = importPrisma({ existingSlugs: ['classic-polo'] })
  const result = await runImport(files, db, path.join(files.temporaryDirectory, 'persistent-products'))

  assert.equal(result.summary.created, 0)
  assert.equal(result.rows[0].status, 'failed')
  assert.equal(db.attemptedCreates.length, 0)
  assert.equal(db.transactionCount, 0)
})

test('transaction failure rolls back products and removes persisted image files', async (t) => {
  const second = row({ name: 'Oxford Shirt', sku: 'HST002', slug: 'oxford-shirt', images: 'HST002-1.jpg' })
  const files = await fixture(t, [row(), second], { zipEntries: { 'HST001-1.jpg': 'one', 'HST002-1.jpg': 'two' } })
  const uploadDirectory = path.join(files.temporaryDirectory, 'persistent-products')
  const db = importPrisma({ failOnCreate: 2 })

  await assert.rejects(runImport(files, db, uploadDirectory), /transaction create failed/)

  assert.equal(db.committedProducts.length, 0)
  assert.equal(db.transactionCount, 1)
  assert.deepEqual(await readdir(uploadDirectory), [])
})

test('bulk import temp cleanup removes uploaded and extracted files', async (t) => {
  const files = await fixture(t, [row()])
  const request = { bulkImportTempDirectory: files.temporaryDirectory }
  await importBulkProducts({ ...files, storeId: 7, prismaClient: importPrisma().client, uploadDirectory: path.join(files.temporaryDirectory, 'persistent-products') })
  await access(path.join(files.temporaryDirectory, 'extracted-images'))

  await cleanupBulkImportDirectory(request)

  assert.equal(request.bulkImportTempDirectory, null)
  await assert.rejects(access(files.temporaryDirectory), { code: 'ENOENT' })
})