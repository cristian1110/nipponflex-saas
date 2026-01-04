import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { obtenerVoces, VOCES_PREDETERMINADAS, MODELOS_ELEVENLABS } from '@/lib/elevenlabs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Si no hay API key configurada, devolver solo las voces predeterminadas como referencia
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({
        voces: Object.entries(VOCES_PREDETERMINADAS).map(([key, voz]) => ({
          voice_id: voz.id,
          name: voz.nombre,
          labels: { gender: voz.genero, language: voz.idioma }
        })),
        modelos: MODELOS_ELEVENLABS,
        api_configurada: false
      })
    }

    // Obtener voces desde la API de ElevenLabs
    const voces = await obtenerVoces()

    return NextResponse.json({
      voces: voces || [],
      modelos: MODELOS_ELEVENLABS,
      api_configurada: true
    })
  } catch (error) {
    console.error('Error obteniendo voces:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
