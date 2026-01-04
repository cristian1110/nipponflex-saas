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
    const etapa_id = searchParams.get('etapa_id')
    const pipeline_id = searchParams.get('pipeline_id')
    const origen = searchParams.get('origen')

    let results: any[] = []

    // Obtener de tabla leads
    if (source === 'all' || source === 'leads') {
      let sql = `
        SELECT
          l.id, l.nombre, l.telefono as numero_whatsapp, l.email, l.empresa,
          l.origen, l.etapa_id, l.created_at,
          e.nombre as etapa_nombre
        FROM leads l
        LEFT JOIN etapas_crm e ON l.etapa_id = e.id
        WHERE l.cliente_id = $1
      `
      const params: any[] = [user.cliente_id]
      let paramIdx = 2

      if (search) {
        sql += ` AND (l.nombre ILIKE $${paramIdx} OR l.telefono ILIKE $${paramIdx} OR l.empresa ILIKE $${paramIdx})`
        params.push(`%${search}%`)
        paramIdx++
      }

      if (etapa_id) {
        sql += ` AND l.etapa_id = $${paramIdx}`
        params.push(parseInt(etapa_id))
        paramIdx++
      }

      if (pipeline_id) {
        // Filtrar por pipeline_id del lead O por el pipeline de la etapa
        sql += ` AND (l.pipeline_id = $${paramIdx} OR e.pipeline_id = $${paramIdx})`
        params.push(parseInt(pipeline_id))
        paramIdx++
      }

      if (origen) {
        sql += ` AND l.origen = $${paramIdx}`
        params.push(origen)
        paramIdx++
      }

      sql += ` ORDER BY l.created_at DESC LIMIT $${paramIdx}`
      params.push(limit)

      const leads = await query(sql, params)
      results = [...results, ...leads]
    }

    // Obtener de tabla contactos (solo si no hay filtros de etapa/pipeline)
    if ((source === 'all' || source === 'contactos') && !etapa_id && !pipeline_id) {
      let sqlContactos = `
        SELECT
          id, nombre, telefono as numero_whatsapp, email, empresa,
          'contacto' as origen_tipo, null as etapa_id, created_at,
          null as etapa_nombre
        FROM contactos
        WHERE cliente_id = $1
      `
      const paramsContactos: any[] = [user.cliente_id]
      let pIdx = 2

      if (search) {
        sqlContactos += ` AND (nombre ILIKE $${pIdx} OR telefono ILIKE $${pIdx} OR empresa ILIKE $${pIdx})`
        paramsContactos.push(`%${search}%`)
        pIdx++
      }

      sqlContactos += ` ORDER BY created_at DESC LIMIT $${pIdx}`
      paramsContactos.push(limit)

      const contactos = await query(sqlContactos, paramsContactos)
      results = [...results, ...contactos]
    }

    // Ordenar por fecha y limitar
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    results = results.slice(0, limit)

    return NextResponse.json({
      leads: results,
      total: results.length
    })
  } catch (error) {
    console.error('Error API leads:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
