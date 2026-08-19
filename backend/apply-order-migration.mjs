import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'

const db = new Database('./dev.db')
const sql = readFileSync('./prisma/migrations/20260702_order_currency_and_status_history.sql', 'utf8')
db.exec(sql)
db.close()
console.log('Applied order schema migration')
