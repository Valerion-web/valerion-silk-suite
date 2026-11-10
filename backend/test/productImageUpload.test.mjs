import assert from 'node:assert/strict'
import { once } from 'node:events'
import crypto from 'node:crypto'
import http from 'node:http'
import { createServer } from 'node:http'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import sharp from 'sharp'
import test from 'node:test'
import { createProductImageUpload, uploadProductImages } from '../controllers/adminController.js'
import { errorHandler } from '../middleware/errorMiddleware.js'
import adminRoutes from '../routes/adminRoutes.js'
import { protect, requireAdmin } from '../middleware/authMiddleware.js'
import { requireConcreteStore } from '../middleware/storeMiddleware.js'

const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'products')
const imageFormats = [
  { format: 'jpeg', extension: '.jpg', mimeType: 'image/jpeg' },
  { format: 'png', extension: '.png', mimeType: 'image/png' },
  { format: 'webp', extension: '.webp', mimeType: 'image/webp' },
]
const productImageRoute = adminRoutes.stack.find((layer) => layer.route?.path === '/product-images')
const adminRouteGuards = adminRoutes.stack.filter((layer) => layer.name === 'protect' || layer.name === 'requireAdmin')

const makePng = (width = 2, height = 2) => sharp({
  create: { width, height, channels: 3, background: '#4488cc' },
}).png().toBuffer()

const directoryEntries = async () => {
  try {
    return (await readdir(uploadDirectory)).sort()
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

const startUploadServer = async (t) => {
  const preexistingFiles = new Set(await directoryEntries())
  const createdFiles = new Set()
  t.after(() => Promise.all([...createdFiles].map((filename) => (
    rm(path.join(uploadDirectory, filename), { force: true })
  ))))

  const app = express()
  app.post('/product-images', uploadProductImages, (req, res, next) => {
    const sendJson = res.json
    res.json = function (body) {
      for (const imageUrl of body?.images ?? []) {
        const match = typeof imageUrl === 'string'
          ? /^\/uploads\/products\/([\da-f-]+\.(?:jpg|png|webp))$/i.exec(imageUrl)
          : null
        if (match && !preexistingFiles.has(match[1])) createdFiles.add(match[1])
      }
      return sendJson.call(this, body)
    }
    return createProductImageUpload(req, res, next)
  })
  app.use('/uploads/products', express.static(uploadDirectory))
  app.use(errorHandler)
  const server = createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))

  const address = server.address()
  assert.ok(address && typeof address === 'object')
  return `http://127.0.0.1:${address.port}/product-images`
}

const sendFiles = async (url, files) => {
  const form = new FormData()
  for (const file of files) {
    form.append('images', new Blob([file.bytes], { type: file.mimeType }), file.filename)
  }
  return fetch(url, { method: 'POST', body: form })
}

const publicUrl = (uploadUrl, filename) => `${uploadUrl.slice(0, uploadUrl.lastIndexOf('/'))}/uploads/products/${filename}`

const assertNoNewFiles = async (url, before) => {
  const after = await directoryEntries()
  const newFiles = after.filter((filename) => !before.includes(filename))
  for (const filename of newFiles) {
    const response = await fetch(publicUrl(url, filename))
    assert.equal(response.status, 404, `${filename} must not be publicly served`)
  }
  assert.deepEqual(after, before)
}

test('product image upload re-encodes supported raster formats with generated filenames', async (t) => {
  const url = await startUploadServer(t)
  const files = await Promise.all(imageFormats.map(async ({ format, extension, mimeType }) => {
    const image = sharp({
      create: {
        width: 3,
        height: 2,
        channels: 3,
        background: { r: 80, g: 120, b: 200 },
      },
    })
    const input = format === 'jpeg'
      ? image.jpeg().withMetadata({ orientation: 6 })
      : image.toFormat(format)
    return {
      bytes: await input.toBuffer(),
      filename: `source${extension}`,
      mimeType,
    }
  }))

  assert.ok((await sharp(files[0].bytes).metadata()).exif)
  const response = await sendFiles(url, files)
  const result = await response.json()
  assert.equal(response.status, 201)
  assert.equal(result.images.length, imageFormats.length)

  for (const [index, imageUrl] of result.images.entries()) {
    const format = imageFormats[index]
    assert.match(imageUrl, new RegExp(`^/uploads/products/[\\da-f-]+\\.${format.extension.slice(1)}$`))
    const outputPath = path.join(uploadDirectory, path.basename(imageUrl))
    const publicFile = await fetch(publicUrl(url, path.basename(imageUrl)))
    assert.equal(publicFile.status, 200)
    const metadata = await sharp(outputPath).metadata()
    assert.equal(metadata.format, format.format)
    assert.equal(metadata.exif, undefined)
    if (format.format === 'jpeg') {
      assert.equal(metadata.width, 2)
      assert.equal(metadata.height, 3)
    }
  }
})

