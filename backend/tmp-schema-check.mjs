import Database from 'better-sqlite3'
const db = new Database('./dev.db')
console.log(JSON.stringify({ orderColumns: db.prepare("PRAGMA table_info('Order')").all(), historyTable: db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='OrderStatusHistory'").all() }, null, 2))
db.close()
