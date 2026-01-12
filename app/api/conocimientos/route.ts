import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { indexarConocimiento, eliminarConocimientoDeQdrant } from '@/lib/rag'

export const dynamic = 'force-dynamic'

// GET - Listar conocimientos de un agente
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const agente_id = searchParams.get('agente_id')

    let conocimientos
    if (agente_id) {
      conocimientos = await query(
        `SELECT * FROM conocimientos WHERE agente_id = $1 AND activo = true ORDER BY created_at DESC`,
        [agente_id]
      )
    } else {
      conocimientos = await query(
        `SELECT c.*, ca.nombre_agente 
         FROM conocimientos c
         LEFT JOIN configuracion_agente ca ON c.agente_id = ca.id
         WHERE c.cliente_id = $1 AND c.activo = true 
         ORDER BY c.created_at DESC`,
        [user.cliente_id]
      )
    }

    return NextResponse.json(conocimientos)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Subir nuevo conocimiento
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const agente_id = formData.get('agente_id') as string

    if (!file || !agente_id) {
      return NextResponse.json({ error: 'Archivo y agente_id son requeridos' }, { status: 400 })
    }

    // Verificar límites del plan
    const limites = await queryOne(
      `SELECT p.max_archivos_conocimiento, p.max_tamano_archivo_mb,
              (SELECT COUNT(*) FROM conocimientos WHERE agente_id = $1 AND activo = true) as archivos_actuales
       FROM clientes c
       JOIN planes p ON c.plan_id = p.id
       WHERE c.id = $2`,
      [agente_id, user.cliente_id]
    )

    if (limites) {
      if (parseInt(limites.archivos_actuales) >= limites.max_archivos_conocimiento) {
        return NextResponse.json({ 
          error: `Has alcanzado el límite de ${limites.max_archivos_conocimiento} archivos` 
        }, { status: 400 })
      }

      const maxBytes = limites.max_tamano_archivo_mb * 1024 * 1024
      if (file.size > maxBytes) {
        return NextResponse.json({ 
          error: `El archivo excede el límite de ${limites.max_tamano_archivo_mb}MB` 
        }, { status: 400 })
      }
    }

    // Determinar tipo de archivo
    const extension = file.name.split('.').pop()?.toLowerCase()
    const tiposPermitidos = ['pdf', 'docx', 'xlsx', 'xls', 'txt', 'csv']
    if (!extension || !tiposPermitidos.includes(extension)) {
      return NextResponse.json({ 
        error: 'Tipo de archivo no permitido. Usa: PDF, Word, Excel o TXT' 
      }, { status: 400 })
    }

    // Leer contenido del archivo
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let contenidoTexto = ''

    try {
      if (extension === 'txt' || extension === 'csv') {
        // Archivos de texto plano
        contenidoTexto = buffer.toString('utf-8')
      } else if (extension === 'xlsx' || extension === 'xls') {
        // Archivos Excel
        const XLSX = require('xlsx')
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        workbook.SheetNames.forEach((sheetName: string) => {
          const sheet = workbook.Sheets[sheetName]
          contenidoTexto += `=== Hoja: ${sheetName} ===\n`
          contenidoTexto += XLSX.utils.sheet_to_txt(sheet) + '\n\n'
        })
      } else if (extension === 'pdf') {
        // Archivos PDF usando pdfjs-dist (más robusto para servidor)
        try {
          const pdfjs = require('pdfjs-dist/legacy/build/pdf.js')
          const data = new Uint8Array(buffer)
          const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true })
          const pdf = await loadingTask.promise

          let textoCompleto = ''
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items
              .map((item: { str?: string }) => item.str || '')
              .join(' ')
            textoCompleto += pageText + '\n'
          }

          contenidoTexto = textoCompleto.trim()
          if (!contenidoTexto) {
            contenidoTexto = '[PDF sin texto extraíble - posiblemente escaneado]'
          }
        } catch (pdfError) {
          console.error('Error extrayendo PDF:', pdfError)
          contenidoTexto = '[Error al extraer texto del PDF]'
        }
      } else if (extension === 'docx') {
        // Archivos Word
        const mammoth = require('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        contenidoTexto = result.value || ''
        if (!contenidoTexto.trim()) {
          contenidoTexto = '[Documento Word vacío o sin texto]'
        }
      } else {
        contenidoTexto = `[Formato ${extension.toUpperCase()} no soportado para extracción]`
      }

      // Limpiar texto extraído
      contenidoTexto = contenidoTexto
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    } catch (e) {
      console.error('Error extrayendo texto:', e)
      contenidoTexto = `[Error al extraer texto del archivo: ${e instanceof Error ? e.message : 'desconocido'}]`
    }

    // Guardar en BD
    const conocimiento = await queryOne(
      `INSERT INTO conocimientos (cliente_id, agente_id, nombre_archivo, tipo, contenido_texto, tamano_bytes, estado, activo)
       VALUES ($1, $2, $3, $4, $5, $6, 'procesando', true)
       RETURNING *`,
      [user.cliente_id, agente_id, file.name, extension, contenidoTexto, file.size]
    )

    console.log('Conocimiento guardado:', conocimiento?.id, '- Texto:', contenidoTexto.substring(0, 100) + '...')

    // Indexar en Qdrant para búsqueda semántica (async, no bloquea)
    indexarConocimiento({
      id: conocimiento.id,
      clienteId: user.cliente_id,
      agenteId: parseInt(agente_id),
      nombreArchivo: file.name,
      contenido: contenidoTexto,
    }).then(async (success) => {
      // Actualizar estado en BD
      await query(
        `UPDATE conocimientos SET estado = $1 WHERE id = $2`,
        [success ? 'listo' : 'error_indexacion', conocimiento.id]
      )
    }).catch(console.error)

    return NextResponse.json(conocimiento, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Eliminar conocimiento
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Verificar que pertenece al cliente
    const conocimiento = await queryOne(
      `SELECT * FROM conocimientos WHERE id = $1 AND cliente_id = $2`,
      [id, user.cliente_id]
    )

    if (!conocimiento) {
      return NextResponse.json({ error: 'Conocimiento no encontrado' }, { status: 404 })
    }

    // Eliminar de Qdrant primero
    await eliminarConocimientoDeQdrant(parseInt(id))

    // Eliminar conocimiento de BD
    await query(`DELETE FROM conocimientos WHERE id = $1`, [id])

    return NextResponse.json({ success: true, message: 'Archivo eliminado correctamente' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
