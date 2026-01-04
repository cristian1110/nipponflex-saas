import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { contactos } = body

    if (!contactos || !Array.isArray(contactos)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    // Verificar límite de contactos del plan
    const cliente = await queryOne(`
      SELECT c.limite_contactos,
             (SELECT COUNT(*) FROM contactos WHERE cliente_id = c.id) +
             (SELECT COUNT(*) FROM leads WHERE cliente_id = c.id) as contactos_actuales
      FROM clientes c
      WHERE c.id = $1
    `, [user.cliente_id])

    const limiteContactos = cliente?.limite_contactos || 500
    const contactosActuales = parseInt(cliente?.contactos_actuales || '0')
    const espacioDisponible = Math.max(0, limiteContactos - contactosActuales)

    // Si ya está en el límite, no permitir importación
    if (espacioDisponible <= 0) {
      return NextResponse.json({
        error: `Has alcanzado el límite de ${limiteContactos} contactos de tu plan. Elimina contactos o mejora tu plan.`,
        limite: limiteContactos,
        actuales: contactosActuales,
        disponibles: 0
      }, { status: 400 })
    }

    // Limitar la cantidad a importar según el espacio disponible
    const contactosAImportar = contactos.slice(0, espacioDisponible)
    const contactosOmitidos = contactos.length - contactosAImportar.length

    let importados = 0
    let duplicados = 0
    let errores = 0

    // Procesar en batches de 100
    const batchSize = 100

    for (let i = 0; i < contactosAImportar.length; i += batchSize) {
      const batch = contactosAImportar.slice(i, i + batchSize)
      
      // Preparar valores para INSERT masivo
      const values: any[] = []
      const placeholders: string[] = []
      let paramIndex = 1

      for (const contacto of batch) {
        let telefono = (contacto.telefono || '').toString().replace(/\s/g, '').replace(/-/g, '')
        if (!telefono) { errores++; continue }

        if (!telefono.startsWith('+')) {
          if (telefono.startsWith('593')) telefono = '+' + telefono
          else if (telefono.startsWith('0')) telefono = '+593' + telefono.substring(1)
          else if (telefono.length >= 9 && telefono.length <= 10) telefono = '+593' + telefono
          else telefono = '+' + telefono
        }

        const nombre = contacto.nombre || 'Sin nombre'
        const email = contacto.email || null
        const empresa = contacto.empresa || null

        values.push(user.cliente_id, nombre, telefono, email, empresa)
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`)
        paramIndex += 5
      }

      if (placeholders.length > 0) {
        try {
          // INSERT con ON CONFLICT para manejar duplicados
          const result = await query(
            `INSERT INTO contactos (cliente_id, nombre, telefono, email, empresa)
             VALUES ${placeholders.join(', ')}
             ON CONFLICT (cliente_id, telefono) DO NOTHING`,
            values
          )
          
          // Contar cuántos se insertaron realmente
          const insertedCount = result.rowCount || 0
          importados += insertedCount
          duplicados += (placeholders.length - insertedCount)
        } catch (e) {
          console.error('Error batch:', e)
          errores += batch.length
        }
      }
    }

    return NextResponse.json({
      success: true,
      importados,
      duplicados,
      errores,
      omitidos_por_limite: contactosOmitidos,
      total: contactos.length,
      limite: limiteContactos,
      contactos_actuales: contactosActuales + importados,
      mensaje: contactosOmitidos > 0
        ? `Se importaron ${importados} contactos. ${contactosOmitidos} fueron omitidos por alcanzar el límite de ${limiteContactos} contactos.`
        : undefined
    })
  } catch (error) {
    console.error('Error importar:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
