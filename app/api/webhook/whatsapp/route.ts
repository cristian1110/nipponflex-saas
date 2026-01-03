import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { generarRespuestaIA, construirPromptSistema, mapearModelo } from '@/lib/ai'
import { enviarMensajeWhatsApp, enviarPresencia } from '@/lib/evolution'

// Webhook para recibir mensajes de Evolution API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Webhook WhatsApp recibido:', body.event)

    // Estructura de Evolution API v2
    const { event, data, instance } = body

    // Solo procesar mensajes entrantes
    if (event !== 'messages.upsert' || !data?.message) {
      return NextResponse.json({ status: 'ignored' })
    }

    const message = data.message
    const remoteJid = data.key?.remoteJid
    const fromMe = data.key?.fromMe

    // Ignorar mensajes propios y de grupos
    if (fromMe || remoteJid?.includes('@g.us')) {
      return NextResponse.json({ status: 'ignored' })
    }

    // Extraer número de teléfono
    const numero = remoteJid?.replace('@s.whatsapp.net', '')
    if (!numero) {
      return NextResponse.json({ status: 'ignored' })
    }

    // Extraer contenido del mensaje
    let texto = ''
    let tipo = 'text'

    if (message.conversation) {
      texto = message.conversation
    } else if (message.extendedTextMessage?.text) {
      texto = message.extendedTextMessage.text
    } else if (message.imageMessage) {
      texto = message.imageMessage.caption || '[Imagen recibida]'
      tipo = 'image'
    } else if (message.audioMessage) {
      texto = '[Audio recibido]'
      tipo = 'audio'
    } else if (message.documentMessage) {
      texto = `[Documento: ${message.documentMessage.fileName || 'archivo'}]`
      tipo = 'document'
    } else if (message.videoMessage) {
      texto = message.videoMessage.caption || '[Video recibido]'
      tipo = 'video'
    }

    if (!texto) {
      return NextResponse.json({ status: 'no_text' })
    }

    // Buscar instancia de WhatsApp
    const instancia = await queryOne(
      `SELECT iw.*, c.id as cliente_id
       FROM instancias_whatsapp iw
       JOIN clientes c ON iw.cliente_id = c.id
       WHERE iw.evolution_instance = $1 AND iw.estado = 'conectado'
       LIMIT 1`,
      [instance]
    )

    if (!instancia) {
      console.log('Instancia no encontrada:', instance)
      return NextResponse.json({ status: 'no_instance' })
    }

    const clienteId = instancia.cliente_id

    // Guardar mensaje entrante en historial
    await query(
      `INSERT INTO historial_conversaciones (cliente_id, numero_whatsapp, rol, mensaje)
       VALUES ($1, $2, 'user', $3)`,
      [clienteId, numero, texto]
    )

    // Buscar o crear lead
    let lead = await queryOne(
      `SELECT * FROM leads WHERE cliente_id = $1 AND telefono = $2`,
      [clienteId, numero]
    )

    if (!lead) {
      const pipeline = await queryOne(
        `SELECT id FROM pipelines WHERE cliente_id = $1 ORDER BY created_at LIMIT 1`,
        [clienteId]
      )

      const etapa = await queryOne(
        `SELECT id FROM etapas_crm WHERE pipeline_id = $1 ORDER BY orden LIMIT 1`,
        [pipeline?.id]
      )

      lead = await queryOne(
        `INSERT INTO leads (cliente_id, nombre, telefono, etapa_id, origen)
         VALUES ($1, $2, $3, $4, 'WhatsApp')
         RETURNING *`,
        [clienteId, `WhatsApp ${numero}`, numero, etapa?.id]
      )
      console.log('Lead creado automáticamente:', lead?.id)
    }

    // Actualizar último contacto del lead
    await execute(
      `UPDATE leads SET updated_at = NOW() WHERE id = $1`,
      [lead.id]
    )

    // Buscar agente activo
    const agente = await queryOne(
      `SELECT * FROM agentes WHERE cliente_id = $1 AND estado = 'activo' LIMIT 1`,
      [clienteId]
    )

    if (!agente) {
      console.log('No hay agente activo para cliente:', clienteId)
      return NextResponse.json({
        status: 'ok',
        mensaje: 'Mensaje guardado (sin agente activo)',
        lead_id: lead.id
      })
    }

    // Verificar horario de operación del agente
    const ahora = new Date()
    const horaActual = ahora.getHours()
    const config = agente.configuracion_extra || {}

    if (config.hora_inicio && config.hora_fin) {
      const horaInicio = parseInt(config.hora_inicio.split(':')[0])
      const horaFin = parseInt(config.hora_fin.split(':')[0])

      if (horaActual < horaInicio || horaActual >= horaFin) {
        // Fuera de horario - enviar mensaje automático si está configurado
        if (config.mensaje_fuera_horario) {
          await enviarMensajeWhatsApp({
            instancia: instancia.evolution_instance,
            apiKey: instancia.evolution_api_key || process.env.EVOLUTION_API_KEY || '',
            numero,
            mensaje: config.mensaje_fuera_horario,
          })

          await query(
            `INSERT INTO historial_conversaciones (cliente_id, numero_whatsapp, rol, mensaje)
             VALUES ($1, $2, 'assistant', $3)`,
            [clienteId, numero, config.mensaje_fuera_horario]
          )
        }

        return NextResponse.json({
          status: 'ok',
          mensaje: 'Fuera de horario',
          lead_id: lead.id
        })
      }
    }

    // Cargar historial de conversación reciente
    const historial = await query(
      `SELECT rol, mensaje FROM historial_conversaciones
       WHERE cliente_id = $1 AND numero_whatsapp = $2
       ORDER BY created_at DESC LIMIT 10`,
      [clienteId, numero]
    )

    // Cargar base de conocimiento del agente
    const conocimientos = await query(
      `SELECT contenido_texto FROM conocimientos
       WHERE agente_id = $1 AND activo = true AND contenido_texto IS NOT NULL
       LIMIT 5`,
      [agente.id]
    )

    // Construir mensajes para la IA
    const promptSistema = construirPromptSistema(
      agente.prompt_sistema,
      conocimientos.map(c => c.contenido_texto),
      agente.nombre
    )

    const mensajesIA = [
      { role: 'system' as const, content: promptSistema },
      // Historial en orden cronológico (revertir porque viene DESC)
      ...historial.reverse().map(h => ({
        role: h.rol === 'user' ? 'user' as const : 'assistant' as const,
        content: h.mensaje,
      })),
    ]

    // Mostrar "escribiendo..." al usuario
    await enviarPresencia(
      instancia.evolution_instance,
      instancia.evolution_api_key || process.env.EVOLUTION_API_KEY || '',
      numero,
      'composing'
    )

    // Generar respuesta con IA
    console.log('Generando respuesta IA para:', numero)

    const respuestaIA = await generarRespuestaIA(mensajesIA, {
      modelo: mapearModelo(agente.modelo_llm || 'gpt-4o-mini'),
      temperatura: parseFloat(agente.temperatura) || 0.7,
      maxTokens: agente.max_tokens || 500,
    })

    if (!respuestaIA.content) {
      console.error('Respuesta IA vacía')
      return NextResponse.json({ status: 'error', error: 'Respuesta IA vacía' })
    }

    // Enviar respuesta por WhatsApp
    const resultado = await enviarMensajeWhatsApp({
      instancia: instancia.evolution_instance,
      apiKey: instancia.evolution_api_key || process.env.EVOLUTION_API_KEY || '',
      numero,
      mensaje: respuestaIA.content,
      delayMs: 500 + Math.random() * 1500, // Delay aleatorio 0.5-2s para parecer más natural
    })

    if (!resultado.success) {
      console.error('Error enviando mensaje:', resultado.error)
      return NextResponse.json({ status: 'error', error: resultado.error })
    }

    // Guardar respuesta en historial
    await query(
      `INSERT INTO historial_conversaciones (cliente_id, numero_whatsapp, rol, mensaje)
       VALUES ($1, $2, 'assistant', $3)`,
      [clienteId, numero, respuestaIA.content]
    )

    // Incrementar contador de mensajes del cliente
    await execute(
      `UPDATE clientes SET uso_mensajes_mes = COALESCE(uso_mensajes_mes, 0) + 1 WHERE id = $1`,
      [clienteId]
    )

    console.log('Respuesta IA enviada exitosamente a:', numero)

    return NextResponse.json({
      status: 'ok',
      lead_id: lead.id,
      respuesta_enviada: true,
      tokens_usados: respuestaIA.tokensUsados,
    })

  } catch (error) {
    console.error('Error webhook:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Verificación GET para Evolution API
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'Webhook NipponFlex activo',
    timestamp: new Date().toISOString(),
    version: '2.0'
  })
}
