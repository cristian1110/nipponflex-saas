import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    let sql = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM historial_conversaciones h WHERE h.numero_whatsapp = c.telefono AND h.cliente_id = c.cliente_id) as total_mensajes
      FROM contactos c
      WHERE c.cliente_id = $1
    `
    const params: any[] = [user.cliente_id]

    if (search) {
      sql += ` AND (c.nombre ILIKE $2 OR c.telefono ILIKE $2 OR c.email ILIKE $2)`
      params.push(`%${search}%`)
    }

    sql += ` ORDER BY c.created_at DESC LIMIT ${limit} OFFSET ${offset}`

    const contactos = await query(sql, params)
    
    // Total para paginación
    const totalRes = await queryOne(
      `SELECT COUNT(*) as total FROM contactos WHERE cliente_id = $1`,
      [user.cliente_id]
    )

    return NextResponse.json({
      contactos,
      total: parseInt(totalRes?.total || '0'),
      page,
      limit
    })
  } catch (error) {
    console.error('Error contactos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { nombre, telefono, email, empresa, tags } = body

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

    const contacto = await queryOne(
      `INSERT INTO contactos (cliente_id, nombre, telefono, email, empresa, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (cliente_id, telefono) DO UPDATE SET
         nombre = COALESCE(EXCLUDED.nombre, contactos.nombre),
         email = COALESCE(EXCLUDED.email, contactos.email),
         empresa = COALESCE(EXCLUDED.empresa, contactos.empresa),
         updated_at = NOW()
       RETURNING *`,
      [user.cliente_id, nombre || 'Sin nombre', tel, email, empresa, tags]
    )

    return NextResponse.json(contacto, { status: 201 })
  } catch (error) {
    console.error('Error crear contacto:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { ids, deleteAll } = body

    if (deleteAll) {
      await query(`DELETE FROM contactos WHERE cliente_id = $1`, [user.cliente_id])
      return NextResponse.json({ success: true, message: 'Todos los contactos eliminados' })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      await query(
        `DELETE FROM contactos WHERE cliente_id = $1 AND id = ANY($2)`,
        [user.cliente_id, ids]
      )
      return NextResponse.json({ success: true, deleted: ids.length })
    }

    return NextResponse.json({ error: 'No se especificaron contactos' }, { status: 400 })
  } catch (error) {
    console.error('Error eliminar contactos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
