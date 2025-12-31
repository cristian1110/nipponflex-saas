import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import type { Etapa } from '@/types'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const etapas = await query<Etapa>(
      'SELECT * FROM etapas_pipeline WHERE cliente_id = $1 ORDER BY orden ASC',
      [user.cliente_id || 1]
    )

    return NextResponse.json(etapas)
  } catch (error) {
    console.error('Error fetching etapas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.nivel < 3) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const data = await request.json()
    const { nombre, color, orden } = data

    const result = await query<Etapa>(
      `INSERT INTO etapas_pipeline (cliente_id, nombre, color, orden)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.cliente_id || 1, nombre, color || '#6366f1', orden || 99]
    )

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Error creating etapa:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
