import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { sendEmail, emailTemplates } from '@/lib/email'

export const dynamic = 'force-dynamic'

// GET - Listar invitaciones
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    let invitaciones
    if (user.rol === 'super_admin') {
      // Super admin ve todas
      invitaciones = await query(
        `SELECT i.*, p.nombre as plan_nombre 
         FROM invitaciones i 
         LEFT JOIN planes p ON i.plan_id = p.id 
         ORDER BY i.created_at DESC`
      )
    } else {
      // Admin normal ve solo sus sub-usuarios
      invitaciones = await query(
        `SELECT * FROM invitaciones 
         WHERE cliente_padre_id = $1 
         ORDER BY created_at DESC`,
        [user.cliente_id]
      )
    }

    return NextResponse.json(invitaciones)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear nueva invitacion
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { email, nombre, tipo, plan_id, limite_contactos, limite_mensajes } = body

    if (!email || !nombre) {
      return NextResponse.json({ error: 'Email y nombre son requeridos' }, { status: 400 })
    }

    // Verificar que el email no exista
    const existeEmail = await queryOne(
      `SELECT id FROM usuarios WHERE email = $1`,
      [email.toLowerCase()]
    )
    if (existeEmail) {
      return NextResponse.json({ error: 'Este email ya esta registrado' }, { status: 400 })
    }

    // Verificar invitacion pendiente
    const existeInvitacion = await queryOne(
      `SELECT id FROM invitaciones WHERE email = $1 AND estado = 'pendiente'`,
      [email.toLowerCase()]
    )
    if (existeInvitacion) {
      return NextResponse.json({ error: 'Ya existe una invitacion pendiente para este email' }, { status: 400 })
    }

    // Si es sub-usuario, verificar limite del plan NipponFlex
    if (tipo === 'sub_usuario') {
      const countSubUsuarios = await queryOne(
        `SELECT COUNT(*) as total FROM invitaciones 
         WHERE cliente_padre_id = $1 AND (estado = 'pendiente' OR estado = 'aceptada')`,
        [user.cliente_id]
      )
      
      // Obtener limite del plan
      const planInfo = await queryOne(
        `SELECT p.max_sub_usuarios FROM clientes c 
         JOIN planes p ON c.plan_id = p.id 
         WHERE c.id = $1`,
        [user.cliente_id]
      )
      
      if (planInfo && countSubUsuarios.total >= planInfo.max_sub_usuarios) {
        return NextResponse.json({ 
          error: `Has alcanzado el limite de ${planInfo.max_sub_usuarios} sub-usuarios` 
        }, { status: 400 })
      }
    }

    // Generar token unico
    const token = uuidv4()
    const expiraAt = new Date()
    expiraAt.setHours(expiraAt.getHours() + 48) // Expira en 48 horas

    // Crear invitacion
    const invitacion = await queryOne(
      `INSERT INTO invitaciones (email, nombre, token, tipo, plan_id, cliente_padre_id, limite_contactos, limite_mensajes, estado, expira_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente', $9, $10)
       RETURNING *`,
      [
        email.toLowerCase(),
        nombre,
        token,
        tipo || 'cliente',
        plan_id || null,
        tipo === 'sub_usuario' ? user.cliente_id : null,
        limite_contactos || null,
        limite_mensajes || null,
        expiraAt,
        user.id
      ]
    )

    // Obtener URL base
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nipponflex.84.247.166.88.sslip.io'

    // Enviar email
    let emailTemplate
    if (tipo === 'sub_usuario') {
      emailTemplate = emailTemplates.invitacionSubUsuario(nombre, token, user.nombre, baseUrl)
    } else {
      const planNombre = plan_id ? (await queryOne(`SELECT nombre FROM planes WHERE id = $1`, [plan_id]))?.nombre : 'Basico'
      emailTemplate = emailTemplates.invitacionCliente(nombre, token, planNombre || 'Basico', baseUrl)
    }

    const emailResult = await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })

    return NextResponse.json({
      success: true,
      invitacion,
      email_enviado: emailResult.success,
      link: `${baseUrl}/activar/${token}`
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Cancelar invitacion
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    await query(
      `UPDATE invitaciones SET estado = 'cancelada' WHERE id = $1`,
      [id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
