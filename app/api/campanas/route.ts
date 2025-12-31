import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const campanas = await query(
      `SELECT * FROM campanas WHERE cliente_id = $1 ORDER BY created_at DESC`,
      [user.cliente_id]
    )
    return NextResponse.json(campanas)
  } catch (error) {
    console.error('Error campañas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { nombre, mensaje, contactos_ids } = body

    if (!nombre || !mensaje) {
      return NextResponse.json({ error: 'Nombre y mensaje requeridos' }, { status: 400 })
    }

    const campana = await queryOne(
      `INSERT INTO campanas (cliente_id, nombre, mensaje, total_contactos, estado)
       VALUES ($1, $2, $3, $4, 'borrador')
       RETURNING *`,
      [user.cliente_id, nombre, mensaje, contactos_ids?.length || 0]
    )

    // Agregar contactos a la campaña
    if (contactos_ids && contactos_ids.length > 0) {
      for (const contactoId of contactos_ids) {
        await query(
          `INSERT INTO campana_contactos (campana_id, contacto_id) VALUES ($1, $2)`,
          [campana.id, contactoId]
        )
      }
    }

    return NextResponse.json(campana, { status: 201 })
  } catch (error) {
    console.error('Error crear campaña:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, estado } = body

    await query(
      `UPDATE campanas SET estado = $1, updated_at = NOW() WHERE id = $2 AND cliente_id = $3`,
      [estado, id, user.cliente_id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error actualizar campaña:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
