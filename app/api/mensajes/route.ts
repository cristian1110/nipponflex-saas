import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-nipponflex.84.247.166.88.sslip.io'
const EVOLUTION_GLOBAL_KEY = process.env.EVOLUTION_API_KEY || 'FsaZvcT2t2Fv1pc0cmm00QsEQNkIEMSc'

// Obtener instancia del cliente
async function getClientInstance(clienteId: number) {
  const instancia = await queryOne(
    `SELECT evolution_instance, evolution_api_key FROM instancias_whatsapp
     WHERE cliente_id = $1 AND estado != 'eliminado'
     ORDER BY id LIMIT 1`,
    [clienteId]
  )

  if (instancia?.evolution_instance) {
    return {
      instance: instancia.evolution_instance,
      apiKey: instancia.evolution_api_key || EVOLUTION_GLOBAL_KEY
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!user.cliente_id) {
      return NextResponse.json({ error: 'Usuario sin cliente asignado' }, { status: 400 })
    }

    // Obtener instancia del cliente
    const clientInstance = await getClientInstance(user.cliente_id)
    if (!clientInstance) {
      return NextResponse.json({ error: 'No hay instancia de WhatsApp configurada' }, { status: 400 })
    }

    const contentType = request.headers.get('content-type') || ''

    let numero_whatsapp: string
    let mensaje: string = ''
    let mediaBase64: string | null = null
    let mediaType: string | null = null
    let fileName: string | null = null

    // Soportar FormData para archivos multimedia
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      numero_whatsapp = formData.get('numero_whatsapp') as string
      mensaje = formData.get('mensaje') as string || ''
      const file = formData.get('file') as File | null

      if (file) {
        const buffer = await file.arrayBuffer()
        mediaBase64 = Buffer.from(buffer).toString('base64')
        mediaType = file.type
        fileName = file.name
      }
    } else {
      const body = await request.json()
      numero_whatsapp = body.numero_whatsapp
      mensaje = body.mensaje || ''
      mediaBase64 = body.mediaBase64 || null
      mediaType = body.mediaType || null
      fileName = body.fileName || null
    }

    if (!numero_whatsapp) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    if (!mensaje && !mediaBase64) {
      return NextResponse.json({ error: 'Debes enviar un mensaje o un archivo' }, { status: 400 })
    }

    // Formatear número
    let numero = numero_whatsapp.replace(/\s/g, '').replace(/[^0-9+]/g, '')
    if (numero.startsWith('+')) numero = numero.substring(1)
    if (!numero.includes('@')) numero = numero + '@s.whatsapp.net'

    console.log('Enviando mensaje a:', numero, '- Instancia:', clientInstance.instance)

    let data
    let endpoint: string
    let requestBody: any

    // Determinar tipo de mensaje a enviar
    if (mediaBase64 && mediaType) {
      if (mediaType.startsWith('image/')) {
        // Enviar imagen
        endpoint = `${EVOLUTION_URL}/message/sendMedia/${clientInstance.instance}`
        requestBody = {
          number: numero,
          mediatype: 'image',
          mimetype: mediaType,
          media: mediaBase64,
          caption: mensaje || '',
          fileName: fileName || 'image.jpg'
        }
      } else if (mediaType.startsWith('audio/')) {
        // Enviar audio como nota de voz
        endpoint = `${EVOLUTION_URL}/message/sendWhatsAppAudio/${clientInstance.instance}`
        requestBody = {
          number: numero,
          audio: mediaBase64,
          encoding: true
        }
      } else if (mediaType.startsWith('video/')) {
        // Enviar video
        endpoint = `${EVOLUTION_URL}/message/sendMedia/${clientInstance.instance}`
        requestBody = {
          number: numero,
          mediatype: 'video',
          mimetype: mediaType,
          media: mediaBase64,
          caption: mensaje || '',
          fileName: fileName || 'video.mp4'
        }
      } else {
        // Enviar documento
        endpoint = `${EVOLUTION_URL}/message/sendMedia/${clientInstance.instance}`
        requestBody = {
          number: numero,
          mediatype: 'document',
          mimetype: mediaType,
          media: mediaBase64,
          caption: mensaje || '',
          fileName: fileName || 'documento'
        }
      }
    } else {
      // Enviar texto normal
      endpoint = `${EVOLUTION_URL}/message/sendText/${clientInstance.instance}`
      requestBody = {
        number: numero,
        text: mensaje
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': clientInstance.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    data = await res.json()
    console.log('Respuesta Evolution:', data)

    if (!res.ok) {
      return NextResponse.json({ error: 'Error al enviar mensaje', details: data }, { status: 500 })
    }

    // Guardar en historial con usuario_id para aislamiento por usuario
    const mensajeGuardado = mediaBase64
      ? (mediaType?.startsWith('image/') ? '[Imagen enviada]' : mediaType?.startsWith('audio/') ? '[Audio enviado]' : mediaType?.startsWith('video/') ? '[Video enviado]' : `[Archivo: ${fileName}]`) + (mensaje ? ` ${mensaje}` : '')
      : mensaje

    try {
      await query(
        `INSERT INTO historial_conversaciones (cliente_id, numero_whatsapp, mensaje, rol, usuario_id, created_at)
         VALUES ($1, $2, $3, 'assistant', $4, NOW())`,
        [user.cliente_id, numero_whatsapp.replace('@s.whatsapp.net', '').replace('+', ''), mensajeGuardado, user.id]
      )
    } catch (e) {
      console.error('Error guardando historial:', e)
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error enviar mensaje:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const numero = searchParams.get('numero')

    if (numero) {
      // Limpiar número para búsqueda
      let numBuscar = numero.replace(/\s/g, '').replace(/[^0-9]/g, '')
      if (numBuscar.startsWith('593')) numBuscar = numBuscar // ya está bien
      else if (numBuscar.startsWith('0')) numBuscar = '593' + numBuscar.substring(1)

      const mensajes = await query(
        `SELECT id, mensaje as texto, rol, created_at as fecha
         FROM historial_conversaciones
         WHERE cliente_id = $1 AND (numero_whatsapp = $2 OR numero_whatsapp = $3 OR numero_whatsapp LIKE $4)
         ORDER BY created_at ASC`,
        [user.cliente_id, numero.replace('+', ''), numBuscar, `%${numBuscar.slice(-9)}%`]
      )
      return NextResponse.json(mensajes)
    }

    return NextResponse.json([])
  } catch (error) {
    console.error('Error mensajes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
