import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST - Cambiar contraseña
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { password_actual, password_nuevo, forzado } = body

    if (!password_nuevo || password_nuevo.length < 6) {
      return NextResponse.json({
        error: 'La nueva contrasena debe tener al menos 6 caracteres'
      }, { status: 400 })
    }

    // Si es cambio forzado (primer login), no requerimos password actual
    if (!forzado) {
      if (!password_actual) {
        return NextResponse.json({
          error: 'Contrasena actual requerida'
        }, { status: 400 })
      }

      // Verificar contraseña actual
      const userData = await queryOne(
        `SELECT password_hash FROM usuarios WHERE id = $1`,
        [user.id]
      )

      if (!userData) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
      }

      const passwordValido = await verifyPassword(password_actual, userData.password_hash)
      if (!passwordValido) {
        return NextResponse.json({ error: 'Contrasena actual incorrecta' }, { status: 400 })
      }
    }

    // Hash nueva contraseña
    const nuevoHash = await hashPassword(password_nuevo)

    // Actualizar contraseña y marcar que ya no debe cambiarla
    await execute(
      `UPDATE usuarios SET
        password_hash = $2,
        debe_cambiar_password = false,
        updated_at = NOW()
       WHERE id = $1`,
      [user.id, nuevoHash]
    )

    return NextResponse.json({
      success: true,
      mensaje: 'Contrasena actualizada correctamente'
    })
  } catch (error) {
    console.error('Error cambiando contrasena:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
