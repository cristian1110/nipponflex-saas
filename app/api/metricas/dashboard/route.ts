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

    // Obtener info del plan del cliente
    const cliente = await queryOne(`
      SELECT c.*, p.nombre as plan_nombre, p.limite_mensajes, p.limite_campanas, p.limite_contactos
      FROM clientes c
      LEFT JOIN planes p ON c.plan_id = p.id
      WHERE c.id = $1
    `, [user.cliente_id])

    // Uso del plan
    const mesActual = new Date()
    mesActual.setDate(1)
    mesActual.setHours(0, 0, 0, 0)

    const usoPlan = await queryOne(`
      SELECT
        (SELECT COUNT(*) FROM historial_conversaciones WHERE cliente_id = $1 AND created_at >= $2) as mensajes_usados,
        (SELECT COUNT(*) FROM campanias WHERE cliente_id = $1 AND estado != 'borrador') as campanas_activas,
        (SELECT COUNT(*) FROM leads WHERE cliente_id = $1) +
        (SELECT COUNT(*) FROM contactos WHERE cliente_id = $1) as contactos_totales
    `, [user.cliente_id, mesActual.toISOString()])

    // Mensajes por día (últimos N días)
    const mensajesPorDia = await query(`
      SELECT
        d.fecha,
        COALESCE(env.enviados, 0) as enviados,
        COALESCE(rec.recibidos, 0) as recibidos
      FROM (
        SELECT generate_series(CURRENT_DATE - INTERVAL '${dias - 1} days', CURRENT_DATE, '1 day')::date as fecha
      ) d
      LEFT JOIN (
        SELECT DATE(created_at) as fecha, COUNT(*) as enviados
        FROM historial_conversaciones
        WHERE cliente_id = $1 AND tipo = 'saliente'
        GROUP BY DATE(created_at)
      ) env ON d.fecha = env.fecha
      LEFT JOIN (
        SELECT DATE(created_at) as fecha, COUNT(*) as recibidos
        FROM historial_conversaciones
        WHERE cliente_id = $1 AND tipo = 'entrante'
        GROUP BY DATE(created_at)
      ) rec ON d.fecha = rec.fecha
      ORDER BY d.fecha
    `, [user.cliente_id])

    // Leads por día (últimos N días)
    const leadsPorDia = await query(`
      SELECT
        d.fecha,
        COALESCE(l.total, 0) as leads
      FROM (
        SELECT generate_series(CURRENT_DATE - INTERVAL '${dias - 1} days', CURRENT_DATE, '1 day')::date as fecha
      ) d
      LEFT JOIN (
        SELECT DATE(created_at) as fecha, COUNT(*) as total
        FROM leads WHERE cliente_id = $1
        GROUP BY DATE(created_at)
      ) l ON d.fecha = l.fecha
      ORDER BY d.fecha
    `, [user.cliente_id])

    // Campañas y sus métricas
    const campanias = await query(`
      SELECT
        c.id, c.nombre, c.estado,
        (SELECT COUNT(*) FROM campania_contactos WHERE campania_id = c.id) as total_contactos,
        (SELECT COUNT(*) FROM campania_contactos WHERE campania_id = c.id AND estado = 'enviado') as enviados,
        (SELECT COUNT(*) FROM campania_contactos WHERE campania_id = c.id AND estado = 'respondido') as respondidos,
        (SELECT COUNT(*) FROM campania_contactos WHERE campania_id = c.id AND estado = 'error') as errores
      FROM campanias c
      WHERE c.cliente_id = $1
      ORDER BY c.created_at DESC
      LIMIT 5
    `, [user.cliente_id])

    // Leads por origen (para gráfico de pastel)
    const leadsPorOrigen = await query(`
      SELECT COALESCE(origen, 'Directo') as nombre, COUNT(*) as valor
      FROM leads
      WHERE cliente_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '${dias} days'
      GROUP BY origen
      ORDER BY valor DESC
      LIMIT 5
    `, [user.cliente_id])

    // Leads por etapa (para gráfico de barras)
    const leadsPorEtapa = await query(`
      SELECT e.nombre, e.color, COUNT(l.id) as valor
      FROM etapas_crm e
      LEFT JOIN leads l ON l.etapa_id = e.id
      WHERE e.pipeline_id IN (SELECT id FROM pipelines WHERE cliente_id = $1)
      GROUP BY e.id, e.nombre, e.color, e.orden
      ORDER BY e.orden
    `, [user.cliente_id])

    // Tasa de respuesta por hora del día (para optimización)
    const respuestasPorHora = await query(`
      SELECT
        EXTRACT(HOUR FROM created_at) as hora,
        COUNT(*) as total
      FROM historial_conversaciones
      WHERE cliente_id = $1 AND tipo = 'entrante' AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hora
    `, [user.cliente_id])

    // Formatear datos para gráficos
    const formatearFecha = (fecha: string) => {
      const d = new Date(fecha)
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    }

    return NextResponse.json({
      usoPlan: {
        mensajes: {
          usados: parseInt(usoPlan?.mensajes_usados || '0'),
          limite: cliente?.limite_mensajes || 1000,
          porcentaje: Math.min(100, Math.round((parseInt(usoPlan?.mensajes_usados || '0') / (cliente?.limite_mensajes || 1000)) * 100))
        },
        campanas: {
          activas: parseInt(usoPlan?.campanas_activas || '0'),
          limite: cliente?.limite_campanas || 5,
          porcentaje: Math.min(100, Math.round((parseInt(usoPlan?.campanas_activas || '0') / (cliente?.limite_campanas || 5)) * 100))
        },
        contactos: {
          total: parseInt(usoPlan?.contactos_totales || '0'),
          limite: cliente?.limite_contactos || 500,
          porcentaje: Math.min(100, Math.round((parseInt(usoPlan?.contactos_totales || '0') / (cliente?.limite_contactos || 500)) * 100))
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
        errores: parseInt(c.errores),
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
        const hora = respuestasPorHora.find(r => parseInt(r.hora) === i)
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
