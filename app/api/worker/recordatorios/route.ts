import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { enviarMensajeWhatsApp } from '@/lib/evolution'

export const dynamic = 'force-dynamic'

// Worker para enviar recordatorios de citas
// Se ejecuta via cron cada 5 minutos
export async function POST(request: NextRequest) {
  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization')
    const workerToken = process.env.WORKER_SECRET || 'nipponflex-worker-2024'

    if (authHeader !== `Bearer ${workerToken}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Buscar citas que necesitan recordatorio:
    // - Estado pendiente o confirmada
    // - Recordatorio no enviado
    // - Recordatorio configurado (recordatorio_minutos > 0)
    // - Fecha/hora está dentro del tiempo de recordatorio (usando zona horaria del cliente)
    // - Tienen teléfono asociado (del lead o directo)
    // IMPORTANTE: La comparación se hace en la zona horaria del cliente
    const citasPendientes = await query(`
      SELECT
        c.id, c.titulo, c.fecha_inicio, c.recordatorio_canal,
        c.telefono_recordatorio, c.recordatorio_minutos,
        c.recordatorio_mensaje,
        l.telefono as lead_telefono, l.nombre as lead_nombre,
        cl.id as cliente_id,
        cl.zona_horaria,
        cl.idioma,
        iw.evolution_instance, iw.evolution_api_key
      FROM citas c
      LEFT JOIN leads l ON c.lead_id = l.id
      JOIN clientes cl ON c.cliente_id = cl.id
      LEFT JOIN instancias_whatsapp iw ON iw.cliente_id = cl.id AND iw.estado = 'conectado'
      WHERE c.estado IN ('pendiente', 'confirmada')
        AND c.recordatorio_enviado = false
        AND COALESCE(c.recordatorio_activo, true) = true
        AND COALESCE(c.recordatorio_minutos, 120) > 0
        AND c.fecha_inicio > (NOW() AT TIME ZONE COALESCE(cl.zona_horaria, 'America/Guayaquil'))
        AND c.fecha_inicio <= (NOW() AT TIME ZONE COALESCE(cl.zona_horaria, 'America/Guayaquil')) + (COALESCE(c.recordatorio_minutos, 120) || ' minutes')::interval
        AND (c.telefono_recordatorio IS NOT NULL OR l.telefono IS NOT NULL)
      ORDER BY c.fecha_inicio
      LIMIT 20
    `)

    console.log(`Recordatorios: ${citasPendientes.length} citas encontradas`)

    const resultados = {
      enviados: 0,
      errores: 0,
      detalles: [] as any[]
    }

    for (const cita of citasPendientes) {
      const telefono = cita.telefono_recordatorio || cita.lead_telefono
      const canal = cita.recordatorio_canal || 'whatsapp'

      if (!telefono) {
        resultados.detalles.push({ cita_id: cita.id, error: 'Sin teléfono' })
        continue
      }

      // Formatear fecha y hora en la zona horaria e idioma del cliente
      const fechaCita = new Date(cita.fecha_inicio)
      const zonaHoraria = cita.zona_horaria || 'America/Guayaquil'
      const idioma = cita.idioma || 'es'

      // Mapeo de códigos de idioma a locales completos
      const localeMap: Record<string, string> = {
        'es': 'es-ES',
        'en': 'en-US',
        'pt': 'pt-BR'
      }
      const locale = localeMap[idioma] || 'es-ES'

      const fechaFormateada = fechaCita.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: zonaHoraria
      })
      const horaFormateada = fechaCita.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: zonaHoraria
      })

      // Construir mensaje de recordatorio
      const nombreCliente = cita.lead_nombre || 'Estimado cliente'
      let mensaje: string

      if (cita.recordatorio_mensaje) {
        // Usar mensaje personalizado con variables
        mensaje = cita.recordatorio_mensaje
          .replace(/\[TITULO\]/gi, cita.titulo)
          .replace(/\[FECHA\]/gi, fechaFormateada)
          .replace(/\[HORA\]/gi, horaFormateada)
          .replace(/\[NOMBRE\]/gi, nombreCliente)
      } else {
        // Mensaje por defecto
        mensaje = `🔔 *Recordatorio de Cita*

Hola ${nombreCliente},

Te recordamos que tienes una cita programada:

📅 *${cita.titulo}*
🗓️ Fecha: ${fechaFormateada}
⏰ Hora: ${horaFormateada}

Por favor, confirma tu asistencia respondiendo a este mensaje.

¡Te esperamos!`
      }

      try {
        if (canal === 'whatsapp' && cita.evolution_instance) {
          const resultado = await enviarMensajeWhatsApp({
            instancia: cita.evolution_instance,
            apiKey: cita.evolution_api_key || process.env.EVOLUTION_API_KEY || '',
            numero: telefono,
            mensaje,
          })

          if (resultado.success) {
            // Marcar recordatorio como enviado
            await execute(
              `UPDATE citas SET recordatorio_enviado = true, updated_at = NOW() WHERE id = $1`,
              [cita.id]
            )

            // Guardar en historial de conversaciones
            await query(
              `INSERT INTO historial_conversaciones (cliente_id, numero_whatsapp, rol, mensaje)
               VALUES ($1, $2, 'assistant', $3)`,
              [cita.cliente_id, telefono, mensaje]
            )

            resultados.enviados++
            resultados.detalles.push({
              cita_id: cita.id,
              telefono,
              estado: 'enviado'
            })
          } else {
            resultados.errores++
            resultados.detalles.push({
              cita_id: cita.id,
              error: resultado.error
            })
          }
        } else {
          // Canal no soportado o sin instancia WhatsApp
          resultados.detalles.push({
            cita_id: cita.id,
            error: 'Canal no disponible o WhatsApp no conectado'
          })
        }
      } catch (error) {
        console.error('Error enviando recordatorio:', error)
        resultados.errores++
        resultados.detalles.push({
          cita_id: cita.id,
          error: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }

    return NextResponse.json({
      success: true,
      ...resultados
    })

  } catch (error) {
    console.error('Error worker recordatorios:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// GET para verificar estado del worker
export async function GET() {
  // Contar citas pendientes de recordatorio considerando zona horaria de cada cliente
  const pendientes = await queryOne(`
    SELECT COUNT(*) as total
    FROM citas c
    JOIN clientes cl ON c.cliente_id = cl.id
    WHERE c.estado IN ('pendiente', 'confirmada')
      AND c.recordatorio_enviado = false
      AND COALESCE(c.recordatorio_activo, true) = true
      AND COALESCE(c.recordatorio_minutos, 120) > 0
      AND c.fecha_inicio > (NOW() AT TIME ZONE COALESCE(cl.zona_horaria, 'America/Guayaquil'))
      AND c.fecha_inicio <= (NOW() AT TIME ZONE COALESCE(cl.zona_horaria, 'America/Guayaquil')) + (COALESCE(c.recordatorio_minutos, 120) || ' minutes')::interval
  `)

  return NextResponse.json({
    status: 'Worker recordatorios activo',
    citas_pendientes_recordatorio: parseInt(pendientes?.total || '0'),
    timestamp: new Date().toISOString(),
    server_time_utc: new Date().toISOString()
  })
}
