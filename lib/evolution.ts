// Servicio para Evolution API - Envío de mensajes WhatsApp

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-nipponflex.84.247.166.88.sslip.io'

interface SendMessageOptions {
  instancia: string
  apiKey: string
  numero: string
  mensaje: string
  delayMs?: number
}

interface SendMessageResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function enviarMensajeWhatsApp(options: SendMessageOptions): Promise<SendMessageResult> {
  const { instancia, apiKey, numero, mensaje, delayMs = 0 } = options

  // Aplicar delay si se especifica (para comportamiento más natural)
  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  // Formatear número (agregar @s.whatsapp.net si no lo tiene)
  const numeroFormateado = numero.includes('@') ? numero : `${numero}@s.whatsapp.net`

  try {
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: numeroFormateado,
        text: mensaje,
        delay: 1000, // Delay interno de Evolution para simular typing
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error Evolution API:', response.status, errorText)
      return {
        success: false,
        error: `Error ${response.status}: ${errorText}`,
      }
    }

    const data = await response.json()

    return {
      success: true,
      messageId: data.key?.id || data.messageId,
    }
  } catch (error) {
    console.error('Error enviando mensaje WhatsApp:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

export async function verificarConexion(instancia: string, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?instanceName=${instancia}`, {
      headers: { 'apikey': apiKey },
    })

    if (!response.ok) return false

    const data = await response.json()
    const instance = Array.isArray(data) ? data[0] : data

    return instance?.instance?.state === 'open'
  } catch {
    return false
  }
}

export async function enviarPresencia(instancia: string, apiKey: string, numero: string, tipo: 'composing' | 'recording' = 'composing'): Promise<void> {
  try {
    const numeroFormateado = numero.includes('@') ? numero : `${numero}@s.whatsapp.net`

    await fetch(`${EVOLUTION_URL}/chat/updatePresence/${instancia}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: numeroFormateado,
        presence: tipo,
      }),
    })
  } catch (error) {
    console.error('Error enviando presencia:', error)
  }
}

// ============================================
// ENVÍO DE MULTIMEDIA
// ============================================

interface SendMediaOptions {
  instancia: string
  apiKey: string
  numero: string
  mediaUrl?: string       // URL pública de la imagen/audio
  mediaBase64?: string    // Base64 de la imagen/audio
  mimetype?: string       // Tipo MIME (image/jpeg, audio/ogg, etc.)
  caption?: string        // Texto que acompaña la imagen
  fileName?: string       // Nombre del archivo
  delayMs?: number
}

