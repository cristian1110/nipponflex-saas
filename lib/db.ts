import { Pool, QueryResult } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export async function query(text: string, params?: any[]): Promise<any[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    // Agregar rowCount al resultado
    const rows = result.rows as any
    rows.rowCount = result.rowCount
    return rows
  } finally {
    client.release()
  }
}

export async function queryOne(text: string, params?: any[]): Promise<any | null> {
  const rows = await query(text, params)
  return rows[0] || null
}

export async function execute(text: string, params?: any[]): Promise<number> {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result.rowCount || 0
  } finally {
    client.release()
  }
}

export default pool
