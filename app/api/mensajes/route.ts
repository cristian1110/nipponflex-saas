import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const numero = searchParams.get('numero')

    if (!numero) {
      return NextResponse.json({ error: 'Número requerido' }, { status: 400 })
    }

    const mensajes = await query(
      `SELECT * FROM mensajes WHERE cliente_id = $1 AND numero_whatsapp = $2 ORDER BY created_at ASC`,
      [user.cliente_id, numero]
    )

    // Marcar como leídos
    await execute(
      `UPDATE mensajes SET leido = true WHERE cliente_id = $1 AND numero_whatsapp = $2 AND leido = false`,
      [user.cliente_id, numero]
    )

    return NextResponse.json(mensajes)
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { numero_whatsapp, mensaje, canal } = body

    // Guardar mensaje en BD
    const nuevoMensaje = await queryOne(
      `INSERT INTO mensajes (cliente_id, numero_whatsapp, rol, mensaje, tipo, canal, leido)
       VALUES ($1, $2, 'assistant', $3, 'text', $4, true)
       RETURNING *`,
      [user.cliente_id, numero_whatsapp, mensaje, canal || 'whatsapp']
    )

    // Enviar a Evolution API
    const integracion = await queryOne(
      `SELECT config FROM integraciones WHERE cliente_id = $1 AND tipo = 'whatsapp' AND activo = true`,
      [user.cliente_id]
    )

    if (integracion) {
      try {
        const config = typeof integracion.config === 'string' ? JSON.parse(integracion.config) : integracion.config
        const evolutionUrl = config.evolution_api_url || process.env.EVOLUTION_API_URL
        const apiKey = config.api_key || process.env.EVOLUTION_API_KEY
        const instancia = config.instancia || process.env.EVOLUTION_INSTANCE

        if (evolutionUrl && apiKey && instancia) {
          await fetch(`${evolutionUrl}/message/sendText/${instancia}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
            },
            body: JSON.stringify({
              number: numero_whatsapp,
              text: mensaje,
            }),
          })
        }
      } catch (e) {
        console.error('Error enviando a WhatsApp:', e)
      }
    }

    // Incrementar contador de mensajes del cliente
    await execute(
      `UPDATE clientes SET mensajes_usados = mensajes_usados + 1 WHERE id = $1`,
      [user.cliente_id]
    )

    return NextResponse.json(nuevoMensaje, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
