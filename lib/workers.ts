import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { query, execute } from './db'
import { enviarMensajeWhatsApp } from './evolution'
import type { MensajeWhatsAppJob, RecordatorioJob, CampaniaJob, NotificacionJob } from './queues'

const REDIS_URL = process.env.REDIS_URL || 'redis://redis-nipponflex:6379'
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null })

// ============================================
// WORKER: MENSAJES WHATSAPP
// ============================================

export const mensajesWorker = new Worker<MensajeWhatsAppJob>(
  'mensajes-whatsapp',
  async (job: Job<MensajeWhatsAppJob>) => {
    const { clienteId, numero, mensaje, campaniaId, campaniaContactoId, mediaType, mediaUrl, mediaBase64, mediaMimetype } = job.data as any

    console.log(`[Worker Mensajes] Procesando job ${job.id} para ${numero}${mediaType ? ` (${mediaType})` : ''}`)

    // Verificar límite del cliente
    const cliente = await query(
      `SELECT limite_mensajes_mes, mensajes_usados_mes FROM clientes WHERE id = $1`,
      [clienteId]
    )

    if (cliente[0]) {
      const limite = cliente[0].limite_mensajes_mes || 500
      const usados = cliente[0].mensajes_usados_mes || 0

      if (usados >= limite) {
        throw new Error('Límite mensual de mensajes alcanzado')
      }
    }

    // Obtener instancia WhatsApp
    const instancia = await query(
      `SELECT evolution_instance, evolution_api_key FROM instancias_whatsapp
       WHERE cliente_id = $1 AND estado = 'conectado' LIMIT 1`,
      [clienteId]
    )

    if (!instancia[0]) {
      throw new Error('No hay instancia WhatsApp conectada')
    }

    // Enviar mensaje (con o sin multimedia)
    let resultado
    if (mediaType && (mediaUrl || mediaBase64)) {
      // Enviar con multimedia
      const { enviarMediaWhatsApp } = await import('./evolution')
      resultado = await enviarMediaWhatsApp({
        instancia: instancia[0].evolution_instance,
        apiKey: instancia[0].evolution_api_key || process.env.EVOLUTION_API_KEY || '',
        numero,
        caption: mensaje,
        mediaType,
        mediaUrl,
        mediaBase64,
        mediaMimetype,
      })
    } else {
      // Enviar solo texto
      resultado = await enviarMensajeWhatsApp({
        instancia: instancia[0].evolution_instance,
        apiKey: instancia[0].evolution_api_key || process.env.EVOLUTION_API_KEY || '',
        numero,
        mensaje,
      })
    }

    if (!resultado.success) {
      throw new Error(resultado.error || 'Error enviando mensaje')
    }

    // Actualizar contadores
    await execute(
      `UPDATE clientes SET mensajes_usados_mes = COALESCE(mensajes_usados_mes, 0) + 1 WHERE id = $1`,
      [clienteId]
    )

    // Si es de campaña, actualizar contacto
    if (campaniaContactoId) {
      await execute(
        `UPDATE campania_contactos SET estado = 'enviado', enviado_at = NOW() WHERE id = $1`,
        [campaniaContactoId]
      )
    }

    console.log(`[Worker Mensajes] Job ${job.id} completado`)
    return { success: true, numero }
  },
  {
    connection,
    concurrency: 5, // Procesar 5 mensajes en paralelo
    limiter: {
      max: 30, // Máximo 30 mensajes
      duration: 60000, // Por minuto (para evitar bloqueos de WhatsApp)
    },
  }
)

// ============================================
// WORKER: RECORDATORIOS
// ============================================

export const recordatoriosWorker = new Worker<RecordatorioJob>(
  'recordatorios-citas',
  async (job: Job<RecordatorioJob>) => {
    const { citaId, clienteId, telefono, mensaje, canal } = job.data

    console.log(`[Worker Recordatorios] Procesando cita ${citaId}`)

    // Verificar que la cita sigue pendiente
    const cita = await query(
      `SELECT estado, recordatorio_enviado FROM citas WHERE id = $1`,
      [citaId]
    )

    if (!cita[0] || cita[0].recordatorio_enviado || cita[0].estado === 'cancelada') {
      console.log(`[Worker Recordatorios] Cita ${citaId} ya procesada o cancelada`)
      return { skipped: true }
    }

    if (canal === 'whatsapp') {
      const instancia = await query(
        `SELECT evolution_instance, evolution_api_key FROM instancias_whatsapp
         WHERE cliente_id = $1 AND estado = 'conectado' LIMIT 1`,
        [clienteId]
      )

      if (instancia[0]) {
        const resultado = await enviarMensajeWhatsApp({
          instancia: instancia[0].evolution_instance,
          apiKey: instancia[0].evolution_api_key || process.env.EVOLUTION_API_KEY || '',
          numero: telefono,
          mensaje,
        })

        if (resultado.success) {
          await execute(
            `UPDATE citas SET recordatorio_enviado = true WHERE id = $1`,
            [citaId]
          )
          return { success: true, citaId }
        }
      }
    }

    // TODO: Implementar SMS y Email
    throw new Error(`Canal ${canal} no implementado o sin instancia disponible`)
  },
  {
    connection,
    concurrency: 3,
  }
)

