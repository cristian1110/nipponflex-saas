import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const campania_id = searchParams.get('campania_id')

    if (!campania_id) {
      return NextResponse.json({ error: 'campania_id requerido' }, { status: 400 })
    }

    const contactos = await query(`
      SELECT cc.*, e.nombre as etapa_nombre, e.color as etapa_color
      FROM campania_contactos cc
      LEFT JOIN etapas_crm e ON cc.etapa_id = e.id
      WHERE cc.campania_id = $1
      ORDER BY cc.id DESC
    `, [campania_id])

    return NextResponse.json(contactos)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { campania_id, contactos } = await request.json()

    if (!campania_id || !contactos?.length) {
      return NextResponse.json({ error: 'campania_id y contactos requeridos' }, { status: 400 })
    }

    let agregados = 0
    let duplicados = 0

    for (const c of contactos) {
      try {
        await query(`
          INSERT INTO campania_contactos (campania_id, nombre, numero_whatsapp, email, empresa, estado)
          VALUES ($1, $2, $3, $4, $5, 'pendiente')
          ON CONFLICT DO NOTHING
        `, [campania_id, c.nombre, c.telefono || c.numero_whatsapp, c.email, c.empresa])
        agregados++
      } catch {
        duplicados++
      }
    }

    return NextResponse.json({ agregados, duplicados })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
