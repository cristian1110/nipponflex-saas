import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const EVOLUTION_URL = 'https://evolution-api-nipponflex.84.247.166.88.sslip.io'
const EVOLUTION_KEY = 'FsaZvcT2t2Fv1pc0cmm00QsEQNkIEMSc'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { numero_whatsapp, mensaje } = body

    if (!numero_whatsapp || !mensaje) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // Formatear número
    let numero = numero_whatsapp.replace(/\s/g, '').replace(/[^0-9+]/g, '')
    if (numero.startsWith('+')) numero = numero.substring(1)
    if (!numero.includes('@')) numero = numero + '@s.whatsapp.net'

    console.log('Enviando mensaje a:', numero)

    // Enviar por Evolution API
    const res = await fetch(`${EVOLUTION_URL}/message/sendText/nipponflex`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: numero,
        text: mensaje
      })
    })

    const data = await res.json()
    console.log('Respuesta Evolution:', data)

    if (!res.ok) {
      return NextResponse.json({ error: 'Error al enviar mensaje', details: data }, { status: 500 })
    }

    // Guardar en historial
    try {
      await query(
        `INSERT INTO historial_conversaciones (cliente_id, numero_whatsapp, mensaje, rol, created_at)
         VALUES ($1, $2, $3, 'assistant', NOW())`,
        [user.cliente_id, numero_whatsapp.replace('@s.whatsapp.net', ''), mensaje]
      )
    } catch (e) {
      console.error('Error guardando historial:', e)
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error enviar mensaje:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const numero = searchParams.get('numero')

    if (numero) {
      const mensajes = await query(
        `SELECT * FROM historial_conversaciones 
         WHERE cliente_id = $1 AND numero_whatsapp = $2 
         ORDER BY created_at ASC`,
        [user.cliente_id, numero]
      )
      return NextResponse.json(mensajes)
    }

    return NextResponse.json([])
  } catch (error) {
    console.error('Error mensajes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
