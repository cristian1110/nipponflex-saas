import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

const PLANES_CONFIG: Record<string, { 
  agentes: number; usuarios: number; mensajes: number; 
  instancias: number; contactos: number; campanas: number 
}> = {
  starter: { agentes: 1, usuarios: 2, mensajes: 500, instancias: 1, contactos: 500, campanas: 1 },
  pro: { agentes: 3, usuarios: 5, mensajes: 2000, instancias: 2, contactos: 5000, campanas: 5 },
  business: { agentes: 10, usuarios: 15, mensajes: 10000, instancias: 5, contactos: 50000, campanas: 20 },
  enterprise: { agentes: -1, usuarios: -1, mensajes: -1, instancias: -1, contactos: -1, campanas: -1 },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { empresa, nombre, email, telefono, password, plan } = body

    if (!empresa || !nombre || !email || !password) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const existingUser = await queryOne('SELECT id FROM usuarios WHERE email = $1', [email])
    if (existingUser) {
      return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 400 })
    }

    const planConfig = PLANES_CONFIG[plan] || PLANES_CONFIG.starter

    // 1. Crear cliente con límites del plan
    const cliente = await queryOne(`
      INSERT INTO clientes (
        nombre, email, telefono, plan, 
        limite_agentes, limite_usuarios, limite_mensajes, mensajes_usados,
        max_instancias, max_mensajes_dia, max_contactos, max_campanas_activas,
        activo, fecha_inicio
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11, true, NOW())
      RETURNING *
    `, [
      empresa, email, telefono, plan || 'starter',
      planConfig.agentes, planConfig.usuarios, planConfig.mensajes,
      planConfig.instancias, planConfig.mensajes, planConfig.contactos, planConfig.campanas
    ])

    // 2. Crear usuario admin
    const password_hash = await hashPassword(password)
    const usuario = await queryOne(`
      INSERT INTO usuarios (email, password_hash, nombre, telefono, rol, nivel, cliente_id, activo, debe_cambiar_password)
      VALUES ($1, $2, $3, $4, 'admin', 4, $5, true, false)
      RETURNING id, email, nombre, rol, nivel
    `, [email, password_hash, nombre, telefono, cliente.id])

    // 3. Crear pipeline por defecto
    const pipeline = await queryOne(`
      INSERT INTO pipelines (cliente_id, nombre, descripcion, es_default)
      VALUES ($1, 'Ventas', 'Pipeline principal de ventas', true)
      RETURNING id
    `, [cliente.id])

    // 4. Crear etapas del pipeline
    const etapas = [
      { nombre: 'Nuevo Lead', color: '#3b82f6', orden: 1 },
      { nombre: 'Contactado', color: '#f59e0b', orden: 2 },
      { nombre: 'Interesado', color: '#8b5cf6', orden: 3 },
      { nombre: 'Cotización Enviada', color: '#06b6d4', orden: 4 },
      { nombre: 'Negociación', color: '#ec4899', orden: 5 },
      { nombre: 'Ganado', color: '#22c55e', orden: 6, es_ganado: true },
      { nombre: 'Perdido', color: '#ef4444', orden: 7, es_perdido: true },
    ]

    for (const etapa of etapas) {
      await query(`
        INSERT INTO etapas_crm (cliente_id, pipeline_id, nombre, color, orden, es_ganado, es_perdido)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [cliente.id, pipeline.id, etapa.nombre, etapa.color, etapa.orden, etapa.es_ganado || false, etapa.es_perdido || false])
    }

    // 5. Crear instancia WhatsApp placeholder (para configurar después)
    await query(`
      INSERT INTO instancias_whatsapp (
        cliente_id, nombre, numero_whatsapp, tipo, estado, mensajes_dia_limite
      ) VALUES ($1, 'WhatsApp Principal', '', 'evolution', 'pendiente', $2)
    `, [cliente.id, planConfig.mensajes])

    // 6. Crear rate limits iniciales
    await query(`
      INSERT INTO rate_limits (cliente_id, tipo, contador, limite, ventana_segundos)
      VALUES 
        ($1, 'mensajes_hora', 0, $2, 3600),
        ($1, 'mensajes_dia', 0, $3, 86400),
        ($1, 'api_calls', 0, 1000, 3600)
    `, [cliente.id, Math.ceil(planConfig.mensajes / 24), planConfig.mensajes])

    // 7. Crear agente IA por defecto
    await query(`
      INSERT INTO configuracion_agente (
        cliente_id, nombre_custom, personalidad, instrucciones, 
        tono, industria, activo
      ) VALUES (
        $1, 'Asistente Virtual', 
        'Soy un asistente virtual amigable y profesional.',
        'Responde de forma cordial. Si el cliente pregunta por precios o servicios, solicita sus datos de contacto. Si no sabes algo, ofrece conectar con un asesor humano.',
        'profesional', 'general', true
      )
    `, [cliente.id])

    return NextResponse.json({
      success: true,
      mensaje: 'Cuenta creada exitosamente',
      cliente_id: cliente.id,
      usuario_id: usuario.id,
      datos_creados: {
        pipeline: 'Ventas',
        etapas: etapas.length,
        instancia_whatsapp: 'Pendiente de configurar',
        agente_ia: 'Asistente Virtual'
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error registro:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
