import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const agentes = await query(
      `SELECT * FROM configuracion_agente WHERE cliente_id = $1 ORDER BY created_at DESC`,
      [user.cliente_id]
    )
    return NextResponse.json(agentes)
  } catch (error) {
    console.error('Error agentes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { nombre_agente, prompt_sistema, temperatura, max_tokens } = body

    const agente = await queryOne(
      `INSERT INTO configuracion_agente (cliente_id, nombre_agente, prompt_sistema, temperatura, max_tokens)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user.cliente_id, nombre_agente, prompt_sistema, temperatura || 0.7, max_tokens || 300]
    )
    return NextResponse.json(agente, { status: 201 })
  } catch (error) {
    console.error('Error crear agente:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, nombre_agente, prompt_sistema, temperatura, max_tokens, activo } = body

    const agente = await queryOne(
      `UPDATE configuracion_agente 
       SET nombre_agente = COALESCE($1, nombre_agente),
           prompt_sistema = COALESCE($2, prompt_sistema),
           temperatura = COALESCE($3, temperatura),
           max_tokens = COALESCE($4, max_tokens),
           activo = COALESCE($5, activo),
           updated_at = NOW()
       WHERE id = $6 AND cliente_id = $7
       RETURNING *`,
      [nombre_agente, prompt_sistema, temperatura, max_tokens, activo, id, user.cliente_id]
    )
    return NextResponse.json(agente)
  } catch (error) {
    console.error('Error actualizar agente:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
