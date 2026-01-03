import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { campania_id } = await request.json()
    if (!campania_id) {
      return NextResponse.json({ error: 'campania_id requerido' }, { status: 400 })
    }

    const campania = await queryOne(`
      SELECT * FROM campanias WHERE id = $1 AND cliente_id = $2
    `, [campania_id, user.cliente_id])

    if (!campania) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
    }

    const instancia = await queryOne(`
      SELECT * FROM instancias_whatsapp 
      WHERE cliente_id = $1 AND estado = 'conectado' 
      LIMIT 1
    `, [user.cliente_id])

    const contactosPendientes = await query(`
      SELECT * FROM campania_contactos 
      WHERE campania_id = $1 AND estado = 'pendiente'
      ORDER BY id
      LIMIT $2
    `, [campania_id, campania.contactos_por_dia || 20])

    let encolados = 0
    const ahora = new Date()
    const [horaInicio, minInicio] = (campania.horario_inicio || '09:00').split(':').map(Number)
    const [horaFin, minFin] = (campania.horario_fin || '18:00').split(':').map(Number)

    for (let i = 0; i < contactosPendientes.length; i++) {
      const contacto = contactosPendientes[i] as any
      const delaySegundos = i * ((campania.delay_min || 30) + Math.random() * ((campania.delay_max || 90) - (campania.delay_min || 30)))
      
      const programadoPara = new Date(ahora.getTime() + delaySegundos * 1000)
      const mensaje = (campania.mensaje_plantilla || '')
        .replace(/\[NOMBRE\]/gi, contacto.nombre || 'Hola')
        .replace(/\[EMPRESA\]/gi, contacto.empresa || '')

      await query(`
        INSERT INTO cola_mensajes (
          cliente_id, instancia_id, tipo, numero_destino, mensaje,
          campania_id, campania_contacto_id, estado, prioridad, programado_para,
          tipo_media, media_url, media_base64, media_mimetype
        ) VALUES ($1, $2, 'saliente', $3, $4, $5, $6, 'pendiente', 5, $7, $8, $9, $10, $11)
      `, [
        user.cliente_id,
        instancia?.id || null,
        contacto.numero_whatsapp,
        mensaje,
        campania_id,
        contacto.id,
        programadoPara,
        campania.tipo_media || 'texto',
        campania.media_url,
        campania.media_base64,
        campania.media_mimetype
      ])

      await query(`UPDATE campania_contactos SET estado = 'enviando' WHERE id = $1`, [contacto.id])
      encolados++
    }

    if (encolados > 0) {
      await query(`UPDATE campanias SET estado = 'activa' WHERE id = $1`, [campania_id])
    }

    return NextResponse.json({ 
      success: true, 
      encolados,
      mensaje: `${encolados} mensajes encolados para envío`
    })

  } catch (error: any) {
    console.error('Error ejecutar campaña:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
