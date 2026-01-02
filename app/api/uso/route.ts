import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET - Obtener uso actual del cliente
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const cliente = await queryOne(`
      SELECT 
        limite_mensajes_mes, mensajes_usados_mes,
        limite_conversaciones, conversaciones_usadas_mes,
        limite_contactos, max_campanas_activas,
        proveedor_whatsapp, plan,
        alerta_80_enviada, alerta_100_enviada,
        ultimo_reset_mes
      FROM clientes WHERE id = $1
    `, [user.cliente_id])

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Calcular porcentajes
    const limiteMensajes = cliente.limite_mensajes_mes || 500
    const usadosMensajes = cliente.mensajes_usados_mes || 0
    const porcentajeMensajes = Math.round((usadosMensajes / limiteMensajes) * 100)

    // Contar contactos actuales
    const contactosCount = await queryOne(`
      SELECT COUNT(*) as total FROM contactos WHERE cliente_id = $1
    `, [user.cliente_id])

    // Contar campañas activas
    const campanasActivas = await queryOne(`
      SELECT COUNT(*) as total FROM campanias WHERE cliente_id = $1 AND estado = 'activa'
    `, [user.cliente_id])

    // Alertas no leídas
    const alertas = await query(`
      SELECT * FROM alertas_uso 
      WHERE cliente_id = $1 AND leida = false 
      ORDER BY created_at DESC LIMIT 5
    `, [user.cliente_id])

    return NextResponse.json({
      plan: cliente.plan || 'starter',
      proveedor: cliente.proveedor_whatsapp || 'evolution',
      mensajes: {
        usado: usadosMensajes,
        limite: limiteMensajes,
        porcentaje: porcentajeMensajes,
        disponible: Math.max(0, limiteMensajes - usadosMensajes)
      },
      contactos: {
        usado: parseInt(contactosCount?.total || '0'),
        limite: cliente.limite_contactos || 500
      },
      campanas: {
        activas: parseInt(campanasActivas?.total || '0'),
        limite: cliente.max_campanas_activas || 1
      },
      alertas: alertas,
      bloqueado: porcentajeMensajes >= 100,
      advertencia: porcentajeMensajes >= 80 && porcentajeMensajes < 100
    })

  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
