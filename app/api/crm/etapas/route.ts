import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const pipelineId = searchParams.get('pipeline_id')

    if (!pipelineId) {
      return NextResponse.json({ error: 'pipeline_id requerido' }, { status: 400 })
    }

    const etapas = await query(
      `SELECT e.*, 
        (SELECT COUNT(*) FROM leads l WHERE l.etapa_id = e.id) as total_leads,
        (SELECT COALESCE(SUM(valor_estimado), 0) FROM leads l WHERE l.etapa_id = e.id) as valor_total
       FROM etapas_crm e 
       WHERE e.pipeline_id = $1
       ORDER BY e.orden`,
      [pipelineId]
    )

    return NextResponse.json(etapas)
  } catch (error) {
    console.error('Error etapas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { pipeline_id, nombre, color, orden } = body

    if (!pipeline_id || !nombre) {
      return NextResponse.json({ error: 'pipeline_id y nombre requeridos' }, { status: 400 })
    }

    // Obtener siguiente orden si no se especifica
    let ordenFinal = orden
    if (!ordenFinal) {
      const max = await queryOne(
        `SELECT COALESCE(MAX(orden), 0) + 1 as next FROM etapas_crm WHERE pipeline_id = $1`,
        [pipeline_id]
      )
      ordenFinal = max.next
    }

    const etapa = await queryOne(
      `INSERT INTO etapas_crm (cuenta_id, pipeline_id, nombre, color, orden)
       VALUES (1, $1, $2, $3, $4) RETURNING *`,
      [pipeline_id, nombre, color || '#3498db', ordenFinal]
    )

    return NextResponse.json(etapa, { status: 201 })
  } catch (error) {
    console.error('Error crear etapa:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, nombre, color, orden, es_ganado, es_perdido } = body

    await query(
      `UPDATE etapas_crm SET 
        nombre = COALESCE($1, nombre),
        color = COALESCE($2, color),
        orden = COALESCE($3, orden),
        es_ganado = COALESCE($4, es_ganado),
        es_perdido = COALESCE($5, es_perdido)
       WHERE id = $6`,
      [nombre, color, orden, es_ganado, es_perdido, id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error actualizar etapa:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    // Mover leads de esta etapa a la primera del pipeline
    const etapa = await queryOne(`SELECT pipeline_id FROM etapas_crm WHERE id = $1`, [id])
    if (etapa) {
      const primera = await queryOne(
        `SELECT id FROM etapas_crm WHERE pipeline_id = $1 AND id != $2 ORDER BY orden LIMIT 1`,
        [etapa.pipeline_id, id]
      )
      if (primera) {
        await query(`UPDATE leads SET etapa_id = $1 WHERE etapa_id = $2`, [primera.id, id])
      }
    }

    await query(`DELETE FROM etapas_crm WHERE id = $1`, [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminar etapa:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
