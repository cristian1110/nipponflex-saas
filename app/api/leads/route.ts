import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || 'all'
    const limit = parseInt(searchParams.get('limit') || '500')
    const search = searchParams.get('search') || ''

    console.log('API Leads - user:', user.cliente_id, 'source:', source, 'limit:', limit)

    let results: any[] = []

    // Obtener de tabla leads
    if (source === 'all' || source === 'leads') {
      const leads = await query(`
        SELECT
          id, nombre, telefono as numero_whatsapp, email, empresa,
          'lead' as origen, etapa_id, created_at
        FROM leads
        WHERE cliente_id = $1
        ${search ? `AND (nombre ILIKE $2 OR telefono ILIKE $2 OR empresa ILIKE $2)` : ''}
        ORDER BY created_at DESC
        LIMIT $${search ? '3' : '2'}
      `, search ? [user.cliente_id, `%${search}%`, limit] : [user.cliente_id, limit])
      console.log('Leads encontrados:', leads.length)
      results = [...results, ...leads]
    }

    // Obtener de tabla contactos
    if (source === 'all' || source === 'contactos') {
      const contactos = await query(`
        SELECT
          id, nombre, telefono as numero_whatsapp, email, empresa,
          'contacto' as origen, null as etapa_id, created_at
        FROM contactos
        WHERE cliente_id = $1
        ${search ? `AND (nombre ILIKE $2 OR telefono ILIKE $2 OR empresa ILIKE $2)` : ''}
        ORDER BY created_at DESC
        LIMIT $${search ? '3' : '2'}
      `, search ? [user.cliente_id, `%${search}%`, limit] : [user.cliente_id, limit])
      console.log('Contactos encontrados:', contactos.length)
      results = [...results, ...contactos]
    }

    // Ordenar por fecha y limitar
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    results = results.slice(0, limit)

    console.log('Total resultados:', results.length)

    return NextResponse.json({
      leads: results,
      total: results.length,
      totalLeads: results.filter(r => r.origen === 'lead').length,
      totalContactos: results.filter(r => r.origen === 'contacto').length
    })
  } catch (error) {
    console.error('Error API leads:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
