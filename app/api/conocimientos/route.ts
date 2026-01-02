import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

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
        contenidoTexto = buffer.toString('utf-8')
      } else if (extension === 'xlsx' || extension === 'xls') {
        const XLSX = require('xlsx')
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        workbook.SheetNames.forEach((sheetName: string) => {
          const sheet = workbook.Sheets[sheetName]
          contenidoTexto += XLSX.utils.sheet_to_txt(sheet) + '\n\n'
        })
      } else {
        // Para PDF y DOCX, guardar sin extraer por ahora
        contenidoTexto = `[Archivo ${extension.toUpperCase()} - Extracción pendiente]`
      }
    } catch (e) {
      console.error('Error extrayendo texto:', e)
      contenidoTexto = '[Error al extraer texto del archivo]'
    }

    // Crear chunks del contenido
    const chunks = crearChunks(contenidoTexto, 500)

    // Guardar en BD
    const conocimiento = await queryOne(
      `INSERT INTO conocimientos (cliente_id, agente_id, nombre_archivo, nombre_original, tipo_archivo, tamano_bytes, contenido_texto, total_chunks, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'listo')
       RETURNING *`,
      [user.cliente_id, agente_id, file.name, file.name, extension, file.size, contenidoTexto, chunks.length]
    )

    // Guardar chunks
    for (let i = 0; i < chunks.length; i++) {
      await query(
        `INSERT INTO conocimientos_chunks (conocimiento_id, chunk_index, contenido, tokens)
         VALUES ($1, $2, $3, $4)`,
        [conocimiento.id, i, chunks[i], chunks[i].split(' ').length]
      )
    }

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

    // Eliminar chunks primero (por CASCADE debería ser automático, pero por si acaso)
    await query(`DELETE FROM conocimientos_chunks WHERE conocimiento_id = $1`, [id])
    
    // Eliminar conocimiento
    await query(`DELETE FROM conocimientos WHERE id = $1`, [id])

    return NextResponse.json({ success: true, message: 'Archivo eliminado correctamente' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Función para crear chunks de texto
function crearChunks(texto: string, tamanoChunk: number = 500): string[] {
  if (!texto || texto.length === 0) return []
  
  const palabras = texto.split(/\s+/)
  const chunks: string[] = []
  let chunkActual: string[] = []
  
  for (const palabra of palabras) {
    chunkActual.push(palabra)
    if (chunkActual.length >= tamanoChunk) {
      chunks.push(chunkActual.join(' '))
      // Overlap de 50 palabras
      chunkActual = chunkActual.slice(-50)
    }
  }
  
  if (chunkActual.length > 0) {
    chunks.push(chunkActual.join(' '))
  }
  
  return chunks
}
