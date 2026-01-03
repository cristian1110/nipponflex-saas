import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const workerToken = process.env.WORKER_SECRET || 'nipponflex-worker-2024'
    
    if (authHeader !== `Bearer ${workerToken}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const limite = body.limite || 10
    
    const procesados: any[] = []
    const errores: any[] = []
    const bloqueados: any[] = []

    const mensajes = await query(`
      SELECT cm.*, iw.evolution_instance, iw.evolution_api_key,
             cm.tipo_media, cm.media_url, cm.media_base64, cm.media_mimetype
      FROM cola_mensajes cm
      LEFT JOIN instancias_whatsapp iw ON cm.instancia_id = iw.id
      WHERE cm.estado = 'pendiente'
        AND cm.programado_para <= NOW()
        AND cm.intentos < cm.max_intentos
      ORDER BY cm.prioridad ASC, cm.programado_para ASC
      LIMIT $1
    `, [limite])

    for (const msg of mensajes as any[]) {
      try {
        // Verificar límite del cliente antes de enviar
        const cliente = await queryOne(`
          SELECT id, limite_mensajes_mes, mensajes_usados_mes, 
                 alerta_80_enviada, alerta_100_enviada, plan
          FROM clientes WHERE id = $1
        `, [msg.cliente_id])

        if (cliente) {
          const limiteMes = cliente.limite_mensajes_mes || 500
          const usadoMes = cliente.mensajes_usados_mes || 0

          // Si excede límite, marcar como error y no enviar
          if (usadoMes >= limiteMes) {
            await query(`
              UPDATE cola_mensajes 
              SET estado = 'error', error_mensaje = 'Límite mensual alcanzado' 
              WHERE id = $1
            `, [msg.id])
            
            bloqueados.push({ id: msg.id, cliente_id: msg.cliente_id, razon: 'limite_alcanzado' })
            
            // Crear alerta si no existe
            if (!cliente.alerta_100_enviada) {
              await query(`
                INSERT INTO alertas_uso (cliente_id, tipo, porcentaje, mensaje)
                VALUES ($1, 'limite', 100, 'Límite de mensajes alcanzado. Actualiza tu plan.')
              `, [msg.cliente_id])
              await query(`UPDATE clientes SET alerta_100_enviada = true WHERE id = $1`, [msg.cliente_id])
            }
            continue
          }

          // Alerta al 80%
          const porcentaje = Math.round(((usadoMes + 1) / limiteMes) * 100)
          if (porcentaje >= 80 && !cliente.alerta_80_enviada) {
            await query(`
              INSERT INTO alertas_uso (cliente_id, tipo, porcentaje, mensaje)
              VALUES ($1, 'advertencia', 80, $2)
            `, [msg.cliente_id, `Has usado 80% de tus mensajes (${usadoMes}/${limiteMes})`])
            await query(`UPDATE clientes SET alerta_80_enviada = true WHERE id = $1`, [msg.cliente_id])
          }
        }

        // Marcar como procesando
        await query(`UPDATE cola_mensajes SET estado = 'procesando', intentos = intentos + 1 WHERE id = $1`, [msg.id])

        // Enviar mensaje
        const enviado = await enviarMensaje(msg)

        if (enviado.success) {
          await query(`UPDATE cola_mensajes SET estado = 'enviado', enviado_at = NOW() WHERE id = $1`, [msg.id])
          
          // Actualizar contadores
          if (msg.instancia_id) {
            await query(`UPDATE instancias_whatsapp SET mensajes_dia_enviados = mensajes_dia_enviados + 1 WHERE id = $1`, [msg.instancia_id])
          }
          
          // Actualizar contador mensual del cliente
          await query(`UPDATE clientes SET mensajes_usados_mes = COALESCE(mensajes_usados_mes, 0) + 1 WHERE id = $1`, [msg.cliente_id])

          // Actualizar contacto de campaña si aplica
          if (msg.campania_contacto_id) {
            await query(`UPDATE campania_contactos SET estado = 'enviado', enviado_at = NOW() WHERE id = $1`, [msg.campania_contacto_id])
          }

          // Actualizar métricas
          await query(`
            INSERT INTO metricas_realtime (cliente_id, instancia_id, fecha, hora, mensajes_enviados)
            VALUES ($1, $2, CURRENT_DATE, EXTRACT(HOUR FROM NOW()), 1)
            ON CONFLICT (cliente_id, instancia_id, fecha, hora)
            DO UPDATE SET mensajes_enviados = metricas_realtime.mensajes_enviados + 1
          `, [msg.cliente_id, msg.instancia_id])

          procesados.push({ id: msg.id, numero: msg.numero_destino })
        } else {
          throw new Error(enviado.error)
        }
      } catch (error: any) {
        await query(`
          UPDATE cola_mensajes 
          SET estado = CASE WHEN intentos >= max_intentos THEN 'error' ELSE 'pendiente' END,
              error_mensaje = $2
          WHERE id = $1
        `, [msg.id, error.message])
        errores.push({ id: msg.id, error: error.message })
      }
    }

    return NextResponse.json({ 
      procesados: procesados.length, 
      errores: errores.length,
      bloqueados: bloqueados.length,
      detalles: { procesados, errores, bloqueados } 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function enviarMensaje(msg: any): Promise<{ success: boolean; error?: string }> {
  try {
    const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://api-osg880kgc8wkwgogkwo0w0c4:8080'
    const evolutionKey = msg.evolution_api_key || process.env.EVOLUTION_API_KEY
    const evolutionInstance = msg.evolution_instance || process.env.EVOLUTION_INSTANCE || 'nipponflex'

    if (!evolutionKey) {
      return { success: false, error: 'API Key no configurada' }
    }

    const tipoMedia = msg.tipo_media || 'texto'

    // Enviar según tipo de media
    if (tipoMedia === 'imagen' || tipoMedia === 'image') {
      const body: any = {
        number: msg.numero_destino,
        caption: msg.mensaje || '',
        mediatype: 'image',
      }

      if (msg.media_url) {
        body.media = msg.media_url
      } else if (msg.media_base64) {
        // Evolution API espera base64 puro, sin el prefijo data:...
        const base64Pure = msg.media_base64.includes('base64,')
          ? msg.media_base64.split('base64,')[1]
          : msg.media_base64
        body.media = base64Pure
        body.mimetype = msg.media_mimetype || 'image/jpeg'
      }

      const response = await fetch(`${evolutionUrl}/message/sendMedia/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: `Error imagen: ${response.status} - ${errorText}` }
      }
      return { success: true }

    } else if (tipoMedia === 'audio') {
      const body: any = {
        number: msg.numero_destino,
      }

      if (msg.media_url) {
        body.audio = msg.media_url
      } else if (msg.media_base64) {
        // Evolution API espera base64 puro
        const base64Pure = msg.media_base64.includes('base64,')
          ? msg.media_base64.split('base64,')[1]
          : msg.media_base64
        body.audio = base64Pure
      }

      const response = await fetch(`${evolutionUrl}/message/sendWhatsAppAudio/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: `Error audio: ${response.status} - ${errorText}` }
      }
      return { success: true }

    } else {
      // Texto normal
      const response = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
        body: JSON.stringify({ number: msg.numero_destino, text: msg.mensaje })
      })

      if (!response.ok) {
        return { success: false, error: `Error: ${response.status}` }
      }
      return { success: true }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
