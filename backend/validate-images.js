import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const files = [
  path.join(__dirname, 'mock', 'products.json'),
  path.join(__dirname, 'prisma', 'seed.js'),
]

const urls = new Set()
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  const regex = /https:\/\/[^"'\s\]]+/g
  const found = content.match(regex)
  if (found) found.forEach(u => urls.add(u.replace(/[,\)\n]$/g, '').trim()))
}

console.log('Found', urls.size, 'URLs')

const checkUrl = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    return { url, status: res.status, ok: res.ok, statusText: res.statusText }
  } catch (err) {
    return { url, error: err.message }
  } finally {
    clearTimeout(timeout)
  }
}

for (const url of urls) {
  const result = await checkUrl(url)
  if (result.error || !result.ok) {
    console.log('BAD', JSON.stringify(result))
  } else {
    console.log('OK', result.status, result.url)
  }
}
