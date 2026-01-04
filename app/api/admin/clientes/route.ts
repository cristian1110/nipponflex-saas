import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne, execute } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Listar clientes (solo super admin)
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.nivel < 100) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const clientes = await query(
      `SELECT
        c.id,
        c.nombre_empresa,
        c.email,
        c.telefono,
        c.plan,
        c.estado,
        c.tipo_cliente,
        c.created_at,
        p.nombre as plan_nombre,
        (SELECT COUNT(*) FROM usuarios WHERE cliente_id = c.id) as total_usuarios,
        (SELECT COUNT(*) FROM instancias_whatsapp WHERE cliente_id = c.id AND estado = 'conectado') as whatsapps_conectados
       FROM clientes c
       LEFT JOIN planes p ON c.plan_id = p.id
       ORDER BY c.created_at DESC`
    )

    return NextResponse.json(clientes)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear nuevo cliente
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.nivel < 100) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { nombre_empresa, email, telefono, plan_id, tipo_cliente } = body

    if (!nombre_empresa || !email) {
      return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })
    }

    // Verificar email único
    const existe = await queryOne(`SELECT id FROM clientes WHERE email = $1`, [email.toLowerCase()])
    if (existe) {
      return NextResponse.json({ error: 'Ya existe un cliente con ese email' }, { status: 400 })
    }

    // Obtener límites del plan
    const plan = await queryOne(`SELECT * FROM planes WHERE id = $1`, [plan_id || 1])

    const nuevoCliente = await queryOne(
      `INSERT INTO clientes (
        nombre_empresa, email, telefono, plan_id, plan, tipo_cliente, estado,
        limite_agentes, limite_usuarios, limite_contactos, limite_mensajes_mes,
        limite_archivos, limite_archivos_kb, limite_campanas_mes, limite_automatizaciones,
        max_whatsapp, max_mensajes_mes, max_instancias, max_mensajes_dia, max_contactos, max_campanas_activas
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'activo', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        nombre_empresa,
        email.toLowerCase(),
        telefono || null,
        plan_id || 1,
        plan?.nombre || 'basico',
        tipo_cliente || 'normal',
        plan?.max_agentes || 1,
        plan?.max_usuarios || 3,
        plan?.max_contactos || 500,
        plan?.max_mensajes_mes || 1000,
        plan?.max_archivos || 5,
        plan?.max_archivos_kb || 3,
        plan?.max_campanas_mes || 0,
        plan?.max_automatizaciones || 0,
        plan?.max_whatsapp || 1,
        plan?.max_mensajes_mes || 2000,
        plan?.max_whatsapp || 1,
        plan?.max_mensajes_dia || 100,
        plan?.max_contactos || 500,
        plan?.max_campanas_activas || 1
      ]
    )

    return NextResponse.json({ success: true, cliente: nuevoCliente })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT - Actualizar cliente
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.nivel < 100) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, nombre_empresa, email, telefono, plan_id, estado, tipo_cliente } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Obtener límites del nuevo plan si cambió
    let planUpdates = ''
    let planParams: any[] = []

    if (plan_id) {
      const plan = await queryOne(`SELECT * FROM planes WHERE id = $1`, [plan_id])
      if (plan) {
        planUpdates = `,
          plan_id = $7, plan = $8,
          limite_agentes = $9, limite_usuarios = $10, limite_contactos = $11,
          limite_mensajes_mes = $12, max_whatsapp = $13, max_instancias = $14`
        planParams = [
          plan_id, plan.nombre,
          plan.max_agentes || 1, plan.max_usuarios || 3, plan.max_contactos || 500,
          plan.max_mensajes_mes || 1000, plan.max_whatsapp || 1, plan.max_whatsapp || 1
        ]
      }
    }

    const baseParams = [id, nombre_empresa, email?.toLowerCase(), telefono, estado, tipo_cliente]

    await execute(
      `UPDATE clientes SET
        nombre_empresa = COALESCE($2, nombre_empresa),
        email = COALESCE($3, email),
        telefono = COALESCE($4, telefono),
        estado = COALESCE($5, estado),
        tipo_cliente = COALESCE($6, tipo_cliente),
        updated_at = NOW()
        ${planUpdates}
       WHERE id = $1`,
      [...baseParams, ...planParams]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Desactivar cliente
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.nivel < 100) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // No eliminar, solo desactivar
    await execute(`UPDATE clientes SET estado = 'inactivo', updated_at = NOW() WHERE id = $1`, [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