test('production admin route keeps authentication, admin, products and concrete-store guards', async (t) => {
  assert.ok(productImageRoute)
  assert.deepEqual(adminRouteGuards.map((layer) => layer.handle), [protect, requireAdmin])
  assert.deepEqual(productImageRoute.route.stack.slice(1).map((layer) => layer.handle), [
    requireConcreteStore,
    uploadProductImages,
    createProductImageUpload,
  ])
  assert.equal(productImageRoute.route.stack[0].name, '<anonymous>')

  const app = express()
  app.use('/admin', adminRoutes)
  app.use(errorHandler)
  const server = createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))

  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const denied = await fetch(`http://127.0.0.1:${address.port}/admin/product-images`, { method: 'POST' })
  assert.equal(denied.status, 401)

  const capabilityGuard = productImageRoute.route.stack[0].handle
  const invoke = async (middleware, request) => new Promise((resolve, reject) => {
    middleware(request, { status(code) { this.statusCode = code; return this } }, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
  await assert.rejects(
    invoke(capabilityGuard, { adminContext: { role: 'INVENTORY_MANAGER' } }),
    /Insufficient permissions/,
  )
  await invoke(capabilityGuard, { adminContext: { role: 'BRAND_MANAGER' } })
  await assert.rejects(
    invoke(requireConcreteStore, { store: null, contextType: 'PARENT' }),
    /concrete ecommerce store context/,
  )
  await invoke(requireConcreteStore, { store: { id: 1 }, contextType: 'STORE' })
})

test('product image upload rejects MIME/content mismatches without writing files', async (t) => {
  const url = await startUploadServer(t)
  const before = await directoryEntries()
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#4488cc' },
  }).png().toBuffer()
  const response = await sendFiles(url, [{
    bytes: png,
    filename: 'spoofed.jpg',
    mimeType: 'image/jpeg',
  }])

  assert.equal(response.status, 400)
  await assertNoNewFiles(url, before)
})

test('product image upload rejects extension/content mismatches without writing files', async (t) => {
  const url = await startUploadServer(t)
  const before = await directoryEntries()
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#4488cc' },
  }).png().toBuffer()
  const response = await sendFiles(url, [{
    bytes: png,
    filename: 'wrong-extension.jpg',
    mimeType: 'image/png',
  }])

  assert.equal(response.status, 400)
  await assertNoNewFiles(url, before)
})

test('product image upload rejects invalid image content without writing files', async (t) => {
  const url = await startUploadServer(t)
  const before = await directoryEntries()
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#4488cc' },
  }).png().toBuffer()
  const response = await sendFiles(url, [
    { bytes: png, filename: 'valid.png', mimeType: 'image/png' },
    {
      bytes: Buffer.from('<script>alert(1)</script>'),
      filename: 'invalid.png',
      mimeType: 'image/png',
    },
  ])

  assert.equal(response.status, 400)
  await assertNoNewFiles(url, before)
})

test('product image upload rejects unsupported SVG content without writing files', async (t) => {
  const url = await startUploadServer(t)
  const before = await directoryEntries()
  const response = await sendFiles(url, [{
    bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    filename: 'unsupported.svg',
    mimeType: 'image/svg+xml',
  }])

  assert.equal(response.status, 400)
  await assertNoNewFiles(url, before)
})

test('product image upload enforces the file size limit without writing files', async (t) => {
  const url = await startUploadServer(t)
  const before = await directoryEntries()
  const response = await sendFiles(url, [{
    bytes: Buffer.alloc(10 * 1024 * 1024 + 1),
    filename: 'oversized.png',
    mimeType: 'image/png',
  }])

  assert.equal(response.status, 413)
  await assertNoNewFiles(url, before)
})

test('product image upload rejects animated images without writing public files', async (t) => {
  const url = await startUploadServer(t)
  const before = await directoryEntries()
  const gifHeader = Buffer.from('47494638396101000100800000ffffff000000', 'hex')
  const frame = Buffer.from('21f904000a0000002c0000000001000100000202440100', 'hex')
  const secondFrame = Buffer.from('21f904000a0000002c00000000010001000002024c0100', 'hex')
  const animatedGif = Buffer.concat([gifHeader, frame, secondFrame, Buffer.from('3b', 'hex')])
  const animatedWebp = await sharp(animatedGif, { animated: true })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer()
  assert.equal((await sharp(animatedWebp).metadata()).pages, 2)

  const response = await sendFiles(url, [{
    bytes: animatedWebp,
    filename: 'animated.webp',
    mimeType: 'image/webp',
  }])

  assert.equal(response.status, 400)
  await assertNoNewFiles(url, before)
})

