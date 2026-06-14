import 'dotenv/config'
import { Pool } from 'pg'

const cs = process.env.DATABASE_URL
console.log('DATABASE_URL (raw):', cs)
const pool = new Pool({ connectionString: cs })

;(async ()=>{
  try{
    const r = await pool.query('SELECT 1 as ok')
    console.log('PG OK', r.rows)
  }catch(e){
    console.error('PG ERR', e)
  }finally{
    await pool.end()
  }
})()
