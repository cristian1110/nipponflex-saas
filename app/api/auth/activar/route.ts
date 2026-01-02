import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// GET - Verificar token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const invitacion = await queryOne(
      `SELECT i.*, p.nombre as plan_nombre 
       FROM invitaciones i 
       LEFT JOIN planes p ON i.plan_id = p.id 
       WHERE i.token = $1`,
      [token]
    )

    if (!invitacion) {
      return NextResponse.json({ error: 'Token invalido', valido: false }, { status: 404 })
    }

    if (invitacion.estado === 'aceptada') {
      return NextResponse.json({ error: 'Esta invitacion ya fue usada', valido: false }, { status: 400 })
    }

    if (invitacion.estado === 'cancelada') {
      return NextResponse.json({ error: 'Esta invitacion fue cancelada', valido: false }, { status: 400 })
    }

    if (new Date(invitacion.expira_at) < new Date()) {
      return NextResponse.json({ error: 'Esta invitacion ha expirado', valido: false }, { status: 400 })
    }

    return NextResponse.json({
      valido: true,
      nombre: invitacion.nombre,
      email: invitacion.email,
      tipo: invitacion.tipo,
      plan: invitacion.plan_nombre
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Activar cuenta (crear usuario)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json({ error: 'Token y contrasena requeridos' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 })
    }

    // Verificar token
    const invitacion = await queryOne(
      `SELECT * FROM invitaciones WHERE token = $1 AND estado = 'pendiente'`,
      [token]
    )

    if (!invitacion) {
      return NextResponse.json({ error: 'Token invalido o ya usado' }, { status: 400 })
    }

    if (new Date(invitacion.expira_at) < new Date()) {
      return NextResponse.json({ error: 'Esta invitacion ha expirado' }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Determinar rol y cuenta
    let cuentaId = 1
    let clienteId = invitacion.cliente_padre_id
    let rol = 'usuario'

    if (invitacion.tipo === 'cliente') {
      // Crear nueva cuenta/cliente
      const nuevaCuenta = await queryOne(
        `INSERT INTO cuentas (nombre, plan_id, activo) VALUES ($1, $2, true) RETURNING id`,
        [invitacion.nombre, invitacion.plan_id || 1]
      )
      cuentaId = nuevaCuenta.id

      const nuevoCliente = await queryOne(
        `INSERT INTO clientes (cuenta_id, nombre, email, plan_id, activo) VALUES ($1, $2, $3, $4, true) RETURNING id`,
        [cuentaId, invitacion.nombre, invitacion.email, invitacion.plan_id || 1]
      )
      clienteId = nuevoCliente.id
      rol = 'admin'
    }

    // Crear usuario
    const usuario = await queryOne(
      `INSERT INTO usuarios (cuenta_id, cliente_id, nombre, email, password, rol, activo, email_verificado, invitacion_id)
       VALUES ($1, $2, $3, $4, $5, $6, true, true, $7)
       RETURNING id, nombre, email, rol`,
      [cuentaId, clienteId, invitacion.nombre, invitacion.email, hashedPassword, rol, invitacion.id]
    )

    // Marcar invitacion como aceptada
    await query(
      `UPDATE invitaciones SET estado = 'aceptada', aceptada_at = NOW() WHERE id = $1`,
      [invitacion.id]
    )

    return NextResponse.json({
      success: true,
      mensaje: 'Cuenta activada correctamente',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
