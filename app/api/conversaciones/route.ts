import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const numero = searchParams.get('numero')

    if (numero) {
      // Obtener mensajes de una conversación específica
      const mensajes = await query(
        `SELECT * FROM historial_conversaciones 
         WHERE cliente_id = $1 AND numero_whatsapp = $2 
         ORDER BY created_at ASC`,
        [user.cliente_id, numero]
      )
      return NextResponse.json(mensajes)
    }

    // Obtener lista de conversaciones
    const conversaciones = await query(
      `SELECT 
        h.numero_whatsapp,
        MAX(h.created_at) as ultimo_mensaje,
        COUNT(*) as total_mensajes,
        (SELECT mensaje FROM historial_conversaciones h2 
         WHERE h2.numero_whatsapp = h.numero_whatsapp AND h2.cliente_id = h.cliente_id 
         ORDER BY created_at DESC LIMIT 1) as ultimo_texto,
        (SELECT rol FROM historial_conversaciones h2 
         WHERE h2.numero_whatsapp = h.numero_whatsapp AND h2.cliente_id = h.cliente_id 
         ORDER BY created_at DESC LIMIT 1) as ultimo_rol,
        l.nombre as lead_nombre,
        l.id as lead_id
       FROM historial_conversaciones h
       LEFT JOIN leads l ON l.telefono = h.numero_whatsapp AND l.cliente_id = h.cliente_id
       WHERE h.cliente_id = $1
       GROUP BY h.numero_whatsapp, h.cliente_id, l.nombre, l.id
       ORDER BY MAX(h.created_at) DESC`,
      [user.cliente_id]
    )
    return NextResponse.json(conversaciones)
  } catch (error) {
    console.error('Error conversaciones:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
