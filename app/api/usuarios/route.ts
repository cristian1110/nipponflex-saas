import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    let usuarios
    if (user.nivel >= 5) {
      // Superadmin ve todos
      usuarios = await query(
        `SELECT u.id, u.nombre, u.apellido, u.email, u.estado, u.created_at,
                r.nombre as rol, r.nivel, c.nombre_empresa as cliente_nombre
         FROM usuarios u
         LEFT JOIN roles r ON u.rol_id = r.id
         LEFT JOIN clientes c ON u.cliente_id = c.id
         ORDER BY u.created_at DESC`
      )
    } else {
      // Admin ve solo de su cliente
      usuarios = await query(
        `SELECT u.id, u.nombre, u.apellido, u.email, u.estado, u.created_at,
                r.nombre as rol, r.nivel
         FROM usuarios u
         LEFT JOIN roles r ON u.rol_id = r.id
         WHERE u.cliente_id = $1
         ORDER BY u.created_at DESC`,
        [user.cliente_id]
      )
    }

    return NextResponse.json(usuarios)
  } catch (error) {
    console.error('Error usuarios:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.nivel < 4) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { nombre, apellido, email, password, rol_id } = body

    if (!nombre || !email || !password) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Verificar email único
    const existe = await queryOne(`SELECT id FROM usuarios WHERE email = $1`, [email])
    if (existe) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const nuevo = await queryOne(
      `INSERT INTO usuarios (nombre, apellido, email, password, rol_id, cliente_id, cuenta_id, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 1, true)
       RETURNING id, nombre, apellido, email`,
      [nombre, apellido || '', email, hashedPassword, rol_id || 2, user.cliente_id]
    )

    return NextResponse.json(nuevo, { status: 201 })
  } catch (error) {
    console.error('Error crear usuario:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
