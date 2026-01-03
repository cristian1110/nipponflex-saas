import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { redisHealthCheck } from '@/lib/redis'
import { getAllQueuesStats, queuesHealthCheck } from '@/lib/queues'
import { ragHealthCheck, ragStats } from '@/lib/rag'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {}
  }

  // Check PostgreSQL
  try {
    await queryOne('SELECT 1')
    checks.services.postgresql = { status: 'ok' }
  } catch (error) {
    checks.services.postgresql = { status: 'error', message: (error as Error).message }
    checks.status = 'degraded'
  }

  // Check Redis
  try {
    const redisOk = await redisHealthCheck()
    checks.services.redis = { status: redisOk ? 'ok' : 'error' }
    if (!redisOk) checks.status = 'degraded'
  } catch (error) {
    checks.services.redis = { status: 'error', message: (error as Error).message }
    checks.status = 'degraded'
  }

  // Check Queues
  try {
    const queuesOk = await queuesHealthCheck()
    if (queuesOk) {
      const stats = await getAllQueuesStats()
      checks.services.queues = { status: 'ok', stats }
    } else {
      checks.services.queues = { status: 'error' }
      checks.status = 'degraded'
    }
  } catch (error) {
    checks.services.queues = { status: 'error', message: (error as Error).message }
  }

  // Check Qdrant (RAG)
  try {
    const qdrantOk = await ragHealthCheck()
    if (qdrantOk) {
      const stats = await ragStats()
      checks.services.qdrant = { status: 'ok', stats }
    } else {
      checks.services.qdrant = { status: 'unavailable' }
    }
  } catch (error) {
    checks.services.qdrant = { status: 'error', message: (error as Error).message }
  }

  // Memory usage
  const memUsage = process.memoryUsage()
  checks.memory = {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
    rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
  }

  return NextResponse.json(checks)
}
