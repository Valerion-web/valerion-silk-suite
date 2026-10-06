import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import path from 'node:path'
import { rm } from 'node:fs/promises'
import express from 'express'
import test from 'node:test'
import prisma from '../lib/prisma.js'
import { createAdminCategory, getAdminCategories, updateAdminCategory } from '../controllers/adminController.js'
import { getCategories, getCategoryBySlug } from '../controllers/catalogController.js'
import { uploadAdminCategoryImage } from '../controllers/categoryImageUploadController.js'

const makeResponse = () => ({
  statusCode: 200,
  status(statusCode) {
    this.statusCode = statusCode
    return this
  },
  json(body) {
    this.body = body
    return this
  },
})

const replaceMethod = (target, method, replacement) => {
  const original = target[method]
  target[method] = replacement
  return () => { target[method] = original }
}

test('public category responses include nullable image fields', async (t) => {
  const category = {
    id: 7,
    name: 'Shirts',
    slug: 'shirts',
    description: null,
    parentId: null,
    image: null,
    coverImage: null,
    storeId: 2,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    _count: { products: 0 },
  }
  const restoreFindMany = replaceMethod(prisma.category, 'findMany', async () => [category])
  const restoreFindFirst = replaceMethod(prisma.category, 'findFirst', async () => ({ ...category, products: [] }))
  t.after(() => {
    restoreFindMany()
    restoreFindFirst()
  })

  const listResponse = makeResponse()
  await getCategories({ store: { id: 2 }, contextType: 'STORE' }, listResponse, (error) => { throw error })
  assert.equal(listResponse.body[0].image, null)
  assert.equal(listResponse.body[0].coverImage, null)
  assert.equal(listResponse.body[0].productCount, 0)

  const detailResponse = makeResponse()
  await getCategoryBySlug({ store: { id: 2 }, contextType: 'STORE', params: { slug: 'shirts' } }, detailResponse, (error) => { throw error })
  assert.equal(detailResponse.body.image, null)
  assert.equal(detailResponse.body.coverImage, null)
})

test('admin category create and update persist both image paths', async (t) => {
  const storedCategory = {
    id: 7,
    name: 'Shirts',
    slug: 'shirts-123',
    description: null,
    parentId: null,
    image: '/uploads/categories/image.jpg',
    coverImage: '/uploads/categories/cover.webp',
    parent: null,
  }
  let createData
  let updateData
  const restoreCreate = replaceMethod(prisma.category, 'create', async ({ data }) => {
    createData = data
    return { ...storedCategory, ...data }
  })
  const restoreFindFirst = replaceMethod(prisma.category, 'findFirst', async () => storedCategory)
  const restoreUpdate = replaceMethod(prisma.category, 'update', async ({ data }) => {
    updateData = data
    return { ...storedCategory, ...data }
  })
  t.after(() => {
    restoreCreate()
    restoreFindFirst()
    restoreUpdate()
  })

  const request = {
    store: { id: 2 },
    contextType: 'STORE',
    body: {
      name: 'Shirts',
      image: storedCategory.image,
      coverImage: storedCategory.coverImage,
    },
  }
  const createResponse = makeResponse()
  await createAdminCategory(request, createResponse, (error) => { throw error })
  assert.equal(createData.image, storedCategory.image)
  assert.equal(createData.coverImage, storedCategory.coverImage)
  assert.equal(createResponse.body.image, storedCategory.image)
  assert.equal(createResponse.body.coverImage, storedCategory.coverImage)

  const updateResponse = makeResponse()
  await updateAdminCategory({ ...request, params: { id: '7' } }, updateResponse, (error) => { throw error })
  assert.equal(updateData.image, storedCategory.image)
  assert.equal(updateData.coverImage, storedCategory.coverImage)
  assert.equal(updateResponse.body.image, storedCategory.image)
  assert.equal(updateResponse.body.coverImage, storedCategory.coverImage)
})

test('category image upload validates image content and stores a unique path', async (t) => {
  const app = express()
  app.post('/categories/images', uploadAdminCategoryImage)
  const server = createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))

  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const url = `http://127.0.0.1:${address.port}/categories/images`
  const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p6sAAAAASUVORK5CYII=', 'base64')
  const form = new FormData()
  form.append('image', new Blob([imageBytes], { type: 'image/png' }), 'category.png')
  const response = await fetch(url, { method: 'POST', body: form })
  const result = await response.json()

  assert.equal(response.status, 201)
  assert.match(result.url, /^\/uploads\/categories\/[\da-f-]+\.png$/)
  const storedPath = path.resolve(process.cwd(), 'uploads', result.url.slice('/uploads/'.length))
  t.after(() => rm(storedPath, { force: true }))

  const invalidForm = new FormData()
  invalidForm.append('image', new Blob([imageBytes], { type: 'text/plain' }), 'not-an-image.txt')
  const invalidResponse = await fetch(url, { method: 'POST', body: invalidForm })
  assert.equal(invalidResponse.status, 400)
})