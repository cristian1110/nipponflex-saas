import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

const PLANES_CONFIG: Record<string, { agentes: number; usuarios: number; mensajes: number }> = {
  starter: { agentes: 1, usuarios: 2, mensajes: 500 },
  pro: { agentes: 3, usuarios: 5, mensajes: 2000 },
  business: { agentes: 10, usuarios: 15, mensajes: 10000 },
  enterprise: { agentes: -1, usuarios: -1, mensajes: -1 },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { empresa, nombre, email, telefono, password, plan } = body

    // Validaciones
    if (!empresa || !nombre || !email || !password) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    // Verificar email no existe
    const existingUser = await queryOne(`SELECT id FROM usuarios WHERE email = $1`, [email])
    if (existingUser) {
      return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 400 })
    }

    // Obtener configuración del plan
    const planConfig = PLANES_CONFIG[plan] || PLANES_CONFIG.starter

    // Crear cliente
    const cliente = await queryOne(
      `INSERT INTO clientes (nombre, email, telefono, plan, limite_agentes, limite_usuarios, limite_mensajes, mensajes_usados, activo, fecha_inicio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, true, NOW())
       RETURNING *`,
      [empresa, email, telefono, plan || 'starter', planConfig.agentes, planConfig.usuarios, planConfig.mensajes]
    )

    // Crear usuario admin
    const password_hash = await hashPassword(password)
    const usuario = await queryOne(
      `INSERT INTO usuarios (email, password_hash, nombre, telefono, rol, nivel, cliente_id, activo, debe_cambiar_password)
       VALUES ($1, $2, $3, $4, 'admin', 4, $5, true, false)
       RETURNING id, email, nombre, rol, nivel`,
      [email, password_hash, nombre, telefono, cliente.id]
    )

    // Crear etapas de pipeline por defecto
    const etapas = [
      { nombre: 'Nuevo', color: '#3b82f6', orden: 1 },
      { nombre: 'Contactado', color: '#f59e0b', orden: 2 },
      { nombre: 'Calificado', color: '#8b5cf6', orden: 3 },
      { nombre: 'Propuesta', color: '#06b6d4', orden: 4 },
      { nombre: 'Negociación', color: '#ec4899', orden: 5 },
      { nombre: 'Ganado', color: '#22c55e', orden: 6, es_ganado: true },
      { nombre: 'Perdido', color: '#ef4444', orden: 7, es_perdido: true },
    ]

    for (const etapa of etapas) {
      await queryOne(
        `INSERT INTO etapas_crm (cliente_id, nombre, color, orden, es_ganado, es_perdido)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [cliente.id, etapa.nombre, etapa.color, etapa.orden, etapa.es_ganado || false, etapa.es_perdido || false]
      )
    }

    return NextResponse.json({
      success: true,
      mensaje: 'Cuenta creada exitosamente',
      cliente_id: cliente.id,
      usuario_id: usuario.id,
    }, { status: 201 })
  } catch (error) {
    console.error('Error registro:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
