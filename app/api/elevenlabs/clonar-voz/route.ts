import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { clonarVoz, eliminarVoz } from '@/lib/elevenlabs'

export const dynamic = 'force-dynamic'

// POST - Clonar voz con archivo de audio
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Verificar que el plan permite voz
    if (user.nivel < 100) {
      const clienteInfo = await queryOne(
        `SELECT c.tiene_voz, p.tiene_voz as plan_tiene_voz
         FROM clientes c
         LEFT JOIN planes p ON c.plan_id = p.id
         WHERE c.id = $1`,
        [user.cliente_id]
      )

      if (!clienteInfo?.tiene_voz && !clienteInfo?.plan_tiene_voz) {
        return NextResponse.json({
          error: 'Tu plan no incluye la funcion de voz. Actualiza tu plan para usar esta funcion.'
        }, { status: 403 })
      }
    }

    const formData = await request.formData()
    const nombre = formData.get('nombre') as string
    const descripcion = formData.get('descripcion') as string
    const archivo = formData.get('archivo') as File

    if (!nombre || !archivo) {
      return NextResponse.json({ error: 'Nombre y archivo son requeridos' }, { status: 400 })
    }

    // Validar tipo de archivo
    const tiposPermitidos = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a']
    if (!tiposPermitidos.includes(archivo.type)) {
      return NextResponse.json({
        error: 'Formato de audio no soportado. Usa MP3, WAV, OGG, WebM o M4A.'
      }, { status: 400 })
    }

    // Validar tamano (max 10MB)
    if (archivo.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo no debe superar 10MB' }, { status: 400 })
    }

    // Convertir a buffer
    const arrayBuffer = await archivo.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Clonar voz con ElevenLabs
    const resultado = await clonarVoz({
      nombre: `${nombre} (${user.cliente_id})`,
      descripcion: descripcion || `Voz clonada para cliente ${user.cliente_id}`,
      audioBuffer: buffer,
      clienteId: user.cliente_id!
    })

    if (!resultado) {
      return NextResponse.json({ error: 'Error al clonar voz en ElevenLabs' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      voice_id: resultado.voice_id,
      nombre: resultado.nombre,
      mensaje: 'Voz clonada exitosamente'
    })
  } catch (error) {
    console.error('Error clonando voz:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Eliminar voz clonada
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const voiceId = searchParams.get('voice_id')

    if (!voiceId) {
      return NextResponse.json({ error: 'voice_id requerido' }, { status: 400 })
    }

    const eliminada = await eliminarVoz(voiceId)

    if (!eliminada) {
      return NextResponse.json({ error: 'Error al eliminar voz' }, { status: 500 })
    }

    return NextResponse.json({ success: true, mensaje: 'Voz eliminada' })
  } catch (error) {
    console.error('Error eliminando voz:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
