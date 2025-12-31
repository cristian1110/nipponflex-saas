import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const etapas = await query(
      `SELECT e.*, 
        (SELECT COUNT(*) FROM leads l WHERE l.etapa_id = e.id AND l.cliente_id = $1) as total_leads,
        (SELECT COALESCE(SUM(valor_estimado), 0) FROM leads l WHERE l.etapa_id = e.id AND l.cliente_id = $1) as valor_total
       FROM etapas_crm e 
       WHERE e.cuenta_id = 1
       ORDER BY e.orden`,
      [user.cliente_id]
    )
    return NextResponse.json(etapas)
  } catch (error) {
    console.error('Error etapas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
