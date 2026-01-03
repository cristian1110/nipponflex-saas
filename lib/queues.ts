import { Queue, Worker, Job } from 'bullmq'
import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://redis-nipponflex:6379'
const QUEUES_ENABLED = process.env.REDIS_ENABLED !== 'false'

// Conexión lazy para BullMQ
let connection: Redis | null = null

function getConnection(): Redis | null {
  if (!QUEUES_ENABLED) return null
  if (!connection) {
    try {
      connection = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      })
    } catch {
      return null
    }
  }
  return connection
}

// ============================================
// COLAS DISPONIBLES (LAZY)
// ============================================

let _mensajesQueue: Queue | null = null
let _recordatoriosQueue: Queue | null = null
let _campaniasQueue: Queue | null = null
let _notificacionesQueue: Queue | null = null

export function getMensajesQueue(): Queue | null {
  if (!QUEUES_ENABLED) return null
  const conn = getConnection()
  if (!conn) return null
  if (!_mensajesQueue) {
    _mensajesQueue = new Queue('mensajes-whatsapp', { connection: conn })
  }
  return _mensajesQueue
}

export function getRecordatoriosQueue(): Queue | null {
  if (!QUEUES_ENABLED) return null
  const conn = getConnection()
  if (!conn) return null
  if (!_recordatoriosQueue) {
    _recordatoriosQueue = new Queue('recordatorios-citas', { connection: conn })
  }
  return _recordatoriosQueue
}

export function getCampaniasQueue(): Queue | null {
  if (!QUEUES_ENABLED) return null
  const conn = getConnection()
  if (!conn) return null
  if (!_campaniasQueue) {
    _campaniasQueue = new Queue('campanias', { connection: conn })
  }
  return _campaniasQueue
}

export function getNotificacionesQueue(): Queue | null {
  if (!QUEUES_ENABLED) return null
  const conn = getConnection()
  if (!conn) return null
  if (!_notificacionesQueue) {
    _notificacionesQueue = new Queue('notificaciones', { connection: conn })
  }
  return _notificacionesQueue
}

// Aliases para compatibilidad
export const mensajesQueue = { add: async (...args: any[]) => getMensajesQueue()?.add(...args) }
export const recordatoriosQueue = { add: async (...args: any[]) => getRecordatoriosQueue()?.add(...args) }
export const campaniasQueue = { add: async (...args: any[]) => getCampaniasQueue()?.add(...args) }
export const notificacionesQueue = { add: async (...args: any[]) => getNotificacionesQueue()?.add(...args) }

// ============================================
// FUNCIONES PARA AGREGAR JOBS
// ============================================

export interface MensajeWhatsAppJob {
  clienteId: number
  instanciaId: number
  numero: string
  mensaje: string
  campaniaId?: number
  campaniaContactoId?: number
}

export async function encolarMensajeWhatsApp(data: MensajeWhatsAppJob, delay?: number) {
  const queue = getMensajesQueue()
  if (!queue) return null

  const options: any = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  }

  if (delay) {
    options.delay = delay
  }

  return queue.add('enviar', data, options)
}

export interface RecordatorioJob {
  citaId: number
  clienteId: number
  telefono: string
  mensaje: string
  canal: 'whatsapp' | 'sms' | 'email'
  instanciaId?: number
}

export async function encolarRecordatorio(data: RecordatorioJob, executeAt: Date) {
  const queue = getRecordatoriosQueue()
  if (!queue) return null

  const delay = executeAt.getTime() - Date.now()

  return queue.add('enviar', data, {
    delay: Math.max(0, delay),
    attempts: 2,
    backoff: { type: 'fixed', delay: 60000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  })
}

export interface CampaniaJob {
  campaniaId: number
  clienteId: number
  accion: 'procesar' | 'pausar' | 'reanudar'
}

export async function encolarCampania(data: CampaniaJob) {
  const queue = getCampaniasQueue()
  if (!queue) return null

  return queue.add(data.accion, data, {
    attempts: 3,
    removeOnComplete: 20,
    removeOnFail: 50,
  })
}

export interface NotificacionJob {
  tipo: 'email' | 'push' | 'sistema'
  destinatario: string
  asunto?: string
  mensaje: string
  datos?: Record<string, any>
}

export async function encolarNotificacion(data: NotificacionJob) {
  const queue = getNotificacionesQueue()
  if (!queue) return null

  return queue.add(data.tipo, data, {
    attempts: 3,
    removeOnComplete: 100,
  })
}

// ============================================
// ESTADÍSTICAS DE COLAS
// ============================================

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

const emptyStats: QueueStats = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }

export async function getQueueStats(queue: Queue | null): Promise<QueueStats> {
  if (!queue) return emptyStats

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ])

  return { waiting, active, completed, failed, delayed }
}

export async function getAllQueuesStats() {
  if (!QUEUES_ENABLED) {
    return {
      mensajes: emptyStats,
      recordatorios: emptyStats,
      campanias: emptyStats,
      notificaciones: emptyStats,
    }
  }

  const [mensajes, recordatorios, campanias, notificaciones] = await Promise.all([
    getQueueStats(getMensajesQueue()),
    getQueueStats(getRecordatoriosQueue()),
    getQueueStats(getCampaniasQueue()),
    getQueueStats(getNotificacionesQueue()),
  ])

  return { mensajes, recordatorios, campanias, notificaciones }
}

// ============================================
// HEALTH CHECK
// ============================================

export async function queuesHealthCheck(): Promise<boolean> {
  if (!QUEUES_ENABLED) return false

  try {
    const queue = getMensajesQueue()
    if (!queue) return false
    await queue.getWaitingCount()
    return true
  } catch {
    return false
  }
}
