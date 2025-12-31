import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import type { Conversacion } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const busqueda = searchParams.get('q')
    const canal = searchParams.get('canal')
    const limite = parseInt(searchParams.get('limite') || '50')

    let sql = `
      SELECT 
        numero_whatsapp,
        nombre,
        ultimo_mensaje,
        ultimo_rol,
        fecha_ultimo,
        total_mensajes,
        canal,
        sin_leer,
        asignado_a,
        u.nombre as asignado_nombre
      FROM (
        SELECT 
          m.numero_whatsapp,
          COALESCE(l.nombre, m.numero_whatsapp) as nombre,
          FIRST_VALUE(m.mensaje) OVER (PARTITION BY m.numero_whatsapp ORDER BY m.created_at DESC) as ultimo_mensaje,
          FIRST_VALUE(m.rol) OVER (PARTITION BY m.numero_whatsapp ORDER BY m.created_at DESC) as ultimo_rol,
          MAX(m.created_at) as fecha_ultimo,
          COUNT(*) as total_mensajes,
          COALESCE(m.canal, 'whatsapp') as canal,
          SUM(CASE WHEN m.leido = false AND m.rol = 'user' THEN 1 ELSE 0 END) as sin_leer,
          l.asignado_a
        FROM mensajes m
        LEFT JOIN leads l ON m.numero_whatsapp = l.telefono
        WHERE m.cliente_id = $1
        GROUP BY m.numero_whatsapp, l.nombre, m.canal, l.asignado_a, m.mensaje, m.rol, m.created_at
      ) sub
      LEFT JOIN usuarios u ON sub.asignado_a = u.id
      WHERE 1=1
    `
    const params: any[] = [user.cliente_id || 1]

    if (busqueda) {
      params.push(`%${busqueda}%`)
      sql += ` AND (nombre ILIKE $${params.length} OR numero_whatsapp ILIKE $${params.length})`
    }

    if (canal) {
      params.push(canal)
      sql += ` AND canal = $${params.length}`
    }

    sql += ` ORDER BY fecha_ultimo DESC LIMIT ${limite}`

    const conversaciones = await query<Conversacion>(sql, params)

    return NextResponse.json(conversaciones)
  } catch (error) {
    console.error('Error fetching conversaciones:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
