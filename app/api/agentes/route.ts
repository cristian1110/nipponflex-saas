import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const agentes = await query(
      `SELECT * FROM agentes WHERE cliente_id = $1 ORDER BY created_at DESC`,
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
    if (user.nivel < 3) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await request.json()
    const { nombre, descripcion, prompt_sistema, personalidad, temperatura, modelo, whatsapp_numero, telegram_bot } = body

    const agente = await queryOne(
      `INSERT INTO agentes (cliente_id, nombre, descripcion, prompt_sistema, personalidad, temperatura, modelo, whatsapp_numero, telegram_bot, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
      [user.cliente_id, nombre, descripcion, prompt_sistema, personalidad || 'profesional', temperatura || 0.7, modelo || 'llama-3.3-70b-versatile', whatsapp_numero, telegram_bot]
    )
    return NextResponse.json(agente, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
