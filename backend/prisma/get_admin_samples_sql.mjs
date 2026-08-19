import Database from 'better-sqlite3'

const db = new Database('dev.db', { readonly: true })

function iso(d){ return new Date(d).toISOString() }

function getDateRange(period='today'){
  const now = new Date()
  let start = new Date(now)
  let end = new Date(now)
  if (period === 'today'){
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (period === '7d'){
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate()-6)
  } else if (period === '30d'){
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate()-29)
  } else if (period === 'all'){
    start = new Date(0)
  }
  end.setHours(23,59,59,999)
  start.setHours(0,0,0,0)
  return { from: start, to: end }
}

// 1) Dashboard
function adminDashboard(period='today'){
  const { from, to } = getDateRange(period)
  const prevTo = new Date(from.getTime()-1)
  const prevFrom = new Date(prevTo.getTime() - (to.getTime()-from.getTime()))

  const current = db.prepare('SELECT id, totalPrice, createdAt FROM \"Order\" WHERE createdAt >= ? AND createdAt <= ?').all(from.toISOString(), to.toISOString())
  const previous = db.prepare('SELECT id, totalPrice, createdAt FROM \"Order\" WHERE createdAt >= ? AND createdAt <= ?').all(prevFrom.toISOString(), prevTo.toISOString())

  const sum = arr => arr.reduce((s,o)=>s + (o.totalPrice||0),0)
  const revenueCurrent = sum(current)
  const revenuePrevious = sum(previous)
  const ordersCurrent = current.length
  const ordersPrevious = previous.length
  const avgCurrent = ordersCurrent ? revenueCurrent / ordersCurrent : 0
  const avgPrevious = ordersPrevious ? revenuePrevious / ordersPrevious : 0
  const pctChange = (currentVal, prevVal) => { if (prevVal === 0) return prevVal === currentVal ? 0 : null; return Number((((currentVal - prevVal)/Math.abs(prevVal))*100).toFixed(2)) }

  return {
    period,
    revenue: revenueCurrent,
    orders: ordersCurrent,
    averageOrderValue: Number(avgCurrent.toFixed(2)),
    revenueChangePct: pctChange(revenueCurrent, revenuePrevious),
    ordersChangePct: pctChange(ordersCurrent, ordersPrevious),
    averageOrderValueChangePct: pctChange(avgCurrent, avgPrevious),
  }
}

// 2) Low stock inventory (variant-level)
function lowStockInventory(thresholdParam){
  const threshold = Number.isFinite(Number(thresholdParam)) ? Number(thresholdParam) : null
  const variants = db.prepare('SELECT pv.id, pv.sku, pv.productId, pv.size, pv.color, pv.quantityOnHand, pv.reorderThreshold, pv.status, pv.updatedAt, p.name as productName FROM ProductVariant pv LEFT JOIN Product p ON p.id = pv.productId ORDER BY pv.quantityOnHand ASC').all()
  const filtered = variants.filter(v=>{
    if (threshold !== null) return (v.quantityOnHand||0) <= threshold
    return (v.quantityOnHand||0) <= (v.reorderThreshold||0)
  })
  return filtered.map(v=>({ variantId: v.id, sku: v.sku, productId: v.productId, productName: v.productName, size: v.size, color: v.color, quantityOnHand: v.quantityOnHand||0, reorderThreshold: v.reorderThreshold||0, status: v.status, updatedAt: v.updatedAt }))
}

// 3) Variant inventory list
function variantInventoryList(productId=null){
  if (productId){
    const p = db.prepare('SELECT id, name FROM Product WHERE id = ?').get(productId)
    if (!p) return { id: productId, name: null, variants: [] }
    const variants = db.prepare('SELECT id, sku, size, color, quantityOnHand, reorderThreshold, status FROM ProductVariant WHERE productId = ?').all(productId)
    return { id: p.id, name: p.name, variants }
  }
  const products = db.prepare('SELECT id, name FROM Product ORDER BY createdAt DESC').all()
  return products.map(p=>{ const variants = db.prepare('SELECT id, sku, size, color, quantityOnHand, reorderThreshold, status FROM ProductVariant WHERE productId = ?').all(p.id); return { id: p.id, name: p.name, variants } })
}

// 4) Recent orders
function recentOrders(limit=20){
  const l = Math.min(100, Math.max(1, Number(limit||20)))
  const orders = db.prepare('SELECT o.id,o.userId,o.totalPrice,o.status,o.createdAt,u.name as userName,u.email as userEmail FROM \"Order\" o LEFT JOIN \"User\" u ON u.id = o.userId ORDER BY o.createdAt DESC LIMIT ?').all(l)
  return orders.map(o=>({ id: o.id, user: o.userId ? { id: o.userId, name: o.userName, email: o.userEmail } : null, totalPrice: Number(o.totalPrice), currency: 'INR', status: o.status, createdAt: o.createdAt }))
}

// 5) Order status timeline
function orderStatusTimeline(orderId){
  const exists = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'OrderStatusHistory\'').get()
  if (!exists) return []
  const rows = db.prepare('SELECT id, status, note, changedById, createdAt FROM OrderStatusHistory WHERE orderId = ? ORDER BY createdAt ASC').all(orderId)
  return rows.map(r=>({ id: r.id, status: r.status, note: r.note || null, changedBy: r.changedById ? { id: r.changedById } : null, createdAt: r.createdAt }))
}

function main(){
  const dash = adminDashboard('today')
  const low = lowStockInventory()
  const variants = variantInventoryList()
  const recent = recentOrders(20)
  const sampleOrderId = recent.length ? recent[0].id : null
  const timeline = sampleOrderId ? orderStatusTimeline(sampleOrderId) : []

  console.log(JSON.stringify({ getAdminDashboard: dash, getLowStockInventory: low, getVariantInventoryList: variants, getRecentOrders: recent, getOrderStatusTimeline: timeline }, null, 2))
  db.close()
}

main()
