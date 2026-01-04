import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { contactos, etapa_id } = body

    if (!contactos || !Array.isArray(contactos)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    // Verificar límite de contactos del plan
    const cliente = await queryOne(`
      SELECT c.limite_contactos,
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

    for (const contacto of contactosAImportar) {
      try {
        let telefono = (contacto.telefono || '').toString().replace(/\s/g, '').replace(/-/g, '')
        if (!telefono) { errores++; continue }

        if (!telefono.startsWith('+')) {
          if (telefono.startsWith('593')) telefono = '+' + telefono
          else if (telefono.startsWith('0')) telefono = '+593' + telefono.substring(1)
          else if (telefono.length === 9) telefono = '+593' + telefono
          else telefono = '+' + telefono
        }

        const nombre = contacto.nombre || 'Sin nombre'
        const email = contacto.email || null
        const empresa = contacto.empresa || null

        const existe = await query(`SELECT id FROM leads WHERE telefono = $1 AND cliente_id = $2`, [telefono, user.cliente_id])
        if (existe.length > 0) { duplicados++; continue }

        await query(
          `INSERT INTO leads (cliente_id, cuenta_id, nombre, telefono, email, empresa, etapa_id, origen) VALUES ($1, 1, $2, $3, $4, $5, $6, 'Importación Excel')`,
          [user.cliente_id, nombre, telefono, email, empresa, etapa_id || 1]
        )
        importados++
      } catch (e) { console.error('Error importando:', e); errores++ }
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
