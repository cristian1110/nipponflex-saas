import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      telefono: user.telefono,
      rol: user.rol,
      nivel: user.nivel,
      cliente_id: user.cliente_id,
      cliente_nombre: user.cliente_nombre,
      debe_cambiar_password: user.debe_cambiar_password,
      // Limites del cliente
      limite_usuarios: user.limite_usuarios,
      limite_contactos: user.limite_contactos,
      limite_agentes: user.limite_agentes,
      limite_mensajes_mes: user.limite_mensajes_mes,
    })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    )
  }
}
