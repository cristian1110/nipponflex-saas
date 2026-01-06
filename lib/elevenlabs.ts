// Servicio de ElevenLabs para Text-to-Speech y clonación de voz
import { registrarUsoAPI, PRECIOS_API } from './metricas'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

// Límite máximo de caracteres para audio (evita respuestas cortadas)
const MAX_CARACTERES_AUDIO = 500

/**
 * Limpia el texto para enviarlo a ElevenLabs
 * Elimina: markdown, emojis, URLs, caracteres especiales que pueden causar
 * cambio de idioma o ruidos extraños
 */
export function limpiarTextoParaAudio(texto: string): string {
  let limpio = texto

  // 1. Eliminar URLs
  limpio = limpio.replace(/https?:\/\/[^\s]+/gi, '')
  limpio = limpio.replace(/www\.[^\s]+/gi, '')

  // 2. Eliminar markdown
  limpio = limpio.replace(/\*\*([^*]+)\*\*/g, '$1') // **bold**
  limpio = limpio.replace(/\*([^*]+)\*/g, '$1')     // *italic*
  limpio = limpio.replace(/__([^_]+)__/g, '$1')     // __bold__
  limpio = limpio.replace(/_([^_]+)_/g, '$1')       // _italic_
  limpio = limpio.replace(/~~([^~]+)~~/g, '$1')     // ~~strikethrough~~
  limpio = limpio.replace(/`([^`]+)`/g, '$1')       // `code`
  limpio = limpio.replace(/```[\s\S]*?```/g, '')    // ```code blocks```
  limpio = limpio.replace(/^#+\s*/gm, '')           // # headers
  limpio = limpio.replace(/^[-*+]\s*/gm, '')        // - list items
  limpio = limpio.replace(/^\d+\.\s*/gm, '')        // 1. numbered lists
  limpio = limpio.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url)

  // 3. Eliminar emojis y símbolos especiales
  limpio = limpio.replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
  limpio = limpio.replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols
  limpio = limpio.replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
  limpio = limpio.replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical
  limpio = limpio.replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric
  limpio = limpio.replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Arrows
  limpio = limpio.replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental
  limpio = limpio.replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess
  limpio = limpio.replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols
  limpio = limpio.replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
  limpio = limpio.replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
  limpio = limpio.replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors

  // 4. Eliminar caracteres especiales que pueden causar problemas
  limpio = limpio.replace(/[<>{}[\]\\|^~`]/g, '')

  // 5. Normalizar comillas y apóstrofes
  limpio = limpio.replace(/[""]/g, '"')
  limpio = limpio.replace(/['']/g, "'")

  // 6. Eliminar caracteres no-ASCII sospechosos (mantener acentos españoles)
  // Mantener: a-z, A-Z, 0-9, espacios, puntuación básica, acentos españoles
  limpio = limpio.replace(/[^\w\s.,;:!?¿¡'"()áéíóúüñÁÉÍÓÚÜÑ-]/g, ' ')

  // 7. Limpiar espacios múltiples
  limpio = limpio.replace(/\s+/g, ' ').trim()

  // 8. Asegurar que termine con puntuación
  if (limpio && !/[.!?]$/.test(limpio)) {
    limpio += '.'
  }

  return limpio
}

/**
 * Limita el texto a un máximo de caracteres, cortando en un punto final
 * para que la frase quede completa
 */
export function limitarTextoParaAudio(texto: string, maxCaracteres: number = MAX_CARACTERES_AUDIO): { texto: string; cortado: boolean } {
  if (texto.length <= maxCaracteres) {
    return { texto, cortado: false }
  }

  // Buscar el último punto antes del límite
  const textoRecortado = texto.substring(0, maxCaracteres)
  const ultimoPunto = textoRecortado.lastIndexOf('.')
  const ultimoSigno = Math.max(
    textoRecortado.lastIndexOf('.'),
    textoRecortado.lastIndexOf('!'),
    textoRecortado.lastIndexOf('?')
  )

  if (ultimoSigno > maxCaracteres * 0.5) {
    // Cortar en el último signo de puntuación si está después de la mitad
    return {
      texto: textoRecortado.substring(0, ultimoSigno + 1) + ' ¿Deseas más información?',
      cortado: true
    }
  } else {
    // Si no hay buen punto de corte, cortar y agregar puntos suspensivos
    const ultimoEspacio = textoRecortado.lastIndexOf(' ')
    const corte = ultimoEspacio > maxCaracteres * 0.7 ? ultimoEspacio : maxCaracteres
    return {
      texto: textoRecortado.substring(0, corte).trim() + '... ¿Deseas más información?',
      cortado: true
    }
  }
}

/**
 * Prepara el texto completo para enviarlo a ElevenLabs
 * Combina limpieza + límite de caracteres
 */
export function prepararTextoParaAudio(texto: string): { texto: string; cortado: boolean; original: number; final: number } {
  const original = texto.length
  const limpio = limpiarTextoParaAudio(texto)
  const { texto: textoFinal, cortado } = limitarTextoParaAudio(limpio)

  return {
    texto: textoFinal,
    cortado,
    original,
    final: textoFinal.length
  }
}

// Voces predeterminadas de ElevenLabs (multilingual v2)
export const VOCES_PREDETERMINADAS = {
  'rachel': { id: '21m00Tcm4TlvDq8ikWAM', nombre: 'Rachel', idioma: 'en', genero: 'femenino' },
  'drew': { id: '29vD33N1CtxCmqQRPOHJ', nombre: 'Drew', idioma: 'en', genero: 'masculino' },
  'clyde': { id: '2EiwWnXFnvU5JabPnv8n', nombre: 'Clyde', idioma: 'en', genero: 'masculino' },
  'paul': { id: '5Q0t7uMcjvnagumLfvZi', nombre: 'Paul', idioma: 'en', genero: 'masculino' },
  'domi': { id: 'AZnzlk1XvdvUeBnXmlld', nombre: 'Domi', idioma: 'en', genero: 'femenino' },
  'dave': { id: 'CYw3kZ02Hs0563khs1Fj', nombre: 'Dave', idioma: 'en', genero: 'masculino' },
  'fin': { id: 'D38z5RcWu1voky8WS1ja', nombre: 'Fin', idioma: 'en', genero: 'masculino' },
  'sarah': { id: 'EXAVITQu4vr4xnSDxMaL', nombre: 'Sarah', idioma: 'en', genero: 'femenino' },
  'antoni': { id: 'ErXwobaYiN019PkySvjV', nombre: 'Antoni', idioma: 'en', genero: 'masculino' },
  'thomas': { id: 'GBv7mTt0atIp3Br8iCZE', nombre: 'Thomas', idioma: 'en', genero: 'masculino' },
  'charlie': { id: 'IKne3meq5aSn9XLyUdCD', nombre: 'Charlie', idioma: 'en', genero: 'masculino' },
  'emily': { id: 'LcfcDJNUP1GQjkzn1xUU', nombre: 'Emily', idioma: 'en', genero: 'femenino' },
  'elli': { id: 'MF3mGyEYCl7XYWbV9V6O', nombre: 'Elli', idioma: 'en', genero: 'femenino' },
  'callum': { id: 'N2lVS1w4EtoT3dr4eOWO', nombre: 'Callum', idioma: 'en', genero: 'masculino' },
  'patrick': { id: 'ODq5zmih8GrVes37Dizd', nombre: 'Patrick', idioma: 'en', genero: 'masculino' },
  'harry': { id: 'SOYHLrjzK2X1ezoPC6cr', nombre: 'Harry', idioma: 'en', genero: 'masculino' },
  'freya': { id: 'jsCqWAovK2LkecY7zXl4', nombre: 'Freya', idioma: 'en', genero: 'femenino' },
  'grace': { id: 'oWAxZDx7w5VEj9dCyTzz', nombre: 'Grace', idioma: 'en', genero: 'femenino' },
  'daniel': { id: 'onwK4e9ZLuTAKqWW03F9', nombre: 'Daniel', idioma: 'en', genero: 'masculino' },
  'lily': { id: 'pFZP5JQG7iQjIQuC4Bku', nombre: 'Lily', idioma: 'en', genero: 'femenino' },
  'serena': { id: 'pMsXgVXv3BLzUgSXRplE', nombre: 'Serena', idioma: 'en', genero: 'femenino' },
  'adam': { id: 'pNInz6obpgDQGcFmaJgB', nombre: 'Adam', idioma: 'en', genero: 'masculino' },
  'nicole': { id: 'piTKgcLEGmPE4e6mEKli', nombre: 'Nicole', idioma: 'en', genero: 'femenino' },
  'jessica': { id: 'cgSgspJ2msm6clMCkdW9', nombre: 'Jessica', idioma: 'en', genero: 'femenino' },
  'matilda': { id: 'XrExE9yKIg1WjnnlVkGX', nombre: 'Matilda', idioma: 'en', genero: 'femenino' },
} as const

// ============================================
// CONVERSION SIMPLE DE HORAS PARA TTS
// Solo convierte horas HH:MM a formato hablado
// ============================================

/**
 * Convierte horas en formato 24h (HH:MM) a formato hablado en espanol
 * Ej: "a las 13:40" -> "a la una y cuarenta de la tarde"
 * Maneja correctamente cuando ya hay "a las" o "a la" antes del numero
 */
function convertirHorasEnTexto(texto: string): string {
  // Numeros del 1-12 para las horas (sin tildes para evitar problemas)
  const numeros = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce']

  // Regex que captura el contexto antes de la hora: "a las", "a la", "las", "la", o nada
  // Grupo 1: prefijo opcional (a las, a la, las, la)
  // Grupo 2: hora
  // Grupo 3: minutos
  return texto.replace(/(a las |a la |las |la )?(\d{1,2}):(\d{2})\b/gi, (match, prefijo, h, m) => {
    const hora = parseInt(h)
    const minutos = parseInt(m)

    // Validar rango
    if (hora < 0 || hora > 23 || minutos < 0 || minutos > 59) {
      return match // Devolver sin cambios si no es valido
    }

    // Casos especiales
    if (hora === 0 && minutos === 0) {
      // Si habia prefijo, quitarlo porque "medianoche" no lo necesita
      return prefijo ? 'medianoche' : 'medianoche'
    }
    if (hora === 12 && minutos === 0) {
      return prefijo ? 'mediodia' : 'mediodia'
    }

    // Convertir a formato 12 horas
    let hora12 = hora % 12
    if (hora12 === 0) hora12 = 12

    // Determinar periodo del dia
    let periodo = ''
    if (hora >= 0 && hora < 12) {
      periodo = 'de la manana'
    } else if (hora >= 12 && hora < 19) {
      periodo = 'de la tarde'
    } else {
      periodo = 'de la noche'
    }

    // Articulo correcto segun la hora (la una, las dos, las tres...)
    const articulo = hora12 === 1 ? 'la' : 'las'
    const horaTexto = numeros[hora12]

    // Construir minutos
    let minutosTexto = ''
    if (minutos === 0) {
      minutosTexto = ''
    } else if (minutos === 15) {
      minutosTexto = ' y cuarto'
    } else if (minutos === 30) {
      minutosTexto = ' y media'
    } else if (minutos === 45) {
      minutosTexto = ' y tres cuartos'
    } else {
      minutosTexto = ` y ${minutos}`
    }

    // Si habia prefijo "a las" o "a la", reemplazarlo con "a" + articulo correcto
    // Si habia solo "las" o "la", reemplazarlo con el articulo correcto
    // Si no habia prefijo, agregar el articulo
    if (prefijo) {
      const prefijoLower = prefijo.toLowerCase().trim()
      if (prefijoLower === 'a las' || prefijoLower === 'a la') {
        // Habia "a las 13:30" o "a la 13:30" -> "a la una y media"
        return `a ${articulo} ${horaTexto}${minutosTexto} ${periodo}`
      } else {
        // Habia "las 13:30" o "la 13:30" -> "la una y media"
        return `${articulo} ${horaTexto}${minutosTexto} ${periodo}`
      }
    }

    // No habia prefijo, agregar articulo
    return `${articulo} ${horaTexto}${minutosTexto} ${periodo}`
  })
}

interface GenerarAudioParams {
  texto: string
  voiceId?: string
  modelo?: string
  clienteId?: number
  stability?: number
  similarityBoost?: number
  style?: number
  useSpeakerBoost?: boolean
}

interface GenerarAudioResponse {
  audioBuffer: Buffer
  contentType: string
  caracteres: number
  costoUsd: number
}

// Generar audio TTS
export async function generarAudio(params: GenerarAudioParams): Promise<GenerarAudioResponse | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY no configurada')
    return null
  }

  const {
    texto,
    voiceId = VOCES_PREDETERMINADAS.adam.id, // Voz predeterminada
    modelo = 'eleven_multilingual_v2', // Mejor para español
    clienteId,
    // Parámetros optimizados para audio estable y natural:
    // - stability 0.5 = balance entre natural y estable (evita ruidos/cambios de idioma)
    // - similarityBoost 0.75 = fiel a la voz pero con margen
    // - style 0.3 = expresividad moderada (evita distorsiones)
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.3,
    useSpeakerBoost = true,
  } = params

  // 1. Preparar texto: limpiar + limitar caracteres
  const { texto: textoLimpio, cortado, original, final } = prepararTextoParaAudio(texto)

  // 2. Convertir horas a formato hablado
  const textoFinal = convertirHorasEnTexto(textoLimpio)

  console.log(`[ElevenLabs] Original: ${original} chars -> Limpio: ${final} chars ${cortado ? '(CORTADO)' : ''}`)
  console.log('[ElevenLabs] Texto a sintetizar:', textoFinal.substring(0, 100) + (textoFinal.length > 100 ? '...' : ''))

  const startTime = Date.now()

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: textoFinal,
        model_id: modelo,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error ElevenLabs:', response.status, error)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)
    const duracionMs = Date.now() - startTime
    const caracteres = textoFinal.length
    const costoUsd = caracteres * PRECIOS_API.elevenlabs.default

    // Validar que el audio no esté vacío o corrupto
    if (audioBuffer.length < 1000) {
      console.error(`[ElevenLabs] Audio muy pequeño (${audioBuffer.length} bytes), posiblemente corrupto`)
      return null
    }

    // Validar headers de MP3 (debe empezar con 0xFF 0xFB o ID3)
    const header = audioBuffer.slice(0, 3)
    const isValidMP3 = (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) || // Frame sync
                       (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) // ID3

    if (!isValidMP3) {
      console.error('[ElevenLabs] Audio no es MP3 válido, headers:', header.toString('hex'))
      return null
    }

    // Registrar métricas
    if (clienteId) {
      await registrarUsoAPI({
        clienteId,
        servicio: 'elevenlabs',
        endpoint: 'text-to-speech',
        tokensInput: caracteres,
        costoUsd,
        duracionMs,
        modelo,
        metadata: { caracteres, voiceId, cortado },
      })
    }

    console.log(`[ElevenLabs] Audio generado: ${caracteres} chars, ${audioBuffer.length} bytes, ${duracionMs}ms`)

    return {
      audioBuffer,
      contentType: 'audio/mpeg',
      caracteres,
      costoUsd,
    }
  } catch (error) {
    console.error('Error generando audio ElevenLabs:', error)
    return null
  }
}

