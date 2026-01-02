import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Obtener todos los tipos de agente activos
    const tipos = await query(
      `SELECT id, nombre, icono, descripcion, prompt_base, categoria, requiere_integracion
       FROM tipos_agente 
       WHERE activo = true 
       ORDER BY orden ASC`
    )

    // Filtrar el tipo Odoo si no tiene la integración configurada
    const tiposFiltrados = tipos.filter((tipo: any) => {
      if (tipo.requiere_integracion === 'odoo') {
        // TODO: Verificar si el cliente tiene Odoo configurado
        // Por ahora lo mostramos siempre
        return true
      }
      return true
    })

    return NextResponse.json(tiposFiltrados)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
