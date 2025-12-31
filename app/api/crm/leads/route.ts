import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const etapaId = searchParams.get('etapa_id')

    let sql = `
      SELECT l.*, e.nombre as etapa_nombre, e.color as etapa_color,
        (SELECT COUNT(*) FROM historial_conversaciones h WHERE h.numero_whatsapp = l.telefono AND h.cliente_id = l.cliente_id) as total_mensajes
      FROM leads l
      LEFT JOIN etapas_crm e ON l.etapa_id = e.id
      WHERE l.cliente_id = $1
    `
    const params: any[] = [user.cliente_id]

    if (etapaId) {
      sql += ` AND l.etapa_id = $2`
      params.push(etapaId)
    }

    sql += ` ORDER BY l.updated_at DESC`

    const leads = await query(sql, params)
    return NextResponse.json(leads)
  } catch (error) {
    console.error('Error leads:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { nombre, telefono, email, empresa, etapa_id, valor_estimado, origen, notas } = body

    const lead = await queryOne(
      `INSERT INTO leads (cliente_id, cuenta_id, nombre, telefono, email, empresa, etapa_id, valor_estimado, origen, notas)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [user.cliente_id, nombre, telefono, email, empresa, etapa_id, valor_estimado || 0, origen, notas]
    )
    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Error crear lead:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, etapa_id, ...datos } = body

    if (etapa_id !== undefined) {
      await query(
        `UPDATE leads SET etapa_id = $1, updated_at = NOW() WHERE id = $2 AND cliente_id = $3`,
        [etapa_id, id, user.cliente_id]
      )
    }

    const lead = await queryOne(`SELECT * FROM leads WHERE id = $1`, [id])
    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error actualizar lead:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
