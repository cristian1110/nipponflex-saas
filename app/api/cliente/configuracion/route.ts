import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Obtener configuración regional del cliente
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!user.cliente_id) {
      return NextResponse.json({ error: 'Usuario sin cliente asignado' }, { status: 400 })
    }

    const cliente = await queryOne(
      `SELECT zona_horaria, idioma FROM clientes WHERE id = $1`,
      [user.cliente_id]
    )

    return NextResponse.json({
      zona_horaria: cliente?.zona_horaria || 'America/Guayaquil',
      idioma: cliente?.idioma || 'es'
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT - Actualizar configuración regional del cliente
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!user.cliente_id) {
      return NextResponse.json({ error: 'Usuario sin cliente asignado' }, { status: 400 })
    }

    // Solo admin o superior puede cambiar configuración del cliente
    if (user.nivel < 50) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const { zona_horaria, idioma } = await request.json()

    // Validar zona horaria
    const zonasValidas = [
      'America/Guayaquil', 'America/Bogota', 'America/Lima', 'America/Santiago',
      'America/Buenos_Aires', 'America/Sao_Paulo', 'America/Mexico_City',
      'America/New_York', 'America/Los_Angeles', 'Europe/Madrid', 'Europe/London', 'UTC'
    ]
    if (zona_horaria && !zonasValidas.includes(zona_horaria)) {
      return NextResponse.json({ error: 'Zona horaria no válida' }, { status: 400 })
    }

    // Validar idioma
    const idiomasValidos = ['es', 'en', 'pt']
    if (idioma && !idiomasValidos.includes(idioma)) {
      return NextResponse.json({ error: 'Idioma no válido' }, { status: 400 })
    }

    await execute(
      `UPDATE clientes SET
        zona_horaria = COALESCE($1, zona_horaria),
        idioma = COALESCE($2, idioma),
        updated_at = NOW()
       WHERE id = $3`,
      [zona_horaria, idioma, user.cliente_id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
