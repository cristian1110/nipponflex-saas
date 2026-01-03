// Servicio de IA para respuestas automáticas con Groq
// Compatible con OpenAI API format

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIConfig {
  modelo?: string
  temperatura?: number
  maxTokens?: number
}

interface AIResponse {
  content: string
  tokensUsados: number
  modelo: string
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

    return {
      content: data.choices[0]?.message?.content || '',
      tokensUsados: data.usage?.total_tokens || 0,
      modelo: modelo,
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
  'llama-3.2-90b-vision-preview': 'Llama 3.2 90B Vision',
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
