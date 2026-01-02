import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get('periodo') || '7d'

    let intervalo = "7 days"
    if (periodo === '24h') intervalo = "24 hours"
    else if (periodo === '30d') intervalo = "30 days"

    // Métricas generales
    const metricas = await queryOne(`
      SELECT 
        COALESCE(SUM(mensajes_enviados), 0) as total_enviados,
        COALESCE(SUM(mensajes_recibidos), 0) as total_recibidos,
        COALESCE(SUM(conversaciones_nuevas), 0) as total_conversaciones,
        COALESCE(SUM(leads_nuevos), 0) as total_leads,
        COALESCE(SUM(citas_agendadas), 0) as total_citas,
        COALESCE(AVG(tiempo_respuesta_avg), 0) as tiempo_respuesta_promedio
      FROM metricas_realtime
      WHERE cliente_id = $1
        AND fecha >= CURRENT_DATE - INTERVAL '${intervalo}'
    `, [user.cliente_id])

    // Métricas por día (para gráficas)
    const porDia = await query(`
      SELECT 
        fecha,
        SUM(mensajes_enviados) as enviados,
        SUM(mensajes_recibidos) as recibidos,
        SUM(leads_nuevos) as leads
      FROM metricas_realtime
      WHERE cliente_id = $1
        AND fecha >= CURRENT_DATE - INTERVAL '${intervalo}'
      GROUP BY fecha
      ORDER BY fecha ASC
    `, [user.cliente_id])

    // Estado de campañas activas
    const campanasActivas = await query(`
      SELECT 
        c.id, c.nombre, c.estado,
        c.contactos_count, c.enviados_count, c.respondidos_count,
        ROUND(c.respondidos_count::NUMERIC / NULLIF(c.enviados_count, 0) * 100, 1) as tasa_respuesta
      FROM campanias c
      WHERE c.cliente_id = $1 AND c.estado = 'activa'
      ORDER BY c.created_at DESC
    `, [user.cliente_id])

    // Estado de instancias
    const instancias = await query(`
      SELECT 
        nombre, numero_whatsapp, estado,
        mensajes_dia_enviados, mensajes_dia_limite,
        ultimo_ping
      FROM instancias_whatsapp
      WHERE cliente_id = $1
    `, [user.cliente_id])

    return NextResponse.json({
      resumen: metricas,
      porDia,
      campanasActivas,
      instancias
    })
  } catch (error) {
    console.error('Error métricas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
