// Servicio para descargar y procesar media de Evolution API

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-nipponflex.84.247.166.88.sslip.io'

interface MediaInfo {
  base64: string
  mimetype: string
  filename?: string
}

/**
 * Descarga media (audio, imagen, video, documento) de Evolution API
 */
export async function descargarMedia(
  instancia: string,
  apiKey: string,
  messageId: string,
  mediaKey?: string
): Promise<MediaInfo | null> {
  try {
    // Evolution API v2 - obtener media por messageId
    const response = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instancia}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        message: {
          key: {
            id: messageId
          }
        },
        convertToMp4: false,
      }),
    })

    if (!response.ok) {
      console.error('Error descargando media:', response.status)
      return null
    }

    const data = await response.json()

    if (data.base64) {
      return {
        base64: data.base64,
        mimetype: data.mimetype || 'application/octet-stream',
        filename: data.filename,
      }
    }

    return null
  } catch (error) {
    console.error('Error descargando media:', error)
    return null
  }
}

/**
 * Convierte base64 a Buffer para enviar a APIs
 */
export function base64ToBuffer(base64: string): Buffer {
  // Remover prefijo data:xxx;base64, si existe
  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '')
  return Buffer.from(cleanBase64, 'base64')
}

/**
 * Convierte base64 a Blob para FormData
 */
export function base64ToBlob(base64: string, mimetype: string): Blob {
  const buffer = base64ToBuffer(base64)
  return new Blob([buffer], { type: mimetype })
}

/**
 * Detecta el tipo de media basado en mimetype
 */
export function detectarTipoMedia(mimetype: string): 'audio' | 'image' | 'video' | 'document' {
  if (mimetype.startsWith('audio/')) return 'audio'
  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype.startsWith('video/')) return 'video'
  return 'document'
}

/**
 * Valida si el formato de audio es compatible con Whisper
 */
export function esAudioCompatible(mimetype: string): boolean {
  const compatibles = [
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
    'audio/wav', 'audio/webm', 'audio/ogg', 'audio/flac'
  ]
  return compatibles.some(c => mimetype.includes(c) || mimetype.includes('ogg'))
}

/**
 * Valida si el formato de imagen es compatible con Vision
 */
export function esImagenCompatible(mimetype: string): boolean {
  const compatibles = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  return compatibles.some(c => mimetype.includes(c))
}
