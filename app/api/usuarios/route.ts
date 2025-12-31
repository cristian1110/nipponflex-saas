import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser, hashPassword } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.nivel < 4) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const usuarios = await query(
      `SELECT id, email, nombre, telefono, rol, nivel, activo, created_at FROM usuarios WHERE cliente_id = $1 ORDER BY created_at DESC`,
      [user.cliente_id]
    )
    return NextResponse.json(usuarios)
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
    const { nombre, email, telefono, rol, password } = body

    const existing = await queryOne(`SELECT id FROM usuarios WHERE email = $1`, [email])
    if (existing) return NextResponse.json({ error: 'Email ya registrado' }, { status: 400 })

    const niveles: Record<string, number> = { superadmin: 5, admin: 4, distribuidor: 3, vendedor: 2 }
    const nivel = niveles[rol] || 2
    const password_hash = await hashPassword(password)

    const usuario = await queryOne(
      `INSERT INTO usuarios (email, password_hash, nombre, telefono, rol, nivel, cliente_id, activo, debe_cambiar_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
       RETURNING id, email, nombre, telefono, rol, nivel, activo, created_at`,
      [email, password_hash, nombre, telefono, rol || 'vendedor', nivel, user.cliente_id]
    )
    return NextResponse.json(usuario, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
