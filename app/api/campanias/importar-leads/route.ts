import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { campania_id, lead_ids } = await request.json()

    if (!campania_id || !lead_ids?.length) {
      return NextResponse.json({ error: 'campania_id y lead_ids requeridos' }, { status: 400 })
    }

    let agregados = 0

    for (const lead_id of lead_ids) {
      const lead = await query(`SELECT * FROM leads WHERE id = $1 AND cliente_id = $2`, [lead_id, user.cliente_id])
      
      if (lead.length > 0) {
        const l = lead[0]
        await query(`
          INSERT INTO campania_contactos (campania_id, lead_id, nombre, numero_whatsapp, email, empresa, estado)
          VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
          ON CONFLICT DO NOTHING
        `, [campania_id, l.id, l.nombre, l.telefono, l.email, l.empresa])
        agregados++
      }
    }

    return NextResponse.json({ agregados })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
