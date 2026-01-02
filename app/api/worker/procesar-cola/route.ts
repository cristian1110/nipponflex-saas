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

    const mensajes = await query(`
      SELECT cm.*, iw.evolution_instance, iw.evolution_api_key
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
        await query(`UPDATE cola_mensajes SET estado = 'procesando', intentos = intentos + 1 WHERE id = $1`, [msg.id])

        const enviado = await enviarMensaje(msg)

        if (enviado.success) {
          await query(`UPDATE cola_mensajes SET estado = 'enviado', enviado_at = NOW() WHERE id = $1`, [msg.id])
          
          if (msg.instancia_id) {
            await query(`UPDATE instancias_whatsapp SET mensajes_dia_enviados = mensajes_dia_enviados + 1 WHERE id = $1`, [msg.instancia_id])
          }

          if (msg.campania_contacto_id) {
            await query(`UPDATE campania_contactos SET estado = 'enviado', enviado_at = NOW() WHERE id = $1`, [msg.campania_contacto_id])
          }

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

    return NextResponse.json({ procesados: procesados.length, errores: errores.length, detalles: { procesados, errores } })
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

    const response = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
      body: JSON.stringify({ number: msg.numero_destino, text: msg.mensaje })
    })

    if (!response.ok) {
      return { success: false, error: `Error: ${response.status}` }
    }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
