// Servicio de IA para respuestas automáticas con Groq
// Compatible con OpenAI API format

import { registrarUsoAPI, calcularCostoGroq, PRECIOS_API } from './metricas'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | any[]
}

interface AIConfig {
  modelo?: string
  temperatura?: number
  maxTokens?: number
  clienteId?: number // Para tracking de métricas
}

interface AIResponse {
  content: string
  tokensUsados: number
  tokensInput: number
  tokensOutput: number
  modelo: string
  costoUsd: number
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.1-8b-instant' // Rápido y eficiente

export async function generarRespuestaIA(
  mensajes: Message[],
  config: AIConfig = {}
): Promise<AIResponse> {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    throw new Error('GROQ_API_KEY no configurada')
  }

  const modelo = config.modelo || DEFAULT_MODEL
  const temperatura = config.temperatura ?? 0.7
  const maxTokens = config.maxTokens || 500
  const startTime = Date.now()

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelo,
        messages: mensajes,
        temperature: temperatura,
        max_tokens: maxTokens,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error Groq API:', error)
      throw new Error(`Error Groq: ${response.status}`)
    }

    const data = await response.json()
    const duracionMs = Date.now() - startTime

    const tokensInput = data.usage?.prompt_tokens || 0
    const tokensOutput = data.usage?.completion_tokens || 0
    const costoUsd = calcularCostoGroq(modelo, tokensInput, tokensOutput)

    // Registrar métricas si hay clienteId
    if (config.clienteId) {
      await registrarUsoAPI({
        clienteId: config.clienteId,
        servicio: 'groq',
        endpoint: 'chat/completions',
        tokensInput,
        tokensOutput,
        costoUsd,
        duracionMs,
        modelo,
      })
    }

    return {
      content: data.choices[0]?.message?.content || '',
      tokensUsados: tokensInput + tokensOutput,
      tokensInput,
      tokensOutput,
      modelo,
      costoUsd,
    }
  } catch (error) {
    console.error('Error generando respuesta IA:', error)
    throw error
  }
}

export function construirPromptSistema(
  promptBase: string,
  conocimientos: string[] = [],
  nombreAgente: string = 'Asistente'
): string {
  let prompt = promptBase

  // Agregar contexto de la base de conocimiento
  if (conocimientos.length > 0) {
    const contexto = conocimientos.join('\n\n---\n\n')
    prompt += `\n\n## Base de Conocimiento\nUsa la siguiente información para responder:\n\n${contexto}`
  }

  // Agregar instrucciones generales
  prompt += `\n\n## Instrucciones
- Responde siempre en español
- Sé conciso y directo (máximo 2-3 párrafos)
- Si no sabes algo, dilo honestamente
- No inventes información
- Usa un tono amable y profesional
- Tu nombre es ${nombreAgente}`

  return prompt
}

export function construirHistorialMensajes(
  historial: { rol: string; mensaje: string }[],
  limite: number = 10
): Message[] {
  // Tomar los últimos N mensajes para contexto
  const mensajesRecientes = historial.slice(-limite)

  return mensajesRecientes.map(m => ({
    role: m.rol === 'user' ? 'user' : 'assistant',
    content: m.mensaje,
  }))
}

// Mapeo de modelos para compatibilidad
export const MODELOS_DISPONIBLES = {
  'llama-3.1-8b-instant': 'Llama 3.1 8B (Rápido)',
  'llama-3.1-70b-versatile': 'Llama 3.1 70B (Potente)',
  'llama-3.2-11b-vision-preview': 'Llama 3.2 11B Vision',
  'mixtral-8x7b-32768': 'Mixtral 8x7B',
  'gemma2-9b-it': 'Gemma 2 9B',
}

export function mapearModelo(modeloOriginal: string): string {
  // Mapear modelos de OpenAI a Groq equivalentes
  const mapeo: Record<string, string> = {
    'gpt-4': 'llama-3.1-70b-versatile',
    'gpt-4o': 'llama-3.1-70b-versatile',
    'gpt-4o-mini': 'llama-3.1-8b-instant',
    'gpt-3.5-turbo': 'llama-3.1-8b-instant',
  }

  return mapeo[modeloOriginal] || modeloOriginal
}

// ============================================
// TRANSCRIPCIÓN DE AUDIO (Whisper)
// ============================================

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

export async function transcribirAudio(
  audioBuffer: Buffer,
  mimetype: string = 'audio/ogg',
  clienteId?: number
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    console.error('GROQ_API_KEY no configurada para Whisper')
    return null
  }

  const startTime = Date.now()

  try {
    // Determinar extensión del archivo
    const extensiones: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/mp4': 'm4a',
      'audio/m4a': 'm4a',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'audio/flac': 'flac',
    }
    const ext = extensiones[mimetype] || 'ogg'

    // Crear FormData con el archivo
    const formData = new FormData()
    const blob = new Blob([audioBuffer], { type: mimetype })
    formData.append('file', blob, `audio.${ext}`)
    formData.append('model', 'whisper-large-v3')
    formData.append('language', 'es')
    formData.append('response_format', 'verbose_json')

    const response = await fetch(GROQ_WHISPER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error Whisper:', response.status, error)
      return null
    }

    const data = await response.json()
    const duracionMs = Date.now() - startTime
    const duracionAudio = data.duration || 0
    const costoUsd = duracionAudio * PRECIOS_API.groq['whisper-large-v3']

    // Registrar métricas
    if (clienteId) {
      await registrarUsoAPI({
        clienteId,
        servicio: 'whisper',
        endpoint: 'audio/transcriptions',
        tokensInput: Math.ceil(duracionAudio),
        costoUsd,
        duracionMs,
        modelo: 'whisper-large-v3',
        metadata: { duracion_audio: duracionAudio }
      })
    }

    const transcripcion = data.text || ''
    console.log('Audio transcrito:', transcripcion.substring(0, 100) + '...')

    return transcripcion.trim()
  } catch (error) {
    console.error('Error transcribiendo audio:', error)
    return null
  }
}

