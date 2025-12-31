import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const campanas = await query(
      `SELECT * FROM campanas WHERE cliente_id = $1 ORDER BY created_at DESC`,
      [user.cliente_id]
    )
    return NextResponse.json(campanas)
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.nivel < 3) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await request.json()
    const { nombre, tipo, canal, mensaje_template, variables, fecha_programada } = body

    const campana = await queryOne(
      `INSERT INTO campanas (cliente_id, nombre, tipo, estado, mensaje_template, variables, canal, total_destinatarios, enviados, entregados, leidos, respondidos, fecha_programada)
       VALUES ($1, $2, $3, 'borrador', $4, $5, $6, 0, 0, 0, 0, 0, $7)
       RETURNING *`,
      [user.cliente_id, nombre, tipo || 'broadcast', mensaje_template, variables ? JSON.stringify(variables) : null, canal || 'whatsapp', fecha_programada]
    )
    return NextResponse.json(campana, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
