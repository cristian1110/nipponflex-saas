import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const automatizaciones = await query(
      `SELECT * FROM automatizaciones WHERE cliente_id = $1 ORDER BY created_at DESC`,
      [user.cliente_id]
    )
    return NextResponse.json(automatizaciones)
  } catch (error) {
    console.error('Error automatizaciones:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { nombre, trigger_tipo, accion_tipo, trigger_config, accion_config } = body

    if (!nombre || !trigger_tipo || !accion_tipo) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const auto = await queryOne(
      `INSERT INTO automatizaciones (cliente_id, nombre, trigger_tipo, accion_tipo, trigger_config, accion_config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.cliente_id, nombre, trigger_tipo, accion_tipo, trigger_config || '{}', accion_config || '{}']
    )

    return NextResponse.json(auto, { status: 201 })
  } catch (error) {
    console.error('Error crear automatización:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, activo, nombre, trigger_tipo, accion_tipo } = body

    if (typeof activo === 'boolean') {
      await query(
        `UPDATE automatizaciones SET activo = $1 WHERE id = $2 AND cliente_id = $3`,
        [activo, id, user.cliente_id]
      )
    } else {
      await query(
        `UPDATE automatizaciones SET nombre = $1, trigger_tipo = $2, accion_tipo = $3 WHERE id = $4 AND cliente_id = $5`,
        [nombre, trigger_tipo, accion_tipo, id, user.cliente_id]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error actualizar automatización:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    await query(
      `DELETE FROM automatizaciones WHERE id = $1 AND cliente_id = $2`,
      [id, user.cliente_id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminar automatización:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
