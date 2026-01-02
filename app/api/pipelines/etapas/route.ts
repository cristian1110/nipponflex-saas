import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const pipeline_id = searchParams.get('pipeline_id')

    if (!pipeline_id) {
      return NextResponse.json({ error: 'pipeline_id requerido' }, { status: 400 })
    }

    const etapas = await query(`
      SELECT * FROM etapas_crm 
      WHERE pipeline_id = $1 
      ORDER BY orden ASC
    `, [pipeline_id])

    return NextResponse.json(etapas)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