test('product image upload rejects images above the configured pixel limit', async (t) => {
  const url = await startUploadServer(t)
  const before = await directoryEntries()
  const oversizedImage = await makePng(4500, 4500)
  assert.ok(oversizedImage.length < 10 * 1024 * 1024)

  const response = await sendFiles(url, [{
    bytes: oversizedImage,
    filename: 'pixel-limit.png',
    mimeType: 'image/png',
  }])

  assert.equal(response.status, 400)
  await assertNoNewFiles(url, before)
})

test('product image upload rejects SVG bytes disguised as every supported raster format', async (t) => {
  const url = await startUploadServer(t)
  const before = await directoryEntries()
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

  for (const format of imageFormats) {
    const response = await sendFiles(url, [{
      bytes: svg,
      filename: `disguised${format.extension}`,
      mimeType: format.mimeType,
    }])
    assert.equal(response.status, 400, `${format.format} disguise should be rejected`)
    await assertNoNewFiles(url, before)
  }
})

test('product image upload leaves no file when exclusive file creation fails', async (t) => {
  const url = await startUploadServer(t)
  await mkdir(uploadDirectory, { recursive: true })
  const collisionId = '00000000-0000-4000-8000-000000000011'
  const collisionName = `${collisionId}.png`
  const collisionPath = path.join(uploadDirectory, collisionName)
  const marker = Buffer.from('pre-existing file must survive')
  await writeFile(collisionPath, marker, { flag: 'wx' })
  t.after(() => rm(collisionPath, { force: true }))
  const before = await directoryEntries()
  const originalRandomUUID = crypto.randomUUID
  crypto.randomUUID = () => collisionId
  let response
  try {
    response = await sendFiles(url, [{
      bytes: await makePng(),
      filename: 'upload.png',
      mimeType: 'image/png',
    }])
  } finally {
    crypto.randomUUID = originalRandomUUID
  }

  assert.equal(response.status, 500)
  assert.deepEqual(await directoryEntries(), before)
  const publicFile = await fetch(publicUrl(url, collisionName))
  assert.equal(publicFile.status, 200)
  assert.deepEqual(Buffer.from(await publicFile.arrayBuffer()), marker)
})

test('product image upload removes earlier batch files after a later create failure', async (t) => {
  const url = await startUploadServer(t)
  await mkdir(uploadDirectory, { recursive: true })
  const firstId = '00000000-0000-4000-8000-000000000021'
  const collisionId = '00000000-0000-4000-8000-000000000022'
  const collisionName = `${collisionId}.png`
  const collisionPath = path.join(uploadDirectory, collisionName)
  const marker = Buffer.from('pre-existing collision file')
  await writeFile(collisionPath, marker, { flag: 'wx' })
  t.after(() => rm(collisionPath, { force: true }))
  const before = await directoryEntries()
  const originalRandomUUID = crypto.randomUUID
  const ids = [firstId, collisionId]
  crypto.randomUUID = () => ids.shift()
  let response
  try {
    const png = await makePng()
    response = await sendFiles(url, [
      { bytes: png, filename: 'first.png', mimeType: 'image/png' },
      { bytes: png, filename: 'second.png', mimeType: 'image/png' },
    ])
  } finally {
    crypto.randomUUID = originalRandomUUID
  }

  assert.equal(response.status, 500)
  assert.deepEqual(await directoryEntries(), before)
  assert.equal((await fetch(publicUrl(url, `${firstId}.png`))).status, 404)
  const publicCollision = await fetch(publicUrl(url, collisionName))
  assert.equal(publicCollision.status, 200)
  assert.deepEqual(Buffer.from(await publicCollision.arrayBuffer()), marker)
})

test('product image upload cleans up after malformed complete multipart bodies', async (t) => {
  const url = await startUploadServer(t)
  const before = await directoryEntries()
  const boundary = 'malformed-product-upload-boundary'
  const png = await makePng()
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="malformed.png"\r\nContent-Type: image/png\r\n\r\n`),
    png,
  ])
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body,
  })

  assert.equal(response.status, 400)
  await assertNoNewFiles(url, before)
})

test('product image upload creates no files for an aborted multipart request', async (t) => {
  const url = await startUploadServer(t)
  const before = await directoryEntries()
  const target = new URL(url)
  const boundary = 'aborted-product-upload-boundary'
  const request = http.request({
    hostname: target.hostname,
    port: target.port,
    path: target.pathname,
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  })
  const result = new Promise((resolve) => {
    request.on('response', (response) => {
      response.resume()
      response.on('end', () => resolve(response.statusCode))
    })
    request.on('error', () => resolve(null))
  })
  request.write(`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="aborted.png"\r\nContent-Type: image/png\r\n\r\n`)
  request.write(Buffer.from('partial image bytes'))
  await new Promise((resolve) => setTimeout(resolve, 25))
  request.destroy()
  await result
  await new Promise((resolve) => setTimeout(resolve, 25))

  await assertNoNewFiles(url, before)
})
