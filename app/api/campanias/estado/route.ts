import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { campania_id, estado } = await request.json()

    if (!campania_id || !estado) {
      return NextResponse.json({ error: 'campania_id y estado requeridos' }, { status: 400 })
    }

    const estadosValidos = ['borrador', 'activa', 'pausada', 'completada']
    if (!estadosValidos.includes(estado)) {
      return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })
    }

    // Verificar que la campaña tenga contactos si se va a activar
    if (estado === 'activa') {
      const count = await queryOne(`
        SELECT COUNT(*) as total FROM campania_contactos WHERE campania_id = $1
      `, [campania_id])
      
      if (!count || count.total === 0) {
        return NextResponse.json({ error: 'La campaña debe tener contactos para activarse' }, { status: 400 })
      }
    }

    await query(`
      UPDATE campanias SET estado = $1 WHERE id = $2 AND cliente_id = $3
    `, [estado, campania_id, user.cliente_id])

    return NextResponse.json({ success: true, estado })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
