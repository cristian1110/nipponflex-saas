import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser, hashPassword } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.nivel < 5) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const clientes = await query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM usuarios u WHERE u.cliente_id = c.id) as total_usuarios,
        (SELECT COUNT(*) FROM agentes a WHERE a.cliente_id = c.id) as total_agentes
      FROM clientes c ORDER BY c.created_at DESC
    `)
    return NextResponse.json(clientes)
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.nivel < 5) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await request.json()
    const { nombre, email, telefono, plan, limite_agentes, limite_usuarios, limite_mensajes } = body

    const cliente = await queryOne(
      `INSERT INTO clientes (nombre, email, telefono, plan, limite_agentes, limite_usuarios, limite_mensajes, mensajes_usados, activo, fecha_inicio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, true, NOW())
       RETURNING *`,
      [nombre, email, telefono, plan || 'starter', limite_agentes || 1, limite_usuarios || 2, limite_mensajes || 500]
    )
    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