// ============================================
// ANÁLISIS DE IMÁGENES (Vision)
// ============================================

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export async function analizarImagen(
  imageBase64: string,
  mimetype: string = 'image/jpeg',
  pregunta: string = 'Describe detalladamente qué ves en esta imagen. Si hay texto, transcríbelo.',
  clienteId?: number
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    console.error('GROQ_API_KEY no configurada para Vision')
    return null
  }

  const startTime = Date.now()

  try {
    // Asegurar formato correcto de base64
    const base64Data = imageBase64.includes('base64,')
      ? imageBase64
      : `data:${mimetype};base64,${imageBase64}`

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: pregunta,
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64Data,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error Vision:', response.status, error)
      return null
    }

    const data = await response.json()
    const duracionMs = Date.now() - startTime
    const tokensInput = data.usage?.prompt_tokens || 0
    const tokensOutput = data.usage?.completion_tokens || 0
    const costoUsd = calcularCostoGroq(VISION_MODEL, tokensInput, tokensOutput)

    // Registrar métricas
    if (clienteId) {
      await registrarUsoAPI({
        clienteId,
        servicio: 'vision',
        endpoint: 'chat/completions',
        tokensInput,
        tokensOutput,
        costoUsd,
        duracionMs,
        modelo: VISION_MODEL,
      })
    }

    const descripcion = data.choices[0]?.message?.content || null

    if (descripcion) {
      console.log('Imagen analizada:', descripcion.substring(0, 100) + '...')
    }

    return descripcion
  } catch (error) {
    console.error('Error analizando imagen:', error)
    return null
  }
}

// ============================================
// ANÁLISIS DE SENTIMIENTOS
// ============================================

export type Sentimiento = 'positivo' | 'negativo' | 'neutral' | 'frustrado' | 'confundido' | 'urgente'

export interface AnalisisSentimiento {
  sentimiento: Sentimiento
  intensidad: number // 1-10
  emocion: string
  sugerencia: string
}

export async function analizarSentimiento(mensaje: string): Promise<AnalisisSentimiento> {
  // Análisis rápido sin llamar a la API para mensajes simples
  const mensajeLower = mensaje.toLowerCase()

  // Detectar frustración/enojo
  if (/molest|enoj|frust|harto|mal servicio|quejar|reclam|terrible|pésimo|horrible/i.test(mensaje)) {
    return {
      sentimiento: 'frustrado',
      intensidad: 8,
      emocion: 'frustración',
      sugerencia: 'Responde con mucha empatía, discúlpate si es necesario y ofrece soluciones concretas.'
    }
  }

  // Detectar urgencia
  if (/urgent|emergencia|ahora mismo|ya|inmediato|rápido|pronto|ayuda/i.test(mensaje)) {
    return {
      sentimiento: 'urgente',
      intensidad: 7,
      emocion: 'urgencia',
      sugerencia: 'Responde de forma directa y eficiente, prioriza dar una solución rápida.'
    }
  }

  // Detectar confusión
  if (/no entiendo|confund|cómo funciona|explica|qué significa|no sé|help|ayuda.*entender/i.test(mensaje)) {
    return {
      sentimiento: 'confundido',
      intensidad: 5,
      emocion: 'confusión',
      sugerencia: 'Explica de forma clara y sencilla, usa ejemplos si es posible.'
    }
  }

  // Detectar negatividad general
  if (/no me gusta|mal|problema|error|falla|no funciona|no sirve/i.test(mensaje)) {
    return {
      sentimiento: 'negativo',
      intensidad: 6,
      emocion: 'insatisfacción',
      sugerencia: 'Muestra comprensión por el problema y ofrece ayuda activa.'
    }
  }

  // Detectar positividad
  if (/gracias|excelente|genial|perfecto|increíble|bueno|me gusta|feliz|contento|👍|😊|🙂|❤️/i.test(mensaje)) {
    return {
      sentimiento: 'positivo',
      intensidad: 7,
      emocion: 'satisfacción',
      sugerencia: 'Mantén el tono positivo y amigable, agradece su confianza.'
    }
  }

  // Saludos y preguntas simples
  if (/hola|buenos días|buenas tardes|buenas noches|qué tal|cómo estás/i.test(mensaje)) {
    return {
      sentimiento: 'positivo',
      intensidad: 5,
      emocion: 'cordialidad',
      sugerencia: 'Responde de forma cálida y amigable, preséntate con tu nombre.'
    }
  }

  // Neutral por defecto
  return {
    sentimiento: 'neutral',
    intensidad: 5,
    emocion: 'neutral',
    sugerencia: 'Responde de forma profesional y amable.'
  }
}
