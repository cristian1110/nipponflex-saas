import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { prompt, tipo_agente } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt requerido' }, { status: 400 })
    }

    // Obtener API key de Groq del cliente
    const cliente = await queryOne(
      `SELECT api_key_groq FROM clientes WHERE id = $1`,
      [user.cliente_id]
    )

    const apiKey = cliente?.api_key_groq || process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key de Groq no configurada' }, { status: 400 })
    }

    // Llamar a Groq para mejorar el prompt
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en crear prompts para agentes de WhatsApp. Mejora el prompt que te den siguiendo estas reglas:

- Mantén el prompt en español
- Máximo 150 palabras
- Tono amigable y profesional
- Respuestas cortas (máx 3 oraciones)
- NO seas agresivo con ventas o citas
- Primero saluda y pregunta en qué ayudar
- Solo ofrece productos/citas si el cliente pregunta
- Usa emojis con moderación (1-2 por mensaje)
- Si es agente de ventas: da precios solo cuando pregunten
- Si es agente de citas: ofrece agendar solo si hay interés

Tipo de agente: ${tipo_agente || 'General'}

Devuelve SOLO el prompt mejorado, sin explicaciones.`
          },
          {
            role: 'user',
            content: `Mejora este prompt:\n\n${prompt}`
          }
        ],
        temperature: 0.7,
        max_tokens: 400
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error Groq:', errorText)
      return NextResponse.json({ error: 'Error al conectar con Groq: ' + response.status }, { status: 500 })
    }

    const data = await response.json()
    const promptMejorado = data.choices?.[0]?.message?.content || prompt

    return NextResponse.json({ prompt_mejorado: promptMejorado })
  } catch (error: any) {
    console.error('Error mejorar-prompt:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
