import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { campania_id, estado } = await request.json()

    if (!campania_id || !estado) {
      return NextResponse.json({ error: 'campania_id y estado requeridos' }, { status: 400 })
    }

    const estadosValidos = ['borrador', 'activa', 'pausada', 'completada']
    if (!estadosValidos.includes(estado)) {
      return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })
    }

    // Verificar que la campaña tenga contactos si se va a activar
    if (estado === 'activa') {
      const count = await queryOne(`
        SELECT COUNT(*) as total FROM campania_contactos WHERE campania_id = $1
      `, [campania_id])

      if (!count || count.total === 0) {
        return NextResponse.json({ error: 'La campaña debe tener contactos para activarse' }, { status: 400 })
      }
    }

    await query(`
      UPDATE campanias SET estado = $1 WHERE id = $2 AND cliente_id = $3
    `, [estado, campania_id, user.cliente_id])

    // Si se activa la campaña, encolar los mensajes pendientes automáticamente
    let encolados = 0
    if (estado === 'activa') {
      const campania = await queryOne(`SELECT * FROM campanias WHERE id = $1`, [campania_id])

      if (campania) {
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

        const ahora = new Date()

        for (let i = 0; i < contactosPendientes.length; i++) {
          const contacto = contactosPendientes[i] as any

          // Delay más natural: base + variación aleatoria por cada contacto
          const delayMin = campania.delay_min || 60  // mínimo 1 minuto entre mensajes
          const delayMax = campania.delay_max || 180 // máximo 3 minutos
          const delayBase = delayMin + Math.random() * (delayMax - delayMin)
          const delayAcumulado = i * delayBase + Math.random() * 30 // +0-30 seg variación extra

          const programadoPara = new Date(ahora.getTime() + delayAcumulado * 1000)
          const mensaje = (campania.mensaje_plantilla || '')
            .replace(/\[NOMBRE\]/gi, contacto.nombre || 'Hola')
            .replace(/\[EMPRESA\]/gi, contacto.empresa || '')

          await query(`
            INSERT INTO cola_mensajes (
              cliente_id, instancia_id, tipo, numero_destino, mensaje,
              campania_id, campania_contacto_id, estado, prioridad, programado_para
            ) VALUES ($1, $2, 'saliente', $3, $4, $5, $6, 'pendiente', 5, $7)
          `, [
            user.cliente_id,
            instancia?.id || null,
            contacto.numero_whatsapp,
            mensaje,
            campania_id,
            contacto.id,
            programadoPara
          ])

          await query(`UPDATE campania_contactos SET estado = 'enviando' WHERE id = $1`, [contacto.id])
          encolados++
        }

        // Ejecutar el worker inmediatamente para procesar la cola
        try {
          const workerToken = process.env.WORKER_SECRET || 'nipponflex-worker-2024'
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
          await fetch(`${baseUrl}/api/worker/procesar-cola`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${workerToken}`
            },
            body: JSON.stringify({ limite: 50 })
          })
        } catch (e) {
          console.error('Error ejecutando worker:', e)
        }
      }
    }

    return NextResponse.json({ success: true, estado, encolados })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
