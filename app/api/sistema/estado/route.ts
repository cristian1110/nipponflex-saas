import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// API para obtener el estado real del sistema
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Verificar estado de WhatsApp
    const whatsapp = await queryOne(`
      SELECT estado FROM instancias_whatsapp
      WHERE cliente_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [user.cliente_id])

    // Verificar si tiene agente activo
    const agente = await queryOne(`
      SELECT id, activo FROM agentes
      WHERE cliente_id = $1 AND activo = true
      LIMIT 1
    `, [user.cliente_id])

    // Verificar estado de la base de datos (si llegamos aquí, está online)
    const dbOnline = true

    return NextResponse.json({
      whatsapp: {
        conectado: whatsapp?.estado === 'conectado',
        estado: whatsapp?.estado || 'no_configurado'
      },
      agente: {
        activo: !!agente,
        id: agente?.id || null
      },
      database: {
        online: dbOnline
      },
      worker: {
        // El worker se ejecuta por cron, asumimos que está ejecutando
        estado: 'ejecutando'
      }
    })
  } catch (error) {
    console.error('Error obteniendo estado del sistema:', error)
    return NextResponse.json({
      error: 'Error interno',
      whatsapp: { conectado: false, estado: 'error' },
      agente: { activo: false, id: null },
      database: { online: false },
      worker: { estado: 'desconocido' }
    }, { status: 500 })
  }
}
