// Servicio de ElevenLabs para Text-to-Speech y clonación de voz
import { registrarUsoAPI, PRECIOS_API } from './metricas'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

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
    // Parámetros ajustados para sonido más natural:
    // - stability más baja = más variación natural en el habla
    // - similarityBoost alta = más fiel a la voz original
    // - style más alto = más expresividad emocional
    stability = 0.35,
    similarityBoost = 0.85,
    style = 0.65,
    useSpeakerBoost = true,
  } = params

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
        text: texto,
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
    const caracteres = texto.length
    const costoUsd = caracteres * PRECIOS_API.elevenlabs.default

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
        metadata: { caracteres, voiceId },
      })
    }

    console.log(`Audio generado: ${caracteres} caracteres, ${audioBuffer.length} bytes`)

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

// Obtener información de uso/cuota
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
  'eleven_multilingual_v2': 'Multilingual v2 (Mejor para español)',
  'eleven_monolingual_v1': 'Monolingual v1 (Solo inglés)',
  'eleven_turbo_v2': 'Turbo v2 (Rápido, menor calidad)',
  'eleven_turbo_v2_5': 'Turbo v2.5 (Rápido, buena calidad)',
} as const
