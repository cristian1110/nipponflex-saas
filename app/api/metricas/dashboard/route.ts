import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get('periodo') || 'semana'

    let dias = 7
    switch (periodo) {
      case 'dia': dias = 1; break
      case 'semana': dias = 7; break
      case 'mes': dias = 30; break
      case 'trimestre': dias = 90; break
    }

    // Query optimizada: obtener cliente con límites directamente
    const cliente = await queryOne(`
      SELECT
        c.limite_mensajes_mes, c.limite_contactos, c.uso_mensajes_mes,
        COALESCE(p.nombre, 'Básico') as plan_nombre,
        COALESCE(p.max_campanas_mes, 5) as max_campanas
      FROM clientes c
      LEFT JOIN planes p ON c.plan_id = p.id
      WHERE c.id = $1
    `, [user.cliente_id])

    // Query optimizada: métricas de uso en una sola consulta
    const uso = await queryOne(`
      SELECT
        (SELECT COUNT(*) FROM campanias WHERE cliente_id = $1 AND estado IN ('activa', 'pausada')) as campanas_activas,
        (SELECT COUNT(*) FROM leads WHERE cliente_id = $1) +
        (SELECT COUNT(*) FROM contactos WHERE cliente_id = $1) as contactos_totales
    `, [user.cliente_id])

    // Query optimizada: mensajes por día con parámetro
    const mensajesPorDia = await query(`
      WITH fechas AS (
        SELECT generate_series(CURRENT_DATE - ($2 - 1) * INTERVAL '1 day', CURRENT_DATE, '1 day')::date as fecha
      )
      SELECT
        f.fecha,
        COALESCE(SUM(CASE WHEN h.rol = 'assistant' THEN 1 ELSE 0 END), 0) as enviados,
        COALESCE(SUM(CASE WHEN h.rol = 'user' THEN 1 ELSE 0 END), 0) as recibidos
      FROM fechas f
      LEFT JOIN historial_conversaciones h ON DATE(h.created_at) = f.fecha AND h.cliente_id = $1
      GROUP BY f.fecha
      ORDER BY f.fecha
    `, [user.cliente_id, dias])

    // Query optimizada: leads por día
    const leadsPorDia = await query(`
      WITH fechas AS (
        SELECT generate_series(CURRENT_DATE - ($2 - 1) * INTERVAL '1 day', CURRENT_DATE, '1 day')::date as fecha
      )
      SELECT f.fecha, COUNT(l.id) as leads
      FROM fechas f
      LEFT JOIN leads l ON DATE(l.created_at) = f.fecha AND l.cliente_id = $1
      GROUP BY f.fecha
      ORDER BY f.fecha
    `, [user.cliente_id, dias])

    // Query optimizada: campañas con métricas agregadas
    const campanias = await query(`
      SELECT
        c.id, c.nombre, c.estado,
        COUNT(cc.id) as total_contactos,
        COUNT(CASE WHEN cc.estado = 'enviado' THEN 1 END) as enviados,
        COUNT(CASE WHEN cc.estado = 'respondido' THEN 1 END) as respondidos
      FROM campanias c
      LEFT JOIN campania_contactos cc ON cc.campania_id = c.id
      WHERE c.cliente_id = $1
      GROUP BY c.id, c.nombre, c.estado, c.created_at
      ORDER BY c.created_at DESC
      LIMIT 5
    `, [user.cliente_id])

    // Query: leads por origen
    const leadsPorOrigen = await query(`
      SELECT COALESCE(origen, 'Directo') as nombre, COUNT(*) as valor
      FROM leads
      WHERE cliente_id = $1 AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
      GROUP BY origen
      ORDER BY valor DESC
      LIMIT 5
    `, [user.cliente_id, dias])

    // Query: leads por etapa
    const leadsPorEtapa = await query(`
      SELECT e.nombre, e.color, COUNT(l.id) as valor
      FROM etapas_crm e
      LEFT JOIN leads l ON l.etapa_id = e.id
      WHERE e.pipeline_id IN (SELECT id FROM pipelines WHERE cliente_id = $1)
      GROUP BY e.id, e.nombre, e.color, e.orden
      ORDER BY e.orden
    `, [user.cliente_id])

    // Query: respuestas por hora (últimos 30 días fijo)
    const respuestasPorHora = await query(`
      SELECT EXTRACT(HOUR FROM created_at)::int as hora, COUNT(*) as total
      FROM historial_conversaciones
      WHERE cliente_id = $1 AND rol = 'user' AND created_at >= CURRENT_DATE - 30
      GROUP BY EXTRACT(HOUR FROM created_at)
    `, [user.cliente_id])

    const formatearFecha = (fecha: string) => {
      const d = new Date(fecha)
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    }

    const limiteMensajes = cliente?.limite_mensajes_mes || 1000
    const limiteContactos = cliente?.limite_contactos || 500
    const limiteCampanas = cliente?.max_campanas || 5
    const mensajesUsados = cliente?.uso_mensajes_mes || 0
    const campanasActivas = parseInt(uso?.campanas_activas || '0')
    const contactosTotales = parseInt(uso?.contactos_totales || '0')

    return NextResponse.json({
      usoPlan: {
        mensajes: {
          usados: mensajesUsados,
          limite: limiteMensajes,
          porcentaje: Math.min(100, Math.round((mensajesUsados / limiteMensajes) * 100))
        },
        campanas: {
          activas: campanasActivas,
          limite: limiteCampanas,
          porcentaje: Math.min(100, Math.round((campanasActivas / limiteCampanas) * 100))
        },
        contactos: {
          total: contactosTotales,
          limite: limiteContactos,
          porcentaje: Math.min(100, Math.round((contactosTotales / limiteContactos) * 100))
        },
        planNombre: cliente?.plan_nombre || 'Básico'
      },
      mensajesPorDia: mensajesPorDia.map(m => ({
        fecha: formatearFecha(m.fecha),
        enviados: parseInt(m.enviados),
        recibidos: parseInt(m.recibidos)
      })),
      leadsPorDia: leadsPorDia.map(l => ({
        fecha: formatearFecha(l.fecha),
        leads: parseInt(l.leads)
      })),
      campanias: campanias.map(c => ({
        id: c.id,
        nombre: c.nombre,
        estado: c.estado,
        totalContactos: parseInt(c.total_contactos),
        enviados: parseInt(c.enviados),
        respondidos: parseInt(c.respondidos),
        errores: 0,
        tasaRespuesta: parseInt(c.enviados) > 0
          ? Math.round((parseInt(c.respondidos) / parseInt(c.enviados)) * 100)
          : 0
      })),
      leadsPorOrigen: leadsPorOrigen.map(l => ({
        nombre: l.nombre,
        valor: parseInt(l.valor)
      })),
      leadsPorEtapa: leadsPorEtapa.map(l => ({
        nombre: l.nombre,
        color: l.color,
        valor: parseInt(l.valor)
      })),
      respuestasPorHora: Array.from({ length: 24 }, (_, i) => {
        const hora = respuestasPorHora.find(r => r.hora === i)
        return {
          hora: `${i.toString().padStart(2, '0')}:00`,
          respuestas: hora ? parseInt(hora.total) : 0
        }
      })
    })
  } catch (error) {
    console.error('Error métricas dashboard:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
