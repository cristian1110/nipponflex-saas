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

    const body = await request.json().catch(() => ({}))
    const minutosAntes = body.minutos_antes || 120 // Por defecto 2 horas antes

    // Buscar citas que necesitan recordatorio:
    // - Estado pendiente o confirmada
    // - Recordatorio no enviado
    // - Fecha/hora en los próximos X minutos
    // - Tienen teléfono asociado (del lead o directo)
    const citasPendientes = await query(`
      SELECT
        c.id, c.titulo, c.fecha_inicio, c.recordatorio_canal,
        c.telefono_recordatorio,
        l.telefono as lead_telefono, l.nombre as lead_nombre,
        cl.id as cliente_id,
        iw.evolution_instance, iw.evolution_api_key
      FROM citas c
      LEFT JOIN leads l ON c.lead_id = l.id
      JOIN clientes cl ON c.cliente_id = cl.id
      LEFT JOIN instancias_whatsapp iw ON iw.cliente_id = cl.id AND iw.estado = 'conectado'
      WHERE c.estado IN ('pendiente', 'confirmada')
        AND c.recordatorio_enviado = false
        AND c.fecha_inicio > NOW()
        AND c.fecha_inicio <= NOW() + INTERVAL '${minutosAntes} minutes'
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

      // Formatear fecha y hora
      const fechaCita = new Date(cita.fecha_inicio)
      const fechaFormateada = fechaCita.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      })
      const horaFormateada = fechaCita.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      })

      // Construir mensaje de recordatorio
      const nombreCliente = cita.lead_nombre || 'Estimado cliente'
      const mensaje = `🔔 *Recordatorio de Cita*

Hola ${nombreCliente},

Te recordamos que tienes una cita programada:

📅 *${cita.titulo}*
🗓️ Fecha: ${fechaFormateada}
⏰ Hora: ${horaFormateada}

Por favor, confirma tu asistencia respondiendo a este mensaje.

¡Te esperamos!`

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
  const pendientes = await queryOne(`
    SELECT COUNT(*) as total
    FROM citas
    WHERE estado IN ('pendiente', 'confirmada')
      AND recordatorio_enviado = false
      AND fecha_inicio > NOW()
      AND fecha_inicio <= NOW() + INTERVAL '2 hours'
  `)

  return NextResponse.json({
    status: 'Worker recordatorios activo',
    citas_pendientes_recordatorio: parseInt(pendientes?.total || '0'),
    timestamp: new Date().toISOString()
  })
}
