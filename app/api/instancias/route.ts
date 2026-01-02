import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Listar instancias del cliente
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const instancias = await query(`
      SELECT 
        i.*,
        COALESCE(
          (SELECT COUNT(*) FROM cola_mensajes cm 
           WHERE cm.instancia_id = i.id AND cm.estado = 'pendiente'),
          0
        ) as mensajes_pendientes,
        COALESCE(
          (SELECT COUNT(*) FROM conversaciones c 
           WHERE c.instancia_id = i.id AND c.estado = 'activa'),
          0
        ) as conversaciones_activas
      FROM instancias_whatsapp i
      WHERE i.cliente_id = $1
      ORDER BY i.created_at DESC
    `, [user.cliente_id])

    return NextResponse.json(instancias)
  } catch (error) {
    console.error('Error instancias:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear nueva instancia
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await request.json()
    const { nombre, numero_whatsapp, tipo = 'evolution' } = data

    if (!nombre || !numero_whatsapp) {
      return NextResponse.json({ error: 'Nombre y número requeridos' }, { status: 400 })
    }

    // Verificar límite de instancias del plan
    const cliente = await queryOne(`
      SELECT c.*, p.caracteristicas
      FROM clientes c
      LEFT JOIN planes p ON c.plan_id = p.id
      WHERE c.id = $1
    `, [user.cliente_id])

    const maxInstancias = cliente?.caracteristicas?.max_instancias || 1
    const instanciasActuales = await queryOne(`
      SELECT COUNT(*) as total FROM instancias_whatsapp WHERE cliente_id = $1
    `, [user.cliente_id])

    if (instanciasActuales.total >= maxInstancias) {
      return NextResponse.json({ 
        error: `Tu plan permite máximo ${maxInstancias} instancia(s). Actualiza tu plan para agregar más.` 
      }, { status: 400 })
    }

    // Crear instancia
    const instancia = await queryOne(`
      INSERT INTO instancias_whatsapp (
        cliente_id, nombre, numero_whatsapp, tipo, estado,
        webhook_verify_token
      ) VALUES ($1, $2, $3, $4, 'pendiente', $5)
      RETURNING *
    `, [
      user.cliente_id, 
      nombre, 
      numero_whatsapp, 
      tipo,
      crypto.randomUUID().replace(/-/g, '').substring(0, 20)
    ])

    return NextResponse.json(instancia)
  } catch (error: any) {
    console.error('Error crear instancia:', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este número ya está registrado' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Eliminar instancia
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    await query(`
      DELETE FROM instancias_whatsapp 
      WHERE id = $1 AND cliente_id = $2
    `, [id, user.cliente_id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminar instancia:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
