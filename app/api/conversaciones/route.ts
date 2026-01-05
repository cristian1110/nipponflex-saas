import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const numero = searchParams.get('numero')

    // Super admin (nivel >= 100) ve todas las conversaciones del cliente
    // Otros usuarios solo ven las conversaciones donde ellos participaron
    const esSuperAdmin = user.nivel >= 100
    const filtroUsuario = esSuperAdmin ? '' : 'AND h.usuario_id = $2'
    const params = esSuperAdmin ? [user.cliente_id] : [user.cliente_id, user.id]

    if (numero) {
      // Obtener mensajes de una conversación específica
      // Los mensajes se muestran si el usuario participo en esa conversación
      const mensajesParams = esSuperAdmin
        ? [user.cliente_id, numero]
        : [user.cliente_id, numero, user.id]

      const filtroMensajes = esSuperAdmin
        ? ''
        : `AND numero_whatsapp IN (
            SELECT DISTINCT numero_whatsapp FROM historial_conversaciones
            WHERE cliente_id = $1 AND usuario_id = $3
          )`

      const mensajes = await query(
        `SELECT
          id::text,
          mensaje as texto,
          rol,
          created_at as fecha
         FROM historial_conversaciones
         WHERE cliente_id = $1 AND numero_whatsapp = $2 ${filtroMensajes}
         ORDER BY created_at ASC`,
        mensajesParams
      )

      return NextResponse.json({ mensajes })
    }

    // Obtener lista de conversaciones donde el usuario participo
    const conversacionesQuery = esSuperAdmin
      ? `SELECT
          h.numero_whatsapp,
          MAX(h.created_at) as ultimo_mensaje_fecha,
          COUNT(*) as total_mensajes,
          (SELECT mensaje FROM historial_conversaciones h2
           WHERE h2.numero_whatsapp = h.numero_whatsapp AND h2.cliente_id = h.cliente_id
           ORDER BY created_at DESC LIMIT 1) as ultimo_texto,
          COALESCE(l.nombre, c.nombre) as contacto_nombre,
          l.id as lead_id
         FROM historial_conversaciones h
         LEFT JOIN leads l ON l.telefono = h.numero_whatsapp AND l.cliente_id = h.cliente_id
         LEFT JOIN contactos c ON c.telefono = h.numero_whatsapp AND c.cliente_id = h.cliente_id
         WHERE h.cliente_id = $1
         GROUP BY h.numero_whatsapp, h.cliente_id, l.nombre, l.id, c.nombre
         ORDER BY MAX(h.created_at) DESC`
      : `SELECT
          h.numero_whatsapp,
          MAX(h.created_at) as ultimo_mensaje_fecha,
          COUNT(*) as total_mensajes,
          (SELECT mensaje FROM historial_conversaciones h2
           WHERE h2.numero_whatsapp = h.numero_whatsapp AND h2.cliente_id = h.cliente_id
           ORDER BY created_at DESC LIMIT 1) as ultimo_texto,
          COALESCE(l.nombre, c.nombre) as contacto_nombre,
          l.id as lead_id
         FROM historial_conversaciones h
         LEFT JOIN leads l ON l.telefono = h.numero_whatsapp AND l.cliente_id = h.cliente_id
         LEFT JOIN contactos c ON c.telefono = h.numero_whatsapp AND c.cliente_id = h.cliente_id
         WHERE h.cliente_id = $1
           AND h.numero_whatsapp IN (
             SELECT DISTINCT numero_whatsapp FROM historial_conversaciones
             WHERE cliente_id = $1 AND usuario_id = $2
           )
         GROUP BY h.numero_whatsapp, h.cliente_id, l.nombre, l.id, c.nombre
         ORDER BY MAX(h.created_at) DESC`

    const conversaciones = await query(conversacionesQuery, params)

    // Formatear para el frontend
    const formattedConversaciones = conversaciones.map((c: any) => ({
      id: c.numero_whatsapp,
      numero: c.numero_whatsapp,
      nombre: c.contacto_nombre || c.numero_whatsapp,
      ultimo_mensaje: c.ultimo_texto || '',
      fecha: c.ultimo_mensaje_fecha,
      no_leidos: 0,
      lead_id: c.lead_id,
      canal: 'whatsapp' as const
    }))

    return NextResponse.json(formattedConversaciones)
  } catch (error) {
    console.error('Error conversaciones:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
