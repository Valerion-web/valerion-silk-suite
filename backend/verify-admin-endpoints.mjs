import process from 'node:process'

const baseUrl = process.env.BASE_URL || 'http://localhost:5000'
const email = process.env.ADMIN_EMAIL || 'admin@valerion.test'
const password = process.env.ADMIN_PASSWORD || 'Admin@123456'

async function login() {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    throw new Error(`Login failed with ${res.status}: ${await res.text()}`)
  }

  return (await res.json()).token
}

async function getJson(path, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with ${res.status}: ${body}`)
  }

  return JSON.parse(body)
}

async function main() {
  const token = await login()
  const dashboard = await getJson('/api/admin/dashboard', token)
  const orders = await getJson('/api/admin/orders', token)
  const lowStock = await getJson('/api/admin/inventory/low-stock', token)

  if (!dashboard || typeof dashboard.revenue !== 'number') {
    throw new Error('Dashboard payload is malformed')
  }
  if (!Array.isArray(orders)) {
    throw new Error('Orders endpoint did not return an array')
  }
  if (!Array.isArray(lowStock)) {
    throw new Error('Low-stock endpoint did not return an array')
  }

  console.log(JSON.stringify({ dashboard, ordersCount: orders.length, lowStockCount: lowStock.length }, null, 2))
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
