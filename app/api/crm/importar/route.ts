import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
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

    let importados = 0
    let duplicados = 0
    let errores = 0

    for (const contacto of contactos) {
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

    return NextResponse.json({ success: true, importados, duplicados, errores, total: contactos.length })
  } catch (error) {
    console.error('Error importar:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
