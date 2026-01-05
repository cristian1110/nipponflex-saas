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
        c.limite_usuarios,
        c.limite_contactos,
        c.limite_mensajes_mes,
        c.limite_agentes,
        c.created_at,
        p.nombre as plan_nombre,
        COALESCE(p.es_personalizado, false) as es_personalizado,
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
    const {
      nombre_empresa,
      email,
      telefono,
      plan_id,
      es_personalizado,
      // Limites personalizados (solo si es plan personalizado)
      limite_usuarios,
      limite_contactos,
      limite_mensajes_mes,
      limite_agentes,
      limite_campanas_mes
    } = body

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

    // Si es plan personalizado, usar los límites enviados; si no, usar los del plan
    const limites = {
      agentes: es_personalizado ? (limite_agentes || 1) : (plan?.max_agentes || 1),
      usuarios: es_personalizado ? (limite_usuarios || 3) : (plan?.max_usuarios || 3),
      contactos: es_personalizado ? (limite_contactos || 500) : (plan?.max_contactos || 500),
      mensajes_mes: es_personalizado ? (limite_mensajes_mes || 1000) : (plan?.max_mensajes_mes || 1000),
      campanas_mes: es_personalizado ? (limite_campanas_mes || 0) : (plan?.max_campanas_mes || 0),
      archivos_kb: plan?.max_archivos_kb || 3
    }

    const nuevoCliente = await queryOne(
      `INSERT INTO clientes (
        nombre_empresa, email, telefono, plan_id, plan, estado,
        limite_agentes, limite_usuarios, limite_contactos, limite_mensajes_mes,
        limite_archivos, limite_archivos_kb, limite_campanas_mes, limite_automatizaciones,
        max_whatsapp, max_mensajes_mes, max_instancias, max_mensajes_dia, max_contactos, max_campanas_activas
       )
       VALUES ($1, $2, $3, $4, $5, 'activo', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        nombre_empresa,
        email.toLowerCase(),
        telefono || null,
        plan_id || 1,
        plan?.nombre || 'basico',
        limites.agentes,
        limites.usuarios,
        limites.contactos,
        limites.mensajes_mes,
        plan?.max_archivos || 5,
        limites.archivos_kb,
        limites.campanas_mes,
        plan?.max_automatizaciones || 0,
        plan?.max_whatsapp || 1,
        limites.mensajes_mes,
        plan?.max_whatsapp || 1,
        plan?.max_mensajes_dia || 100,
        limites.contactos,
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
    const {
      id,
      nombre_empresa,
      email,
      telefono,
      plan_id,
      estado,
      // Limites personalizados
      limite_usuarios,
      limite_contactos,
      limite_mensajes_mes,
      limite_agentes,
      limite_campanas_mes
    } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Construir query dinamica
    let updates: string[] = []
    let params: any[] = [id]
    let paramIndex = 2

    if (nombre_empresa !== undefined) {
      updates.push(`nombre_empresa = $${paramIndex++}`)
      params.push(nombre_empresa)
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`)
      params.push(email.toLowerCase())
    }
    if (telefono !== undefined) {
      updates.push(`telefono = $${paramIndex++}`)
      params.push(telefono)
    }
    if (estado !== undefined) {
      updates.push(`estado = $${paramIndex++}`)
      params.push(estado)
    }

    // Si cambio el plan
    if (plan_id) {
      const plan = await queryOne(`SELECT * FROM planes WHERE id = $1`, [plan_id])
      if (plan) {
        updates.push(`plan_id = $${paramIndex++}`)
        params.push(plan_id)
        updates.push(`plan = $${paramIndex++}`)
        params.push(plan.nombre)

        // Si no es plan personalizado, actualizar limites desde el plan
        if (!plan.es_personalizado) {
          updates.push(`limite_agentes = $${paramIndex++}`)
          params.push(plan.max_agentes || 1)
          updates.push(`limite_usuarios = $${paramIndex++}`)
          params.push(plan.max_usuarios || 3)
          updates.push(`limite_contactos = $${paramIndex++}`)
          params.push(plan.max_contactos || 500)
          updates.push(`limite_mensajes_mes = $${paramIndex++}`)
          params.push(plan.max_mensajes_mes || 1000)
        }
      }
    }

    // Limites personalizados (si se envian)
    if (limite_usuarios !== undefined) {
      updates.push(`limite_usuarios = $${paramIndex++}`)
      params.push(limite_usuarios)
    }
    if (limite_contactos !== undefined) {
      updates.push(`limite_contactos = $${paramIndex++}`)
      params.push(limite_contactos)
    }
    if (limite_mensajes_mes !== undefined) {
      updates.push(`limite_mensajes_mes = $${paramIndex++}`)
      params.push(limite_mensajes_mes)
    }
    if (limite_agentes !== undefined) {
      updates.push(`limite_agentes = $${paramIndex++}`)
      params.push(limite_agentes)
    }
    if (limite_campanas_mes !== undefined) {
      updates.push(`limite_campanas_mes = $${paramIndex++}`)
      params.push(limite_campanas_mes)
    }

    updates.push('updated_at = NOW()')

    if (updates.length > 1) {
      await execute(
        `UPDATE clientes SET ${updates.join(', ')} WHERE id = $1`,
        params
      )
    }

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
