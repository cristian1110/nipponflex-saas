import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET - Listar campañas
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const campanias = await query(`
      SELECT c.*, 
        p.nombre as pipeline_nombre,
        e.nombre as etapa_nombre,
        ca.nombre_custom as agente_nombre,
        (SELECT COUNT(*) FROM campania_contactos WHERE campania_id = c.id) as contactos_count,
        (SELECT COUNT(*) FROM campania_contactos WHERE campania_id = c.id AND estado = 'enviado') as enviados_count,
        (SELECT COUNT(*) FROM campania_contactos WHERE campania_id = c.id AND estado = 'respondido') as respondidos_count
      FROM campanias c
      LEFT JOIN pipelines p ON c.pipeline_id = p.id
      LEFT JOIN etapas_crm e ON c.etapa_inicial_id = e.id
      LEFT JOIN configuracion_agente ca ON c.agente_id = ca.id
      WHERE c.cliente_id = $1
      ORDER BY c.created_at DESC
    `, [user.cliente_id])

    return NextResponse.json(campanias)
  } catch (error) {
    console.error('Error GET campanias:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear campaña
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      nombre,
      descripcion,
      mensaje_plantilla,
      mensaje_seguimiento,
      pipeline_id,
      etapa_inicial_id,
      agente_id,
      horario_inicio,
      horario_fin,
      dias_semana,
      delay_min,
      delay_max,
      contactos_por_dia,
      dias_sin_respuesta,
      max_seguimientos,
      // Nuevos campos multimedia
      tipo_media,
      media_url,
      media_base64,
      media_mimetype
    } = body

    if (!nombre || !pipeline_id) {
      return NextResponse.json({ error: 'Nombre y pipeline son requeridos' }, { status: 400 })
    }

    // Validar que tenga mensaje o media
    if (!mensaje_plantilla && !media_url && !media_base64) {
      return NextResponse.json({ error: 'Se requiere mensaje o media' }, { status: 400 })
    }

    const campania = await queryOne(`
      INSERT INTO campanias (
        cliente_id, nombre, descripcion, mensaje_plantilla, mensaje_seguimiento,
        pipeline_id, etapa_inicial_id, agente_id,
        horario_inicio, horario_fin, dias_semana,
        delay_min, delay_max, contactos_por_dia,
        dias_sin_respuesta, max_seguimientos, estado,
        tipo_media, media_url, media_base64, media_mimetype
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'borrador', $17, $18, $19, $20)
      RETURNING *
    `, [
      user.cliente_id, nombre, descripcion, mensaje_plantilla || '', mensaje_seguimiento,
      pipeline_id, etapa_inicial_id, agente_id,
      horario_inicio || '09:00', horario_fin || '18:00', dias_semana || '1,2,3,4,5',
      delay_min || 30, delay_max || 90, contactos_por_dia || 20,
      dias_sin_respuesta || 3, max_seguimientos || 2,
      tipo_media || 'texto', media_url, media_base64, media_mimetype
    ])

    return NextResponse.json(campania, { status: 201 })
  } catch (error) {
    console.error('Error POST campanias:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT - Actualizar campaña
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, ...datos } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const campos = []
    const valores = []
    let idx = 1

    for (const [key, value] of Object.entries(datos)) {
      if (value !== undefined) {
        campos.push(`${key} = $${idx}`)
        valores.push(value)
        idx++
      }
    }

    if (campos.length === 0) {
      return NextResponse.json({ error: 'No hay datos para actualizar' }, { status: 400 })
    }

    campos.push(`updated_at = NOW()`)
    valores.push(id, user.cliente_id)

    await query(`
      UPDATE campanias SET ${campos.join(', ')}
      WHERE id = $${idx} AND cliente_id = $${idx + 1}
    `, valores)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error PUT campanias:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Eliminar campaña
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    await query('DELETE FROM campanias WHERE id = $1 AND cliente_id = $2', [id, user.cliente_id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error DELETE campanias:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