// Obtener lista de voces disponibles
export async function obtenerVoces(): Promise<any[] | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY no configurada')
    return null
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': apiKey,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error obteniendo voces:', response.status, error)
      return null
    }

    const data = await response.json()
    return data.voices || []
  } catch (error) {
    console.error('Error obteniendo voces:', error)
    return null
  }
}

interface ClonarVozParams {
  nombre: string
  descripcion?: string
  audioBuffer: Buffer
  clienteId?: number
}

interface ClonarVozResponse {
  voice_id: string
  nombre: string
}

// Clonar voz desde muestra de audio
export async function clonarVoz(params: ClonarVozParams): Promise<ClonarVozResponse | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY no configurada')
    return null
  }

  const { nombre, descripcion = '', audioBuffer, clienteId } = params

  try {
    const formData = new FormData()
    formData.append('name', nombre)
    formData.append('description', descripcion)

    // Agregar muestra de audio
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    formData.append('files', blob, 'sample.mp3')

    const response = await fetch(`${ELEVENLABS_API_URL}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error clonando voz:', response.status, error)
      return null
    }

    const data = await response.json()
    const voiceId = data.voice_id

    console.log(`Voz clonada exitosamente: ${voiceId}`)

    // Registrar evento
    if (clienteId) {
      await registrarUsoAPI({
        clienteId,
        servicio: 'elevenlabs',
        endpoint: 'voices/add',
        metadata: { voiceId, nombre },
      })
    }

    return {
      voice_id: voiceId,
      nombre: nombre
    }
  } catch (error) {
    console.error('Error clonando voz:', error)
    return null
  }
}

// Eliminar voz clonada
export async function eliminarVoz(voiceId: string): Promise<boolean> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY no configurada')
    return false
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': apiKey,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error eliminando voz:', response.status, error)
      return false
    }

    console.log(`Voz eliminada: ${voiceId}`)
    return true
  } catch (error) {
    console.error('Error eliminando voz:', error)
    return false
  }
}

// Obtener informacion de uso/cuota
export async function obtenerCuota(): Promise<any | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY no configurada')
    return null
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
      headers: {
        'xi-api-key': apiKey,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error obteniendo cuota:', response.status, error)
      return null
    }

    return response.json()
  } catch (error) {
    console.error('Error obteniendo cuota:', error)
    return null
  }
}

// Modelos disponibles
export const MODELOS_ELEVENLABS = {
  'eleven_multilingual_v2': 'Multilingual v2 (Mejor para espanol)',
  'eleven_monolingual_v1': 'Monolingual v1 (Solo ingles)',
  'eleven_turbo_v2': 'Turbo v2 (Rapido, menor calidad)',
  'eleven_turbo_v2_5': 'Turbo v2.5 (Rapido, buena calidad)',
} as const
