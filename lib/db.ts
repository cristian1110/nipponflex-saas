import { Pool, QueryResult } from 'pg'
import { getCache, setCache, deleteCache, deleteCachePattern } from './redis'

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

// ============================================
// QUERIES CON CACHE
// ============================================

// Query con cache automático
export async function queryCached<T>(
  cacheKey: string,
  text: string,
  params?: any[],
  ttlSeconds: number = 300
): Promise<T[]> {
  // Intentar obtener de cache
  const cached = await getCache<T[]>(cacheKey)
  if (cached) {
    return cached
  }

  // Si no está en cache, ejecutar query
  const result = await query(text, params)

  // Guardar en cache
  await setCache(cacheKey, result, ttlSeconds)

  return result as T[]
}

// Query one con cache
export async function queryOneCached<T>(
  cacheKey: string,
  text: string,
  params?: any[],
  ttlSeconds: number = 300
): Promise<T | null> {
  const cached = await getCache<T>(cacheKey)
  if (cached) {
    return cached
  }

  const result = await queryOne(text, params)

  if (result) {
    await setCache(cacheKey, result, ttlSeconds)
  }

  return result as T | null
}

// Invalidar cache de una entidad
export async function invalidateCache(pattern: string): Promise<void> {
  await deleteCachePattern(pattern)
}

// ============================================
// CACHE KEYS HELPERS
// ============================================

export const cacheKeys = {
  cliente: (id: number) => `cliente:${id}`,
  clientePlanes: (id: number) => `cliente:${id}:plan`,
  agente: (id: number) => `agente:${id}`,
  agenteByCliente: (clienteId: number) => `cliente:${clienteId}:agentes`,
  conocimientos: (agenteId: number) => `agente:${agenteId}:conocimientos`,
  pipelines: (clienteId: number) => `cliente:${clienteId}:pipelines`,
  etapas: (pipelineId: number) => `pipeline:${pipelineId}:etapas`,
}

export default pool
