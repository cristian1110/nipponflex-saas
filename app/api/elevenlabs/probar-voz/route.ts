import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST - Generar audio de prueba con los parámetros dados
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      texto = 'Hola, soy tu asistente virtual. ¿Cómo puedo ayudarte hoy?',
      voiceId,
      stability = 0.30,
      similarity = 0.60,
      style = 0.55
    } = body

    if (!voiceId) {
      return NextResponse.json({ error: 'Se requiere voiceId' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs no configurado' }, { status: 500 })
    }

    console.log(`[ElevenLabs] Prueba de voz - Voice: ${voiceId}, Stability: ${stability}, Similarity: ${similarity}, Style: ${style}`)

    // Generar audio con ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: texto,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: parseFloat(stability.toString()),
            similarity_boost: parseFloat(similarity.toString()),
            style: parseFloat(style.toString()),
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error ElevenLabs:', errorText)
      return NextResponse.json({ error: 'Error generando audio' }, { status: 500 })
    }

    // Obtener el audio como buffer
    const audioBuffer = await response.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')

    return NextResponse.json({
      success: true,
      audio: audioBase64,
      contentType: 'audio/mpeg',
      caracteres: texto.length
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
