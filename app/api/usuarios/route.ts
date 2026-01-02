import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    let usuarios
    if (user.nivel >= 100) {
      // Super admin ve todos
      usuarios = await query(
        `SELECT u.id, u.nombre, u.email, u.estado, u.created_at,
                r.nombre as rol, r.nivel
         FROM usuarios u
         LEFT JOIN roles r ON u.rol_id = r.id
         ORDER BY u.created_at DESC`
      )
    } else {
      // Admin normal ve solo los de su cuenta
      usuarios = await query(
        `SELECT u.id, u.nombre, u.email, u.estado, u.created_at,
                r.nombre as rol, r.nivel
         FROM usuarios u
         LEFT JOIN roles r ON u.rol_id = r.id
         WHERE u.cuenta_id = $1
         ORDER BY u.created_at DESC`,
        [user.cuenta_id]
      )
    }

    return NextResponse.json(usuarios)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
