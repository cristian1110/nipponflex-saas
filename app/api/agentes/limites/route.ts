import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Los límites están en la tabla clientes
    const cliente = await queryOne(
      `SELECT 
        limite_agentes,
        limite_archivos,
        limite_archivos_kb,
        (SELECT COUNT(*) FROM configuracion_agente WHERE cliente_id = $1) as agentes_actuales
       FROM clientes
       WHERE id = $1`,
      [user.cliente_id]
    )

    if (!cliente) {
      return NextResponse.json({
        max_agentes: 1,
        agentes_actuales: 0,
        puede_crear: true,
        max_archivos: 3,
        max_tamano_mb: 2
      })
    }

    return NextResponse.json({
      max_agentes: cliente.limite_agentes || 1,
      agentes_actuales: parseInt(cliente.agentes_actuales) || 0,
      puede_crear: parseInt(cliente.agentes_actuales) < (cliente.limite_agentes || 1),
      max_archivos: cliente.limite_archivos || 5,
      max_tamano_mb: cliente.limite_archivos_kb || 3
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
