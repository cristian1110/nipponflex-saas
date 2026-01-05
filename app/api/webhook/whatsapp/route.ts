import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { generarRespuestaIA, mapearModelo, transcribirAudio, analizarImagen, analizarSentimiento } from '@/lib/ai'
import { enviarMensajeWhatsApp, enviarPresencia, enviarAudioWhatsApp } from '@/lib/evolution'
import {
  getPromptCitas,
  extraerCitaDeRespuesta,
  crearCitaDesdeIA,
  obtenerCitasDelCliente,
  extraerModificacionCita,
  modificarCita,
  extraerCancelacionCita,
  cancelarCita,
  limpiarRespuestaCitas
} from '@/lib/citas-ia'
import { buscarContextoRelevante, construirPromptConRAG } from '@/lib/rag'
import { descargarMedia, base64ToBuffer, esAudioCompatible, esImagenCompatible } from '@/lib/media'
import { generarAudio } from '@/lib/elevenlabs'

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
        const transcripcion = await transcribirAudio(audioBuffer, mediaInfo.mimetype, clienteId)

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
            : 'Describe detalladamente qué ves en esta imagen. Si hay texto o productos, identifícalos.',
          clienteId
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

    // Buscar el ultimo usuario que respondio a este numero (para asignar la conversacion)
    const ultimoUsuario = await queryOne(
      `SELECT usuario_id FROM historial_conversaciones
       WHERE cliente_id = $1 AND numero_whatsapp = $2 AND usuario_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [clienteId, numero]
    )
    const usuarioAsignado = ultimoUsuario?.usuario_id || null

    // Guardar mensaje entrante en historial (asignado al usuario que respondio previamente)
    await query(
      `INSERT INTO historial_conversaciones (cliente_id, numero_whatsapp, rol, mensaje, usuario_id)
       VALUES ($1, $2, 'user', $3, $4)`,
      [clienteId, numero, texto, usuarioAsignado]
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

    // Guardar tipo de mensaje original para decidir formato de respuesta
    const mensajeEntranteEsAudio = tipo === 'audio'

    // Buscar agente activo (preferir configuracion_agente, fallback a agentes)
    let agente = await queryOne(
      `SELECT *, voice_id, responder_con_audio FROM configuracion_agente
       WHERE cliente_id = $1 AND activo = true LIMIT 1`,
      [clienteId]
    )

    if (!agente) {
      agente = await queryOne(
        `SELECT *, voice_id, responder_con_audio FROM agentes
         WHERE cliente_id = $1 AND estado = 'activo' LIMIT 1`,
        [clienteId]
      )
    }

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
            `INSERT INTO historial_conversaciones (cliente_id, numero_whatsapp, rol, mensaje, usuario_id)
             VALUES ($1, $2, 'assistant', $3, $4)`,
            [clienteId, numero, config.mensaje_fuera_horario, usuarioAsignado]
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

    // Analizar sentimiento del mensaje del usuario
    const sentimiento = await analizarSentimiento(texto)
    console.log(`Sentimiento detectado: ${sentimiento.sentimiento} (${sentimiento.emocion})`)

    // Obtener citas del cliente para informar al agente
    const citasDelCliente = await obtenerCitasDelCliente(clienteId, numero)
    console.log(`Citas del cliente: ${citasDelCliente.length} encontradas`)

    // Obtener nombre del agente (priorizar nombre_custom sobre nombre_agente)
    const nombreAgente = agente.nombre_custom || agente.nombre_agente || 'Asistente'

    // Construir mensajes para la IA (incluir instrucciones de citas con info del cliente)
    const promptBase = agente.prompt_sistema + getPromptCitas(citasDelCliente)
    const promptSistema = construirPromptConRAG(
      promptBase,
      contextoRelevante,
      nombreAgente,
      {
        sentimiento: {
          tipo: sentimiento.emocion,
          sugerencia: sentimiento.sugerencia
        }
      }
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
      clienteId: clienteId, // Para tracking de métricas
    })

    if (!respuestaIA.content) {
      console.error('Respuesta IA vacía')
      return NextResponse.json({ status: 'error', error: 'Respuesta IA vacía' })
    }

    // Verificar si la IA agendó una cita
    let citaCreada = null
    let citaModificada = null
    let citaCancelada = null

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
    }

    // Verificar si la IA modificó una cita
    const modificacionDetectada = extraerModificacionCita(respuestaIA.content)
    if (modificacionDetectada) {
      console.log('Modificación de cita detectada:', modificacionDetectada)
      const resultadoModificacion = await modificarCita(
        clienteId,
        modificacionDetectada.citaId,
        modificacionDetectada.nuevaFecha,
        modificacionDetectada.nuevaHora
      )
      if (resultadoModificacion.success) {
        citaModificada = modificacionDetectada.citaId
        console.log('Cita modificada automáticamente:', citaModificada)
      } else {
        console.error('Error modificando cita:', resultadoModificacion.error)
      }
    }

    // Verificar si la IA canceló una cita
    const cancelacionDetectada = extraerCancelacionCita(respuestaIA.content)
    if (cancelacionDetectada) {
      console.log('Cancelación de cita detectada:', cancelacionDetectada)
      const resultadoCancelacion = await cancelarCita(
        clienteId,
        cancelacionDetectada.citaId,
        cancelacionDetectada.motivo
      )
      if (resultadoCancelacion.success) {
        citaCancelada = cancelacionDetectada.citaId
        console.log('Cita cancelada automáticamente:', citaCancelada)
      } else {
        console.error('Error cancelando cita:', resultadoCancelacion.error)
      }
    }

    // Limpiar la respuesta para no mostrar los bloques técnicos al usuario
    respuestaIA.content = limpiarRespuestaCitas(respuestaIA.content)

    // Enviar respuesta por WhatsApp (audio si el usuario envió audio, texto si envió texto)
    let resultado
    let enviadoComoAudio = false

    // Solo enviar audio si:
    // 1. El agente tiene audio habilitado y configurado
    // 2. El usuario envió un audio (responder en el mismo formato)
    const debeEnviarAudio = agente.responder_con_audio &&
                            agente.voice_id &&
                            process.env.ELEVENLABS_API_KEY &&
                            mensajeEntranteEsAudio

    if (debeEnviarAudio) {
      // Verificar limite de caracteres ElevenLabs del plan
      const limiteInfo = await queryOne(
        `SELECT c.uso_elevenlabs_caracteres, p.max_caracteres_elevenlabs,
                c.tipo_cliente
         FROM clientes c
         LEFT JOIN planes p ON c.plan_id = p.id
         WHERE c.id = $1`,
        [clienteId]
      )

      const limite = limiteInfo?.max_caracteres_elevenlabs || 10000
      const usado = limiteInfo?.uso_elevenlabs_caracteres || 0
      const esSuperAdmin = limiteInfo?.tipo_cliente === 'superadmin'
      const caracteresRespuesta = respuestaIA.content.length

      // Super admin no tiene limite
      if (!esSuperAdmin && (usado + caracteresRespuesta) > limite) {
        console.log(`Limite ElevenLabs alcanzado: ${usado}/${limite} caracteres`)
        // Fallback a texto si se alcanzo el limite
      } else {
        // Mostrar "grabando audio..." al usuario
        await enviarPresencia(
          instancia.evolution_instance,
          instancia.evolution_api_key || process.env.EVOLUTION_API_KEY || '',
          numero,
          'recording'
        )

        // Generar audio con ElevenLabs
        console.log('Generando audio con ElevenLabs para:', numero)
        const audioGenerado = await generarAudio({
          texto: respuestaIA.content,
          voiceId: agente.voice_id,
          clienteId: clienteId,
        })

        if (audioGenerado) {
          // Enviar como nota de voz
          const audioBase64 = audioGenerado.audioBuffer.toString('base64')
          resultado = await enviarAudioWhatsApp({
            instancia: instancia.evolution_instance,
            apiKey: instancia.evolution_api_key || process.env.EVOLUTION_API_KEY || '',
            numero,
            mediaBase64: audioBase64,
            mimetype: audioGenerado.contentType, // audio/mpeg
            delayMs: 300,
          })
          enviadoComoAudio = resultado.success
          console.log(`Audio generado: ${audioGenerado.caracteres} caracteres, costo: $${audioGenerado.costoUsd.toFixed(4)}`)

          // Actualizar uso de caracteres ElevenLabs
          if (enviadoComoAudio) {
            await execute(
              `UPDATE clientes SET uso_elevenlabs_caracteres = COALESCE(uso_elevenlabs_caracteres, 0) + $2 WHERE id = $1`,
              [clienteId, audioGenerado.caracteres]
            )
          }
        }
      }
    }

    // Si no se envió como audio (o falló), enviar como texto
    if (!enviadoComoAudio) {
      resultado = await enviarMensajeWhatsApp({
        instancia: instancia.evolution_instance,
        apiKey: instancia.evolution_api_key || process.env.EVOLUTION_API_KEY || '',
        numero,
        mensaje: respuestaIA.content,
        delayMs: 500 + Math.random() * 1500, // Delay aleatorio 0.5-2s para parecer más natural
      })
    }

    if (!resultado?.success) {
      console.error('Error enviando mensaje:', resultado?.error)
      return NextResponse.json({ status: 'error', error: resultado?.error })
    }

    // Guardar respuesta en historial (mantener asignacion al mismo usuario)
    await query(
      `INSERT INTO historial_conversaciones (cliente_id, numero_whatsapp, rol, mensaje, usuario_id)
       VALUES ($1, $2, 'assistant', $3, $4)`,
      [clienteId, numero, respuestaIA.content, usuarioAsignado]
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
      enviado_como_audio: enviadoComoAudio,
      tokens_usados: respuestaIA.tokensUsados,
      cita_creada: citaCreada,
      cita_modificada: citaModificada,
      cita_cancelada: citaCancelada,
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
