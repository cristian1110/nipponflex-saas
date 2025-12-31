import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const bases = await query(
      `SELECT * FROM bases_conocimiento WHERE cliente_id = $1 ORDER BY created_at DESC`,
      [user.cliente_id]
    )
    return NextResponse.json(bases)
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
    const { nombre, tipo, contenido, url, agente_id } = body

    const base = await queryOne(
      `INSERT INTO bases_conocimiento (cliente_id, agente_id, nombre, tipo, contenido, archivo_url, vectorizado, total_chunks)
       VALUES ($1, $2, $3, $4, $5, $6, false, 0)
       RETURNING *`,
      [user.cliente_id, agente_id, nombre, tipo, contenido, url]
    )
    return NextResponse.json(base, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
