import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const agentes = await query(
      `SELECT ca.id, ca.cliente_id, ca.tipo_agente_id, ca.nombre_custom, ca.nombre_agente,
        ca.prompt_sistema, ca.temperatura, ca.max_tokens, ca.activo,
        ca.horario_inicio, ca.horario_fin, ca.mensaje_fuera_horario,
        ca.voice_id, ca.responder_con_audio,
        ta.nombre as tipo_nombre,
        ta.icono as tipo_icono,
        u.nombre as usuario_nombre
       FROM configuracion_agente ca
       LEFT JOIN tipos_agente ta ON ca.tipo_agente_id = ta.id
       LEFT JOIN usuarios u ON ca.usuario_id = u.id
       WHERE ca.cliente_id = $1
       ORDER BY ca.created_at DESC`,
      [user.cliente_id]
    )

    return NextResponse.json(agentes)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Verificar límites
    const limites = await queryOne(
      `SELECT p.max_agentes, 
        (SELECT COUNT(*) FROM configuracion_agente WHERE cliente_id = $1) as actuales
       FROM clientes c
       JOIN planes p ON c.plan_id = p.id
       WHERE c.id = $1`,
      [user.cliente_id]
    )

    if (limites && parseInt(limites.actuales) >= limites.max_agentes) {
      return NextResponse.json({ error: `Has alcanzado el límite de ${limites.max_agentes} agentes` }, { status: 400 })
    }

    const body = await request.json()
    const { tipo_agente_id, nombre_custom, prompt_sistema, temperatura, max_tokens } = body

    const agente = await queryOne(
      `INSERT INTO configuracion_agente (cliente_id, usuario_id, tipo_agente_id, nombre_custom, nombre_agente, prompt_sistema, temperatura, max_tokens, activo)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, true)
       RETURNING *`,
      [user.cliente_id, user.id, tipo_agente_id, nombre_custom, prompt_sistema, temperatura || 0.7, max_tokens || 300]
    )

    return NextResponse.json(agente, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, nombre_custom, prompt_sistema, temperatura, max_tokens, activo, voice_id, responder_con_audio } = body

    await query(
      `UPDATE configuracion_agente SET
        nombre_custom = COALESCE($1, nombre_custom),
        nombre_agente = COALESCE($1, nombre_agente),
        prompt_sistema = COALESCE($2, prompt_sistema),
        temperatura = COALESCE($3, temperatura),
        max_tokens = COALESCE($4, max_tokens),
        activo = COALESCE($5, activo),
        voice_id = $8,
        responder_con_audio = COALESCE($9, responder_con_audio),
        updated_at = NOW()
       WHERE id = $6 AND cliente_id = $7`,
      [nombre_custom, prompt_sistema, temperatura, max_tokens, activo, id, user.cliente_id, voice_id || null, responder_con_audio]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    await query(
      `DELETE FROM configuracion_agente WHERE id = $1 AND cliente_id = $2`,
      [id, user.cliente_id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
