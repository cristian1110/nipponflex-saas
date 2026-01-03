import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { generarRespuestaIA, mapearModelo, transcribirAudio, analizarImagen } from '@/lib/ai'
import { enviarMensajeWhatsApp, enviarPresencia } from '@/lib/evolution'
import {
  getPromptCitas,
  extraerCitaDeRespuesta,
  limpiarRespuestaCita,
  crearCitaDesdeIA
} from '@/lib/citas-ia'
import { buscarContextoRelevante, construirPromptConRAG } from '@/lib/rag'
import { descargarMedia, base64ToBuffer, esAudioCompatible, esImagenCompatible } from '@/lib/media'

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
    let mediaInfo: { base64: string; mimetype: string } | null = null
    const messageId = data.key?.id

    if (message.conversation) {
      texto = message.conversation
    } else if (message.extendedTextMessage?.text) {
      texto = message.extendedTextMessage.text
    } else if (message.imageMessage) {
      texto = message.imageMessage.caption || ''
      tipo = 'image'
      // Guardar info para procesar después
      mediaInfo = {
        base64: message.imageMessage.base64 || '',
        mimetype: message.imageMessage.mimetype || 'image/jpeg',
      }
    } else if (message.audioMessage) {
      texto = ''
      tipo = 'audio'
      mediaInfo = {
        base64: message.audioMessage.base64 || '',
        mimetype: message.audioMessage.mimetype || 'audio/ogg',
      }
    } else if (message.documentMessage) {
      texto = `[Documento: ${message.documentMessage.fileName || 'archivo'}]`
      tipo = 'document'
    } else if (message.videoMessage) {
      texto = message.videoMessage.caption || '[Video recibido]'
      tipo = 'video'
    }

    // Si no hay texto ni media procesable, ignorar
    if (!texto && !mediaInfo?.base64 && tipo === 'text') {
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
    const apiKeyEvolution = instancia.evolution_api_key || process.env.EVOLUTION_API_KEY || ''

    // ============================================
    // PROCESAR AUDIO O IMAGEN SI EXISTE
    // ============================================

    if (tipo === 'audio' && mediaInfo) {
      console.log('Procesando audio de:', numero)

      // Si no tenemos base64 en el mensaje, intentar descargar
      let audioBase64 = mediaInfo.base64
      if (!audioBase64 && messageId) {
        const mediaDescargada = await descargarMedia(
          instancia.evolution_instance,
          apiKeyEvolution,
          messageId
        )
        if (mediaDescargada) {
          audioBase64 = mediaDescargada.base64
          mediaInfo.mimetype = mediaDescargada.mimetype
        }
      }

      if (audioBase64 && esAudioCompatible(mediaInfo.mimetype)) {
        const audioBuffer = base64ToBuffer(audioBase64)
        const transcripcion = await transcribirAudio(audioBuffer, mediaInfo.mimetype)

        if (transcripcion) {
          texto = transcripcion
          console.log('Audio transcrito exitosamente:', transcripcion.substring(0, 50) + '...')
        } else {
          texto = '[Audio recibido - no se pudo transcribir]'
        }
      } else {
        texto = '[Audio recibido - formato no compatible]'
      }
    }

    if (tipo === 'image' && mediaInfo) {
      console.log('Procesando imagen de:', numero)

      // Si no tenemos base64 en el mensaje, intentar descargar
      let imageBase64 = mediaInfo.base64
      if (!imageBase64 && messageId) {
        const mediaDescargada = await descargarMedia(
          instancia.evolution_instance,
          apiKeyEvolution,
          messageId
        )
        if (mediaDescargada) {
          imageBase64 = mediaDescargada.base64
          mediaInfo.mimetype = mediaDescargada.mimetype
        }
      }

      if (imageBase64 && esImagenCompatible(mediaInfo.mimetype)) {
        const descripcion = await analizarImagen(
          imageBase64,
          mediaInfo.mimetype,
          texto
            ? `El usuario envió esta imagen con el texto: "${texto}". Describe la imagen y responde a su mensaje.`
            : 'Describe detalladamente qué ves en esta imagen. Si hay texto o productos, identifícalos.'
        )

        if (descripcion) {
          // Combinar caption original con descripción de la imagen
          texto = texto
            ? `[Imagen: ${descripcion}]\n\nMensaje del usuario: ${texto}`
            : `[El usuario envió una imagen: ${descripcion}]`
          console.log('Imagen analizada exitosamente')
        } else {
          texto = texto || '[Imagen recibida - no se pudo analizar]'
        }
      } else {
        texto = texto || '[Imagen recibida - formato no compatible]'
      }
    }

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

    // Buscar contexto relevante en base de conocimiento (RAG)
    const contextoRelevante = await buscarContextoRelevante(texto, agente.id, 3, 0.2)

    // Construir mensajes para la IA (incluir instrucciones de citas)
    const promptBase = agente.prompt_sistema + getPromptCitas()
    const promptSistema = construirPromptConRAG(
      promptBase,
      contextoRelevante,
      agente.nombre
    )

    if (contextoRelevante.length > 0) {
      console.log(`RAG: ${contextoRelevante.length} contextos relevantes encontrados`)
    }

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

    // Verificar si la IA agendó una cita
    let citaCreada = null
    const citaDetectada = extraerCitaDeRespuesta(respuestaIA.content)

    if (citaDetectada) {
      console.log('Cita detectada en respuesta IA:', citaDetectada)

      const resultadoCita = await crearCitaDesdeIA(
        clienteId,
        lead?.id || null,
        numero,
        citaDetectada
      )

      if (resultadoCita.success) {
        citaCreada = resultadoCita.citaId
        console.log('Cita creada automáticamente:', citaCreada)
      } else {
        console.error('Error creando cita:', resultadoCita.error)
      }

      // Limpiar la respuesta para no mostrar el bloque técnico al usuario
      respuestaIA.content = limpiarRespuestaCita(respuestaIA.content)
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
      cita_creada: citaCreada,
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