export async function enviarImagenWhatsApp(options: SendMediaOptions): Promise<SendMessageResult> {
  const { instancia, apiKey, numero, mediaUrl, mediaBase64, caption, delayMs = 0 } = options

  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  const numeroFormateado = numero.includes('@') ? numero : `${numero}@s.whatsapp.net`

  try {
    const body: any = {
      number: numeroFormateado,
      caption: caption || '',
    }

    // Preferir URL sobre base64
    if (mediaUrl) {
      body.mediatype = 'image'
      body.media = mediaUrl
    } else if (mediaBase64) {
      body.mediatype = 'image'
      body.media = mediaBase64.includes('base64,') ? mediaBase64 : `data:image/jpeg;base64,${mediaBase64}`
    } else {
      return { success: false, error: 'No se proporcionó imagen' }
    }

    const response = await fetch(`${EVOLUTION_URL}/message/sendMedia/${instancia}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error Evolution API (imagen):', response.status, errorText)
      return { success: false, error: `Error ${response.status}: ${errorText}` }
    }

    const data = await response.json()
    return { success: true, messageId: data.key?.id || data.messageId }
  } catch (error) {
    console.error('Error enviando imagen WhatsApp:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

export async function enviarAudioWhatsApp(options: SendMediaOptions): Promise<SendMessageResult> {
  const { instancia, apiKey, numero, mediaUrl, mediaBase64, mimetype = 'audio/mpeg', delayMs = 0 } = options

  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  const numeroFormateado = numero.includes('@') ? numero : `${numero}@s.whatsapp.net`

  try {
    // Evolution API v2 usa endpoint sendWhatsAppAudio para notas de voz
    const body: any = {
      number: numeroFormateado,
      delay: 1200,
    }

    if (mediaUrl) {
      body.audio = mediaUrl
    } else if (mediaBase64) {
      // Evolution API v2 espera base64 PURO sin prefijo data:
      let base64Puro = mediaBase64
      if (mediaBase64.includes('base64,')) {
        base64Puro = mediaBase64.split('base64,')[1]
      }
      body.audio = base64Puro
    } else {
      return { success: false, error: 'No se proporcionó audio' }
    }

    console.log(`Enviando audio como nota de voz: base64 puro (${body.audio.length} chars)`)

    // Usar endpoint sendWhatsAppAudio para que llegue como nota de voz
    const response = await fetch(`${EVOLUTION_URL}/message/sendWhatsAppAudio/${instancia}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error Evolution API (audio):', response.status, errorText)

      // Si falla sendWhatsAppAudio, intentar con sendMedia
      console.log('Intentando con sendMedia como fallback...')
      const fallbackBody = {
        number: numeroFormateado,
        mediatype: 'audio',
        mimetype: 'audio/mp4',
        media: body.audio,
        delay: 1200,
      }

      const fallbackResponse = await fetch(`${EVOLUTION_URL}/message/sendMedia/${instancia}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify(fallbackBody),
      })

      if (!fallbackResponse.ok) {
        const fallbackError = await fallbackResponse.text()
        console.error('Error Evolution API (audio fallback):', fallbackResponse.status, fallbackError)
        return { success: false, error: `Error ${response.status}: ${errorText}` }
      }

      const fallbackData = await fallbackResponse.json()
      console.log('Audio enviado exitosamente (fallback):', fallbackData.key?.id || fallbackData.messageId)
      return { success: true, messageId: fallbackData.key?.id || fallbackData.messageId }
    }

    const data = await response.json()
    console.log('Audio enviado exitosamente:', data.key?.id || data.messageId)
    return { success: true, messageId: data.key?.id || data.messageId }
  } catch (error) {
    console.error('Error enviando audio WhatsApp:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// Función unificada para enviar cualquier tipo de media
interface SendUnifiedMediaOptions {
  instancia: string
  apiKey: string
  numero: string
  caption?: string
  mediaType: 'image' | 'audio' | 'document'
  mediaUrl?: string
  mediaBase64?: string
  mediaMimetype?: string
}

export async function enviarMediaWhatsApp(options: SendUnifiedMediaOptions): Promise<SendMessageResult> {
  const { mediaType, ...mediaOptions } = options

  switch (mediaType) {
    case 'image':
      return enviarImagenWhatsApp({
        ...mediaOptions,
        caption: options.caption,
      })
    case 'audio':
      return enviarAudioWhatsApp({
        ...mediaOptions,
        mimetype: options.mediaMimetype,
      })
    case 'document':
      return enviarDocumentoWhatsApp({
        ...mediaOptions,
        mimetype: options.mediaMimetype,
        caption: options.caption,
      })
    default:
      return { success: false, error: `Tipo de media no soportado: ${mediaType}` }
  }
}

export async function enviarDocumentoWhatsApp(options: SendMediaOptions): Promise<SendMessageResult> {
  const { instancia, apiKey, numero, mediaUrl, mediaBase64, mimetype, fileName, caption, delayMs = 0 } = options

  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  const numeroFormateado = numero.includes('@') ? numero : `${numero}@s.whatsapp.net`

  try {
    const body: any = {
      number: numeroFormateado,
      mediatype: 'document',
      fileName: fileName || 'documento',
      caption: caption || '',
    }

    if (mediaUrl) {
      body.media = mediaUrl
    } else if (mediaBase64) {
      body.media = mediaBase64.includes('base64,') ? mediaBase64 : `data:${mimetype || 'application/pdf'};base64,${mediaBase64}`
    } else {
      return { success: false, error: 'No se proporcionó documento' }
    }

    const response = await fetch(`${EVOLUTION_URL}/message/sendMedia/${instancia}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error Evolution API (documento):', response.status, errorText)
      return { success: false, error: `Error ${response.status}: ${errorText}` }
    }

    const data = await response.json()
    return { success: true, messageId: data.key?.id || data.messageId }
  } catch (error) {
    console.error('Error enviando documento WhatsApp:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
