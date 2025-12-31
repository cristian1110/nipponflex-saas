import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
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

    let importados = 0
    let duplicados = 0
    let errores = 0

    // Procesar en batches de 100
    const batchSize = 100
    
    for (let i = 0; i < contactos.length; i += batchSize) {
      const batch = contactos.slice(i, i + batchSize)
      
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
      total: contactos.length 
    })
  } catch (error) {
    console.error('Error importar:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
