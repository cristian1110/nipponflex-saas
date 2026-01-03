import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { migrarConocimientosExistentes } from '@/lib/rag'
import { initQdrantCollection } from '@/lib/qdrant'

export const dynamic = 'force-dynamic'

// POST - Migrar conocimientos existentes a Qdrant
export async function POST(request: NextRequest) {
  try {
    // Verificar secret de worker
    const authHeader = request.headers.get('authorization')
    const workerSecret = process.env.WORKER_SECRET

    if (!workerSecret || authHeader !== `Bearer ${workerSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Inicializar colección
    const initialized = await initQdrantCollection()
    if (!initialized) {
      return NextResponse.json({ error: 'No se pudo inicializar Qdrant' }, { status: 500 })
    }

    // Obtener todos los conocimientos activos
    const conocimientos = await query(
      `SELECT id, cliente_id, agente_id, nombre_archivo, contenido_texto
       FROM conocimientos
       WHERE activo = true AND contenido_texto IS NOT NULL
       ORDER BY id`
    )

    console.log(`Migrando ${conocimientos.length} conocimientos a Qdrant...`)

    // Migrar
    const resultado = await migrarConocimientosExistentes(conocimientos)

    // Actualizar estado de los migrados
    await query(
      `UPDATE conocimientos SET estado = 'listo'
       WHERE activo = true AND contenido_texto IS NOT NULL AND estado != 'listo'`
    )

    return NextResponse.json({
      success: true,
      total: conocimientos.length,
      exitosos: resultado.exitosos,
      fallidos: resultado.fallidos,
    })
  } catch (error) {
    console.error('Error migrando:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// GET - Estadísticas de migración
export async function GET(request: NextRequest) {
  try {
    const stats = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'listo') as indexados,
        COUNT(*) FILTER (WHERE estado = 'procesando') as procesando,
        COUNT(*) FILTER (WHERE estado = 'error_indexacion') as errores
       FROM conocimientos WHERE activo = true`
    )

    return NextResponse.json(stats[0])
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
