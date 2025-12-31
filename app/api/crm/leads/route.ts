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
    const etapaId = searchParams.get('etapa_id')

    let sql = `
      SELECT l.*, e.nombre as etapa_nombre, e.color as etapa_color,
        (SELECT COUNT(*) FROM historial_conversaciones h WHERE h.numero_whatsapp = l.telefono) as total_mensajes
      FROM leads l
      LEFT JOIN etapas_crm e ON l.etapa_id = e.id
      WHERE l.cliente_id = $1
    `
    const params: any[] = [user.cliente_id]

    if (pipelineId) {
      params.push(pipelineId)
      sql += ` AND l.pipeline_id = $${params.length}`
    }

    if (etapaId) {
      params.push(etapaId)
      sql += ` AND l.etapa_id = $${params.length}`
    }

    sql += ` ORDER BY l.created_at DESC`

    const leads = await query(sql, params)
    return NextResponse.json(leads)
  } catch (error) {
    console.error('Error leads:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { nombre, telefono, email, empresa, pipeline_id, etapa_id, valor_estimado, notas } = body

    if (!telefono) {
      return NextResponse.json({ error: 'Teléfono requerido' }, { status: 400 })
    }

    // Formatear teléfono
    let tel = telefono.toString().replace(/\s/g, '').replace(/-/g, '')
    if (!tel.startsWith('+')) {
      if (tel.startsWith('593')) tel = '+' + tel
      else if (tel.startsWith('0')) tel = '+593' + tel.substring(1)
      else tel = '+593' + tel
    }

    // Si no se especifica etapa, obtener la primera del pipeline
    let etapaFinal = etapa_id
    if (!etapaFinal && pipeline_id) {
      const primera = await queryOne(
        `SELECT id FROM etapas_crm WHERE pipeline_id = $1 ORDER BY orden LIMIT 1`,
        [pipeline_id]
      )
      etapaFinal = primera?.id
    }

    const lead = await queryOne(
      `INSERT INTO leads (cliente_id, cuenta_id, nombre, telefono, email, empresa, pipeline_id, etapa_id, valor_estimado, notas)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [user.cliente_id, nombre || 'Sin nombre', tel, email, empresa, pipeline_id, etapaFinal, valor_estimado || 0, notas]
    )

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Error crear lead:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, etapa_id, nombre, telefono, email, empresa, valor_estimado, notas } = body

    if (etapa_id !== undefined) {
      // Solo mover de etapa
      await query(
        `UPDATE leads SET etapa_id = $1, updated_at = NOW() WHERE id = $2 AND cliente_id = $3`,
        [etapa_id, id, user.cliente_id]
      )
    } else {
      // Actualizar datos completos
      await query(
        `UPDATE leads SET 
          nombre = COALESCE($1, nombre),
          telefono = COALESCE($2, telefono),
          email = COALESCE($3, email),
          empresa = COALESCE($4, empresa),
          valor_estimado = COALESCE($5, valor_estimado),
          notas = COALESCE($6, notas),
          updated_at = NOW()
         WHERE id = $7 AND cliente_id = $8`,
        [nombre, telefono, email, empresa, valor_estimado, notas, id, user.cliente_id]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error actualizar lead:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { ids, deleteAll, pipeline_id } = body

    if (deleteAll && pipeline_id) {
      await query(`DELETE FROM leads WHERE cliente_id = $1 AND pipeline_id = $2`, [user.cliente_id, pipeline_id])
      return NextResponse.json({ success: true, message: 'Todos los leads del pipeline eliminados' })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      await query(
        `DELETE FROM leads WHERE cliente_id = $1 AND id = ANY($2)`,
        [user.cliente_id, ids]
      )
      return NextResponse.json({ success: true, deleted: ids.length })
    }

    return NextResponse.json({ error: 'No se especificaron leads' }, { status: 400 })
  } catch (error) {
    console.error('Error eliminar leads:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