// ============================================
// WORKER: CAMPAÑAS
// ============================================

export const campaniasWorker = new Worker<CampaniaJob>(
  'campanias',
  async (job: Job<CampaniaJob>) => {
    const { campaniaId, clienteId, accion } = job.data

    console.log(`[Worker Campañas] Procesando ${accion} para campaña ${campaniaId}`)

    if (accion === 'procesar') {
      // Obtener campaña
      const campania = await query(
        `SELECT * FROM campanias WHERE id = $1 AND cliente_id = $2`,
        [campaniaId, clienteId]
      )

      if (!campania[0] || campania[0].estado !== 'activa') {
        return { skipped: true, reason: 'Campaña no activa' }
      }

      // Obtener contactos pendientes en ORDEN ALEATORIO
      // Esto evita patrones predecibles (siempre contactar en el mismo orden)
      const contactos = await query(
        `SELECT * FROM campania_contactos
         WHERE campania_id = $1 AND estado = 'pendiente'
         ORDER BY RANDOM() LIMIT $2`,
        [campaniaId, campania[0].contactos_por_dia || 20]
      )

      // Encolar mensajes con delays ALEATORIOS para simular comportamiento humano
      // Esto evita detección de patrones por Meta/WhatsApp
      const { encolarMensajeWhatsApp } = await import('./queues')

      // Configuración de delays aleatorios
      const delayMinMs = (campania[0].delay_min || 30) * 1000 // Mínimo en ms
      const delayMaxMs = (campania[0].delay_max || 90) * 1000 // Máximo en ms

      let acumulatedDelay = 0

      for (let i = 0; i < contactos.length; i++) {
        const contacto = contactos[i] as any

        // Delay aleatorio entre min y max para cada mensaje
        // Añadimos variación adicional (±20%) para más naturalidad
        const baseDelay = delayMinMs + Math.random() * (delayMaxMs - delayMinMs)
        const variation = baseDelay * (0.8 + Math.random() * 0.4) // ±20%
        const randomDelay = Math.floor(variation)

        acumulatedDelay += randomDelay

        const mensaje = (campania[0].mensaje_plantilla || '')
          .replace(/\[NOMBRE\]/gi, contacto.nombre || 'Hola')
          .replace(/\[EMPRESA\]/gi, contacto.empresa || '')

        // Preparar datos del mensaje incluyendo multimedia si existe
        const mensajeData: any = {
          clienteId,
          instanciaId: 0,
          numero: contacto.numero_whatsapp,
          mensaje,
          campaniaId,
          campaniaContactoId: contacto.id,
        }

        // Agregar multimedia si la campaña tiene imagen o audio
        if (campania[0].tipo_media === 'imagen' && (campania[0].media_url || campania[0].media_base64)) {
          mensajeData.mediaType = 'image'
          mensajeData.mediaUrl = campania[0].media_url
          mensajeData.mediaBase64 = campania[0].media_base64
          mensajeData.mediaMimetype = campania[0].media_mimetype
        } else if (campania[0].tipo_media === 'audio' && (campania[0].media_url || campania[0].media_base64)) {
          mensajeData.mediaType = 'audio'
          mensajeData.mediaUrl = campania[0].media_url
          mensajeData.mediaBase64 = campania[0].media_base64
          mensajeData.mediaMimetype = campania[0].media_mimetype
        }

        await encolarMensajeWhatsApp(mensajeData, acumulatedDelay)

        console.log(`[Campaña ${campaniaId}] Contacto ${i + 1}/${contactos.length} programado con delay ${Math.round(acumulatedDelay / 1000)}s`)

        // Marcar como enviando
        await execute(
          `UPDATE campania_contactos SET estado = 'enviando' WHERE id = $1`,
          [contacto.id]
        )
      }

      return { success: true, contactosEncolados: contactos.length }
    }

    return { success: true, accion }
  },
  {
    connection,
    concurrency: 2,
  }
)

// ============================================
// WORKER: NOTIFICACIONES
// ============================================

export const notificacionesWorker = new Worker<NotificacionJob>(
  'notificaciones',
  async (job: Job<NotificacionJob>) => {
    const { tipo, destinatario, asunto, mensaje } = job.data

    console.log(`[Worker Notificaciones] Enviando ${tipo} a ${destinatario}`)

    if (tipo === 'email') {
      const { sendEmail } = await import('./email')
      await sendEmail({
        to: destinatario,
        subject: asunto || 'Notificación NipponFlex',
        html: mensaje,
      })
    }

    // TODO: Implementar push notifications

    return { success: true, tipo }
  },
  {
    connection,
    concurrency: 10,
  }
)

// ============================================
// EVENTOS DE LOS WORKERS
// ============================================

const workers = [mensajesWorker, recordatoriosWorker, campaniasWorker, notificacionesWorker]

workers.forEach(worker => {
  worker.on('completed', (job) => {
    console.log(`[${worker.name}] Job ${job.id} completado`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[${worker.name}] Job ${job?.id} falló:`, err.message)
  })
})

// ============================================
// INICIALIZAR WORKERS
// ============================================

export function initWorkers() {
  console.log('Workers inicializados:', workers.map(w => w.name).join(', '))
}

// Cerrar workers gracefully
export async function closeWorkers() {
  await Promise.all(workers.map(w => w.close()))
}
