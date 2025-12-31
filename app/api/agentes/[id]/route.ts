import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const agente = await queryOne(
      `SELECT * FROM agentes WHERE id = $1 AND cliente_id = $2`,
      [params.id, user.cliente_id]
    )
    if (!agente) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
    return NextResponse.json(agente)
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.nivel < 3) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await request.json()
    const fields = ['nombre', 'descripcion', 'prompt_sistema', 'personalidad', 'temperatura', 'modelo', 'whatsapp_numero', 'telegram_bot', 'activo']
    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${idx}`)
        values.push(body[field])
        idx++
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })

    updates.push(`updated_at = NOW()`)
    values.push(params.id, user.cliente_id)

    const agente = await queryOne(
      `UPDATE agentes SET ${updates.join(', ')} WHERE id = $${idx} AND cliente_id = $${idx + 1} RETURNING *`,
      values
    )
    return NextResponse.json(agente)
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (user.nivel < 4) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    await execute(`DELETE FROM agentes WHERE id = $1 AND cliente_id = $2`, [params.id, user.cliente_id])
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
