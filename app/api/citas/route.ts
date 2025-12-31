import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import type { Cita } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const estado = searchParams.get('estado')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    let sql = `
      SELECT c.*, l.nombre as lead_nombre, l.telefono as lead_telefono, u.nombre as usuario_nombre
      FROM citas c
      LEFT JOIN leads l ON c.lead_id = l.id
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.cliente_id = $1
    `
    const params: any[] = [user.cliente_id || 1]

    if (estado) {
      params.push(estado)
      sql += ` AND c.estado = $${params.length}`
    }

    if (desde) {
      params.push(desde)
      sql += ` AND c.fecha_inicio >= $${params.length}`
    }

    if (hasta) {
      params.push(hasta)
      sql += ` AND c.fecha_inicio <= $${params.length}`
    }

    sql += ` ORDER BY c.fecha_inicio ASC`

    const citas = await query<Cita>(sql, params)

    return NextResponse.json(citas)
  } catch (error) {
    console.error('Error fetching citas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const data = await request.json()
    const { titulo, descripcion, fecha_inicio, fecha_fin, lead_id, tipo, ubicacion } = data

    if (!titulo || !fecha_inicio) {
      return NextResponse.json(
        { error: 'Título y fecha de inicio son requeridos' },
        { status: 400 }
      )
    }

    const result = await query<Cita>(
      `INSERT INTO citas (cliente_id, usuario_id, lead_id, titulo, descripcion, fecha_inicio, fecha_fin, tipo, ubicacion, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente')
       RETURNING *`,
      [
        user.cliente_id || 1,
        user.id,
        lead_id || null,
        titulo,
        descripcion || null,
        fecha_inicio,
        fecha_fin || fecha_inicio,
        tipo || 'reunion',
        ubicacion || null,
      ]
    )

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Error creating cita:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
