import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const planes = await query(`
      SELECT id, nombre, descripcion, precio_mensual, precio_anual,
             max_mensajes_mes, max_agentes, max_usuarios, max_contactos,
             max_campanas_mes, max_archivos_kb, max_caracteres_elevenlabs,
             tiene_rag, tiene_voz, tiene_crm, tiene_integraciones,
             tiene_telegram, tiene_email, tiene_instagram, tiene_odoo, tiene_api, tiene_llamadas,
             COALESCE(es_personalizado, false) as es_personalizado,
             activo
      FROM planes
      WHERE activo = true
      ORDER BY es_personalizado ASC, precio_mensual ASC
    `)
    return NextResponse.json(planes)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
