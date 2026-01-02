import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { mensaje, tipo } = await request.json()

    if (!mensaje) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'API de IA no configurada' }, { status: 500 })
    }

    const systemPrompt = tipo === 'seguimiento' 
      ? `Eres un experto en marketing y ventas por WhatsApp. Mejora este mensaje de SEGUIMIENTO para que sea más persuasivo pero amigable. 
         Mantén las variables entre corchetes [NOMBRE], [EMPRESA], etc. 
         El mensaje debe ser corto (máximo 3 líneas), natural y en español latinoamericano.
         NO uses emojis excesivos. Máximo 1-2 emojis.`
      : `Eres un experto en marketing y ventas por WhatsApp. Mejora este mensaje inicial para que sea más atractivo y genere curiosidad.
         Mantén las variables entre corchetes [NOMBRE], [EMPRESA], etc.
         El mensaje debe ser corto (máximo 4 líneas), natural y en español latinoamericano.
         NO uses emojis excesivos. Máximo 1-2 emojis.
         La estrategia debe ser dar VALOR primero, no vender directamente.`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Mejora este mensaje:\n\n${mensaje}` }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    })

    if (!response.ok) {
      throw new Error('Error en API de IA')
    }

    const data = await response.json()
    const mensaje_mejorado = data.choices[0]?.message?.content || mensaje

    return NextResponse.json({ mensaje_mejorado })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error al mejorar mensaje' }, { status: 500 })
  }
}
