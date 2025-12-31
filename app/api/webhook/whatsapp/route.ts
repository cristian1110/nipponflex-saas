import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'

// Webhook para recibir mensajes de Evolution API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Webhook WhatsApp:', JSON.stringify(body, null, 2))

    // Estructura de Evolution API v2
    const { event, data, instance } = body

    // Solo procesar mensajes entrantes
    if (event !== 'messages.upsert' || !data?.message) {
      return NextResponse.json({ status: 'ignored' })
    }

    const message = data.message
    const remoteJid = data.key?.remoteJid
    const fromMe = data.key?.fromMe

    // Ignorar mensajes propios
    if (fromMe) {
      return NextResponse.json({ status: 'ignored' })
    }

    // Extraer número de teléfono
    const numero = remoteJid?.replace('@s.whatsapp.net', '').replace('@g.us', '')
    if (!numero) {
      return NextResponse.json({ status: 'ignored' })
    }

    // Extraer contenido del mensaje
    let texto = ''
    let tipo = 'text'
    let mediaUrl = null

    if (message.conversation) {
      texto = message.conversation
    } else if (message.extendedTextMessage?.text) {
      texto = message.extendedTextMessage.text
    } else if (message.imageMessage) {
      texto = message.imageMessage.caption || '[Imagen]'
      tipo = 'image'
    } else if (message.audioMessage) {
      texto = '[Audio]'
      tipo = 'audio'
    } else if (message.documentMessage) {
      texto = message.documentMessage.fileName || '[Documento]'
      tipo = 'document'
    } else if (message.videoMessage) {
      texto = message.videoMessage.caption || '[Video]'
      tipo = 'video'
    }

    // Buscar cliente asociado a esta instancia
    const integracion = await queryOne(
      `SELECT cliente_id FROM integraciones WHERE tipo = 'whatsapp' AND activo = true AND config::text LIKE $1`,
      [`%${instance}%`]
    )

    if (!integracion) {
      console.log('Cliente no encontrado para instancia:', instance)
      return NextResponse.json({ status: 'no_client' })
    }

    const clienteId = integracion.cliente_id

    // Guardar mensaje entrante
    const nuevoMensaje = await queryOne(
      `INSERT INTO mensajes (cliente_id, numero_whatsapp, rol, mensaje, tipo, media_url, canal, leido)
       VALUES ($1, $2, 'user', $3, $4, $5, 'whatsapp', false)
       RETURNING *`,
      [clienteId, numero, texto, tipo, mediaUrl]
    )

    // Buscar o crear lead
    let lead = await queryOne(
      `SELECT * FROM leads WHERE cliente_id = $1 AND telefono = $2`,
      [clienteId, numero]
    )

    if (!lead) {
      // Obtener primera etapa del pipeline
      const etapa = await queryOne(
        `SELECT id FROM etapas_crm WHERE cliente_id = $1 ORDER BY orden LIMIT 1`,
        [clienteId]
      )

      // Crear lead automático
      lead = await queryOne(
        `INSERT INTO leads (cliente_id, nombre, telefono, etapa_id, origen)
         VALUES ($1, $2, $3, $4, 'WhatsApp')
         RETURNING *`,
        [clienteId, `WhatsApp ${numero}`, numero, etapa?.id]
      )
    }

    // Actualizar último contacto
    await execute(
      `UPDATE leads SET ultimo_contacto = NOW(), updated_at = NOW() WHERE id = $1`,
      [lead.id]
    )

    // Incrementar contador de mensajes
    await execute(
      `UPDATE clientes SET mensajes_usados = mensajes_usados + 1 WHERE id = $1`,
      [clienteId]
    )

    // Buscar agente activo para respuesta automática
    const agente = await queryOne(
      `SELECT * FROM agentes WHERE cliente_id = $1 AND activo = true AND (whatsapp_numero = $2 OR whatsapp_numero IS NULL) LIMIT 1`,
      [clienteId, numero]
    )

    if (agente) {
      // Enviar a n8n para procesamiento con IA
      const n8nWebhook = process.env.N8N_WEBHOOK_URL
      if (n8nWebhook) {
        try {
          await fetch(n8nWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cliente_id: clienteId,
              agente_id: agente.id,
              lead_id: lead.id,
              numero,
              mensaje: texto,
              tipo,
              prompt_sistema: agente.prompt_sistema,
              personalidad: agente.personalidad,
              temperatura: agente.temperatura,
              modelo: agente.modelo,
            }),
          })
        } catch (e) {
          console.error('Error enviando a n8n:', e)
        }
      }
    }

    return NextResponse.json({ 
      status: 'ok',
      mensaje_id: nuevoMensaje.id,
      lead_id: lead.id,
    })
  } catch (error) {
    console.error('Error webhook:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Verificación GET para Evolution API
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'Webhook activo', timestamp: new Date().toISOString() })
}
