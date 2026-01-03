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
