import Redis from 'ioredis'

// Configuración de Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://redis-nipponflex:6379'
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false'

// Cliente Redis singleton
let redisClient: Redis | null = null

export function getRedis(): Redis | null {
  if (!REDIS_ENABLED) return null

  if (!redisClient) {
    try {
      redisClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
        enableOfflineQueue: false,
        connectTimeout: 5000,
      })

      redisClient.on('error', (err) => {
        console.error('Redis error:', err.message)
      })

      redisClient.on('connect', () => {
        console.log('Redis conectado')
      })
    } catch (error) {
      console.error('Error creando cliente Redis:', error)
      return null
    }
  }
  return redisClient
}

// Cache helpers
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis()
    if (!redis) return null
    const data = await redis.get(key)
    return data ? JSON.parse(data) : null
  } catch (error) {
    // Silenciar errores de conexión durante desarrollo
    return null
  }
}

export async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    await redis.setex(key, ttlSeconds, JSON.stringify(value))
  } catch (error) {
    // Silenciar errores
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    await redis.del(key)
  } catch (error) {
    // Silenciar errores
  }
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    // Silenciar errores
  }
}

// Rate limiting
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  try {
    const redis = getRedis()
    if (!redis) {
      return { allowed: true, remaining: maxRequests, resetIn: windowSeconds }
    }

    const current = await redis.incr(key)

    if (current === 1) {
      await redis.expire(key, windowSeconds)
    }

    const ttl = await redis.ttl(key)

    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetIn: ttl > 0 ? ttl : windowSeconds
    }
  } catch (error) {
    // En caso de error, permitir (fail-open)
    return { allowed: true, remaining: maxRequests, resetIn: windowSeconds }
  }
}

// Session helpers (para futuro uso con NextAuth)
export async function getSession(sessionId: string): Promise<any | null> {
  return getCache(`session:${sessionId}`)
}

export async function setSession(sessionId: string, data: any, ttlSeconds: number = 86400): Promise<void> {
  await setCache(`session:${sessionId}`, data, ttlSeconds)
}

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteCache(`session:${sessionId}`)
}

// Lock distribuido (para evitar race conditions)
export async function acquireLock(
  lockName: string,
  ttlSeconds: number = 30
): Promise<boolean> {
  try {
    const redis = getRedis()
    if (!redis) return true // Si no hay Redis, permitir
    const result = await redis.set(`lock:${lockName}`, '1', 'EX', ttlSeconds, 'NX')
    return result === 'OK'
  } catch (error) {
    return true // Fail-open
  }
}

export async function releaseLock(lockName: string): Promise<void> {
  await deleteCache(`lock:${lockName}`)
}

// Pub/Sub para notificaciones en tiempo real (futuro)
export function getSubscriber(): Redis | null {
  if (!REDIS_ENABLED) return null
  try {
    return new Redis(REDIS_URL)
  } catch {
    return null
  }
}

export function getPublisher(): Redis | null {
  return getRedis()
}

// Health check
export async function redisHealthCheck(): Promise<boolean> {
  try {
    const redis = getRedis()
    if (!redis) return false
    const pong = await redis.ping()
    return pong === 'PONG'
  } catch {
    return false
  }
}
