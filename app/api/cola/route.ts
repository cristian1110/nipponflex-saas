import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Ver cola de mensajes del cliente
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado') || 'pendiente'
    const limit = parseInt(searchParams.get('limit') || '50')

    const mensajes = await query(`
      SELECT 
        cm.*,
        c.nombre as campania_nombre,
        i.nombre as instancia_nombre,
        i.numero_whatsapp as instancia_numero
      FROM cola_mensajes cm
      LEFT JOIN campanias c ON cm.campania_id = c.id
      LEFT JOIN instancias_whatsapp i ON cm.instancia_id = i.id
      WHERE cm.cliente_id = $1
        AND ($2 = 'todos' OR cm.estado = $2)
      ORDER BY cm.prioridad ASC, cm.programado_para ASC
      LIMIT $3
    `, [user.cliente_id, estado, limit])

    // Estadísticas
    const stats = await queryOne(`
      SELECT 
        COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
        COUNT(*) FILTER (WHERE estado = 'procesando') as procesando,
        COUNT(*) FILTER (WHERE estado = 'enviado') as enviados,
        COUNT(*) FILTER (WHERE estado = 'error') as errores
      FROM cola_mensajes
      WHERE cliente_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
    `, [user.cliente_id])

    return NextResponse.json({ mensajes, stats })
  } catch (error) {
    console.error('Error cola:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Encolar mensaje manualmente
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await request.json()
    const { numero_destino, mensaje, instancia_id, prioridad = 5 } = data

    if (!numero_destino || !mensaje) {
      return NextResponse.json({ error: 'Número y mensaje requeridos' }, { status: 400 })
    }

    // Verificar rate limit
    const rateLimit = await queryOne(`
      SELECT * FROM rate_limits
      WHERE cliente_id = $1 AND tipo = 'mensajes_hora'
    `, [user.cliente_id])

    if (rateLimit && rateLimit.contador >= rateLimit.limite) {
      return NextResponse.json({ 
        error: 'Límite de mensajes por hora alcanzado. Intenta más tarde.' 
      }, { status: 429 })
    }

    const mensaje_cola = await queryOne(`
      INSERT INTO cola_mensajes (
        cliente_id, instancia_id, tipo, numero_destino, mensaje, prioridad
      ) VALUES ($1, $2, 'saliente', $3, $4, $5)
      RETURNING *
    `, [user.cliente_id, instancia_id, numero_destino, mensaje, prioridad])

    return NextResponse.json(mensaje_cola)
  } catch (error) {
    console.error('Error encolar:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
