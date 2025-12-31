import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get('periodo') || 'mes'

    let dias = 30
    switch (periodo) {
      case 'semana': dias = 7; break
      case 'trimestre': dias = 90; break
      case 'año': dias = 365; break
    }

    const fechaInicio = new Date()
    fechaInicio.setDate(fechaInicio.getDate() - dias)

    // Métricas principales
    const metricas = await queryOne(`
      SELECT
        (SELECT COUNT(*) FROM leads WHERE cliente_id = $1 AND created_at >= $2) as "totalLeads",
        (SELECT COUNT(*) FROM leads l JOIN etapas_pipeline e ON l.etapa_id = e.id WHERE l.cliente_id = $1 AND e.es_ganado = true AND l.created_at >= $2) as "leadsGanados",
        (SELECT COUNT(*) FROM leads l JOIN etapas_pipeline e ON l.etapa_id = e.id WHERE l.cliente_id = $1 AND e.es_perdido = true AND l.created_at >= $2) as "leadsPerdidos",
        (SELECT COALESCE(SUM(valor_estimado), 0) FROM leads l JOIN etapas_pipeline e ON l.etapa_id = e.id WHERE l.cliente_id = $1 AND e.es_ganado = true AND l.created_at >= $2) as "valorTotal",
        (SELECT COUNT(*) FROM mensajes WHERE cliente_id = $1 AND created_at >= $2) as "mensajesTotales",
        (SELECT COUNT(*) FROM citas WHERE cliente_id = $1 AND estado = 'completada' AND created_at >= $2) as "citasCompletadas"
    `, [user.cliente_id, fechaInicio.toISOString()])

    const totalLeads = parseInt(metricas?.totalLeads || '0')
    const leadsGanados = parseInt(metricas?.leadsGanados || '0')
    const conversionRate = totalLeads > 0 ? (leadsGanados / totalLeads) * 100 : 0

    // Leads por etapa
    const leadsPorEtapa = await query(`
      SELECT e.nombre as etapa, e.color, COUNT(l.id) as total
      FROM etapas_pipeline e
      LEFT JOIN leads l ON l.etapa_id = e.id AND l.created_at >= $2
      WHERE e.cliente_id = $1
      GROUP BY e.id, e.nombre, e.color, e.orden
      ORDER BY e.orden
    `, [user.cliente_id, fechaInicio.toISOString()])

    // Leads por origen
    const leadsPorOrigen = await query(`
      SELECT COALESCE(origen, 'Directo') as origen, COUNT(*) as total
      FROM leads
      WHERE cliente_id = $1 AND created_at >= $2
      GROUP BY origen
      ORDER BY total DESC
    `, [user.cliente_id, fechaInicio.toISOString()])

    // Actividad diaria (últimos 14 días)
    const actividadDiaria = await query(`
      SELECT 
        d.fecha,
        COALESCE(l.leads, 0) as leads,
        COALESCE(m.mensajes, 0) as mensajes
      FROM (
        SELECT generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day')::date as fecha
      ) d
      LEFT JOIN (
        SELECT DATE(created_at) as fecha, COUNT(*) as leads
        FROM leads WHERE cliente_id = $1
        GROUP BY DATE(created_at)
      ) l ON d.fecha = l.fecha
      LEFT JOIN (
        SELECT DATE(created_at) as fecha, COUNT(*) as mensajes
        FROM mensajes WHERE cliente_id = $1
        GROUP BY DATE(created_at)
      ) m ON d.fecha = m.fecha
      ORDER BY d.fecha
    `, [user.cliente_id])

    return NextResponse.json({
      metricas: {
        ...metricas,
        totalLeads,
        leadsGanados: parseInt(metricas?.leadsGanados || '0'),
        leadsPerdidos: parseInt(metricas?.leadsPerdidos || '0'),
        valorTotal: parseFloat(metricas?.valorTotal || '0'),
        conversionRate,
        mensajesTotales: parseInt(metricas?.mensajesTotales || '0'),
        citasCompletadas: parseInt(metricas?.citasCompletadas || '0'),
        tiempoPromedioRespuesta: 5, // TODO: calcular real
      },
      leadsPorEtapa: leadsPorEtapa.map(e => ({ ...e, total: parseInt(e.total) })),
      leadsPorOrigen: leadsPorOrigen.map(e => ({ ...e, total: parseInt(e.total) })),
      actividadDiaria: actividadDiaria.map(d => ({ ...d, leads: parseInt(d.leads), mensajes: parseInt(d.mensajes) })),
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
