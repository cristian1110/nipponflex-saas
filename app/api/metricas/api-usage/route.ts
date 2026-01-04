import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { obtenerResumenGlobal, obtenerMetricasPorDia, obtenerMetricas } from '@/lib/metricas'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Obtener métricas de uso de APIs (solo super admin)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.nivel < 100) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const dias = parseInt(searchParams.get('dias') || '30')
    const clienteId = searchParams.get('cliente_id') ? parseInt(searchParams.get('cliente_id')!) : null
    const tipo = searchParams.get('tipo') || 'resumen' // resumen, diario, detalle

    if (tipo === 'resumen') {
      // Resumen global de todos los clientes
      const resumen = await obtenerResumenGlobal(dias)

      // Obtener top clientes por uso
      const topClientes = await query(
        `SELECT
          c.id,
          c.nombre_empresa,
          SUM(m.groq_tokens_input + m.groq_tokens_output) as total_tokens,
          SUM(m.groq_costo_usd + m.jina_costo_usd + m.whisper_costo_usd +
              m.vision_costo_usd + m.elevenlabs_costo_usd + m.twilio_costo_usd) as total_costo
         FROM metricas_api m
         JOIN clientes c ON m.cliente_id = c.id
         WHERE m.fecha >= CURRENT_DATE - $1::integer
         GROUP BY c.id, c.nombre_empresa
         ORDER BY total_costo DESC
         LIMIT 10`,
        [dias]
      )

      return NextResponse.json({
        resumen,
        topClientes,
        periodo: `Últimos ${dias} días`
      })
    }

    if (tipo === 'diario') {
      // Métricas por día para gráficos
      const metricas = await obtenerMetricasPorDia(dias, clienteId || undefined)
      return NextResponse.json({ metricas })
    }

    if (tipo === 'detalle') {
      // Detalle por servicio y fecha
      const fechaInicio = searchParams.get('desde') || new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const fechaFin = searchParams.get('hasta') || new Date().toISOString().split('T')[0]

      const metricas = await obtenerMetricas(clienteId, fechaInicio, fechaFin)
      return NextResponse.json({ metricas })
    }

    // Logs recientes
    if (tipo === 'logs') {
      const limite = parseInt(searchParams.get('limite') || '100')
      const logs = await query(
        `SELECT
          l.*,
          c.nombre_empresa
         FROM logs_api l
         LEFT JOIN clientes c ON l.cliente_id = c.id
         ORDER BY l.created_at DESC
         LIMIT $1`,
        [limite]
      )
      return NextResponse.json({ logs })
    }

    return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 })

  } catch (error) {
    console.error('Error obteniendo métricas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
