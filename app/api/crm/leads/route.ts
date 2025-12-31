import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requireRole } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import type { Lead } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const etapa = searchParams.get('etapa')
    const busqueda = searchParams.get('q')
    const limite = parseInt(searchParams.get('limite') || '100')

    let sql = `
      SELECT l.*, e.nombre as etapa_nombre, e.color as etapa_color, e.orden as etapa_orden,
             u.nombre as asignado_nombre
      FROM leads l
      LEFT JOIN etapas_pipeline e ON l.etapa_id = e.id
      LEFT JOIN usuarios u ON l.asignado_a = u.id
      WHERE 1=1
    `
    const params: any[] = []

    // Filtrar por cliente si no es superadmin
    if (user.nivel < 5 && user.cliente_id) {
      params.push(user.cliente_id)
      sql += ` AND l.cliente_id = $${params.length}`
    }

    if (etapa) {
      params.push(etapa)
      sql += ` AND e.nombre = $${params.length}`
    }

    if (busqueda) {
      params.push(`%${busqueda}%`)
      sql += ` AND (l.nombre ILIKE $${params.length} OR l.telefono ILIKE $${params.length} OR l.email ILIKE $${params.length})`
    }

    sql += ` ORDER BY l.created_at DESC LIMIT ${limite}`

    const leads = await query<Lead>(sql, params)

    return NextResponse.json(leads)
  } catch (error) {
    console.error('Error fetching leads:', error)
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
    const { nombre, telefono, email, empresa, origen, valor_estimado, notas, etapa_id } = data

    if (!nombre || !telefono) {
      return NextResponse.json(
        { error: 'Nombre y teléfono son requeridos' },
        { status: 400 }
      )
    }

    // Obtener etapa inicial si no se especifica
    let etapaId = etapa_id
    if (!etapaId && user.cliente_id) {
      const etapaInicial = await queryOne<{ id: number }>(
        'SELECT id FROM etapas_pipeline WHERE cliente_id = $1 ORDER BY orden ASC LIMIT 1',
        [user.cliente_id]
      )
      etapaId = etapaInicial?.id
    }

    const result = await query<Lead>(
      `INSERT INTO leads (cliente_id, nombre, telefono, email, empresa, origen, valor_estimado, notas, etapa_id, asignado_a)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user.cliente_id || 1,
        nombre,
        telefono,
        email || null,
        empresa || null,
        origen || 'Manual',
        valor_estimado || 0,
        notas || null,
        etapaId,
        user.id,
      ]
    )

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
