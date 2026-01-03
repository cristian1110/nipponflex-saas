import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const estado = searchParams.get('estado')

    let sql = `
      SELECT 
        c.id,
        c.titulo,
        c.descripcion,
        TO_CHAR(c.fecha_inicio, 'YYYY-MM-DD') as fecha,
        TO_CHAR(c.fecha_inicio, 'HH24:MI') as hora,
        COALESCE(EXTRACT(EPOCH FROM (c.fecha_fin - c.fecha_inicio))/60, 30)::int as duracion,
        c.estado,
        COALESCE(c.tipo, 'manual') as origen,
        c.lead_id,
        l.nombre as lead_nombre,
        l.telefono as lead_telefono,
        c.created_at
      FROM citas c
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE c.cliente_id = $1
    `
    const params: any[] = [user.cliente_id || 1]

    if (estado) {
      params.push(estado)
      sql += ` AND c.estado = $${params.length}`
    }

    sql += ` ORDER BY c.fecha_inicio DESC`

    const citas = await query(sql, params)
    return NextResponse.json(citas)
  } catch (error) {
    console.error('Error fetching citas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const data = await request.json()
    
    let fecha_inicio: string
    let fecha_fin: string
    
    if (data.fecha && data.hora) {
      fecha_inicio = `${data.fecha}T${data.hora}:00`
      const duracion = data.duracion || 30
      const endDate = new Date(fecha_inicio)
      endDate.setMinutes(endDate.getMinutes() + duracion)
      fecha_fin = endDate.toISOString()
    } else if (data.fecha_inicio) {
      fecha_inicio = data.fecha_inicio
      fecha_fin = data.fecha_fin || data.fecha_inicio
    } else {
      return NextResponse.json({ error: 'Fecha es requerida' }, { status: 400 })
    }

    const { titulo, descripcion, lead_id, lead_telefono, tipo, recordatorio_minutos, recordatorio_canal } = data

    if (!titulo) {
      return NextResponse.json({ error: 'Título es requerido' }, { status: 400 })
    }

    let leadId = lead_id
    let telefonoRecordatorio = lead_telefono?.replace(/\D/g, '') || null

    if (!leadId && lead_telefono) {
      const lead = await queryOne(
        `SELECT id, telefono FROM leads WHERE cliente_id = $1 AND telefono = $2`,
        [user.cliente_id || 1, telefonoRecordatorio]
      )
      if (lead) {
        leadId = lead.id
        telefonoRecordatorio = lead.telefono
      }
    } else if (leadId) {
      // Obtener teléfono del lead
      const lead = await queryOne(`SELECT telefono FROM leads WHERE id = $1`, [leadId])
      if (lead) telefonoRecordatorio = lead.telefono
    }

    const result = await queryOne(
      `INSERT INTO citas (cliente_id, usuario_id, lead_id, titulo, descripcion, fecha_inicio, fecha_fin, tipo, estado, recordatorio_minutos, recordatorio_canal, telefono_recordatorio, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente', $9, $10, $11, NOW())
       RETURNING *`,
      [
        user.cliente_id || 1,
        user.id,
        leadId || null,
        titulo,
        descripcion || null,
        fecha_inicio,
        fecha_fin,
        tipo || 'manual',
        recordatorio_minutos || 120, // Por defecto 2 horas
        recordatorio_canal || 'whatsapp',
        telefonoRecordatorio
      ]
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating cita:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const data = await request.json()
    const { id, titulo, descripcion, fecha, hora, duracion, estado } = data

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (titulo !== undefined) {
      updates.push(`titulo = $${paramIndex++}`)
      params.push(titulo)
    }

    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex++}`)
      params.push(descripcion)
    }

    if (estado !== undefined) {
      updates.push(`estado = $${paramIndex++}`)
      params.push(estado)
    }

    if (fecha && hora) {
      const fecha_inicio = `${fecha}T${hora}:00`
      const dur = duracion || 30
      const endDate = new Date(fecha_inicio)
      endDate.setMinutes(endDate.getMinutes() + dur)
      
      updates.push(`fecha_inicio = $${paramIndex++}`)
      params.push(fecha_inicio)
      
      updates.push(`fecha_fin = $${paramIndex++}`)
      params.push(endDate.toISOString())
    }

    updates.push(`updated_at = NOW()`)

    params.push(id)
    params.push(user.cliente_id || 1)

    const sql = `UPDATE citas SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND cliente_id = $${paramIndex} RETURNING *`

    const result = await queryOne(sql, params)

    if (!result) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating cita:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const result = await query(
      `DELETE FROM citas WHERE id = $1 AND cliente_id = $2 RETURNING id`,
      [id, user.cliente_id || 1]
    )

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('Error deleting cita:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
