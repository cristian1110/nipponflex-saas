import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.nivel < 4) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const integraciones = await query(
      `SELECT id, tipo, nombre, activo, ultimo_sync, created_at FROM integraciones WHERE cliente_id = $1`,
      [user.cliente_id]
    )
    return NextResponse.json(integraciones)
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.nivel < 4) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await request.json()
    const { tipo, nombre, config } = body

    // Upsert - actualiza si existe, inserta si no
    const existing = await queryOne(
      `SELECT id FROM integraciones WHERE cliente_id = $1 AND tipo = $2`,
      [user.cliente_id, tipo]
    )

    let integracion
    if (existing) {
      integracion = await queryOne(
        `UPDATE integraciones SET config = $1, nombre = $2, activo = true WHERE id = $3 RETURNING *`,
        [JSON.stringify(config), nombre || tipo, existing.id]
      )
    } else {
      integracion = await queryOne(
        `INSERT INTO integraciones (cliente_id, tipo, nombre, config, activo)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [user.cliente_id, tipo, nombre || tipo, JSON.stringify(config)]
      )
    }
    return NextResponse.json(integracion, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
