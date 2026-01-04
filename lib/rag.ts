// RAG (Retrieval-Augmented Generation) para NipponFlex
// Integra Qdrant + Embeddings para búsqueda semántica de conocimientos

import { generateEmbedding, generateEmbeddings, chunkText } from './embeddings'
import {
  initQdrantCollection,
  upsertChunks,
  deleteByConocimientoId,
  searchSimilar,
  getCollectionStats,
  qdrantHealthCheck,
  ChunkPayload
} from './qdrant'
import { v4 as uuidv4 } from 'uuid'

// ============================================
// INDEXACIÓN DE CONOCIMIENTOS
// ============================================

interface IndexarParams {
  id: number
  clienteId: number
  agenteId: number
  nombreArchivo: string
  contenido: string
}

export async function indexarConocimiento(params: IndexarParams): Promise<boolean> {
  const { id, clienteId, agenteId, nombreArchivo, contenido } = params

  // Inicializar colección si no existe
  await initQdrantCollection()

  // Dividir contenido en chunks
  const chunks = chunkText(contenido)

  if (chunks.length === 0) {
    console.log('No hay contenido para indexar:', nombreArchivo)
    return false
  }

  console.log(`Indexando ${chunks.length} chunks de "${nombreArchivo}"`)

  // Generar embeddings en batch
  const textos = chunks.map(c => c.texto)
  const embeddings = await generateEmbeddings(textos)

  // Preparar puntos para Qdrant
  const points: { id: string; vector: number[]; payload: ChunkPayload }[] = []

  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i]
    if (!embedding) continue

    points.push({
      id: uuidv4(), // UUID único para cada chunk
      vector: embedding,
      payload: {
        cliente_id: clienteId,
        agente_id: agenteId,
        conocimiento_id: id,
        nombre_archivo: nombreArchivo,
        chunk_index: chunks[i].index,
        texto: chunks[i].texto,
      },
    })
  }

  if (points.length === 0) {
    console.error('No se pudieron generar embeddings')
    return false
  }

  // Insertar en Qdrant
  const success = await upsertChunks(points)

  if (success) {
    console.log(`Indexados ${points.length} chunks de "${nombreArchivo}"`)
  }

  return success
}

export async function eliminarConocimientoDeQdrant(conocimientoId: number): Promise<boolean> {
  return deleteByConocimientoId(conocimientoId)
}

// ============================================
// BÚSQUEDA SEMÁNTICA
// ============================================

export interface ContextoRelevante {
  texto: string
  fuente: string
  relevancia: number
}

export async function buscarContextoRelevante(
  pregunta: string,
  agenteId: number,
  maxResultados: number = 3,
  umbralRelevancia: number = 0.4
): Promise<ContextoRelevante[]> {
  // Generar embedding de la pregunta
  const queryVector = await generateEmbedding(pregunta)

  if (!queryVector) {
    console.error('No se pudo generar embedding de la pregunta')
    return []
  }

  // Buscar en Qdrant
  const resultados = await searchSimilar(queryVector, agenteId, maxResultados, umbralRelevancia)

  return resultados.map(r => ({
    texto: r.texto,
    fuente: r.nombre_archivo,
    relevancia: r.score,
  }))
}

// ============================================
// CONSTRUCCIÓN DE PROMPT CON RAG
// ============================================

export interface OpcionesPrompt {
  sentimiento?: {
    tipo: string
    sugerencia: string
  }
}

export function construirPromptConRAG(
  promptBase: string,
  contextos: ContextoRelevante[],
  nombreAgente: string = 'Asistente',
  opciones?: OpcionesPrompt
): string {
  let prompt = `## Tu Identidad
Eres ${nombreAgente}, un asistente virtual amigable y profesional.
IMPORTANTE: Cuando alguien te pregunte cómo te llamas, tu nombre, o quién eres, SIEMPRE responde que te llamas "${nombreAgente}".

${promptBase}`

  // Agregar contexto relevante si existe
  if (contextos.length > 0) {
    prompt += '\n\n## Información Relevante de la Base de Conocimiento\n'
    prompt += 'Usa la siguiente información para responder. Cita la fuente si es relevante:\n\n'

    for (const ctx of contextos) {
      prompt += `### De "${ctx.fuente}" (relevancia: ${Math.round(ctx.relevancia * 100)}%)\n`
      prompt += ctx.texto + '\n\n'
    }
  }

  // Agregar instrucciones de sentimiento si existen
  if (opciones?.sentimiento) {
    prompt += `\n## Estado Emocional del Usuario
El usuario parece estar: ${opciones.sentimiento.tipo}
Sugerencia de respuesta: ${opciones.sentimiento.sugerencia}
`
  }

  // Agregar instrucciones generales
  prompt += `\n## Instrucciones de Comportamiento
- Responde siempre en español
- Sé conciso y directo (máximo 2-3 párrafos para WhatsApp)
- Si la información de la base de conocimiento es relevante, úsala
- Si no sabes algo, dilo honestamente
- No inventes información
- Comportate como un humano real, cálido y cercano
- Usa un tono conversacional y amigable, como si hablaras con un amigo
- Puedes usar expresiones como "¡Claro!", "Por supuesto", "Con gusto"
- Si el usuario está frustrado, muestra empatía genuina
- Tu nombre es ${nombreAgente} - úsalo cuando te presentes o te pregunten`

  return prompt
}

// ============================================
// MIGRACIÓN DE CONOCIMIENTOS EXISTENTES
// ============================================

export async function migrarConocimientosExistentes(
  conocimientos: { id: number; cliente_id: number; agente_id: number; nombre_archivo: string; contenido_texto: string }[]
): Promise<{ exitosos: number; fallidos: number }> {
  let exitosos = 0
  let fallidos = 0

  for (const c of conocimientos) {
    if (!c.contenido_texto || c.contenido_texto.startsWith('[')) {
      // Saltar archivos sin contenido o con errores
      continue
    }

    const success = await indexarConocimiento({
      id: c.id,
      clienteId: c.cliente_id,
      agenteId: c.agente_id,
      nombreArchivo: c.nombre_archivo,
      contenido: c.contenido_texto,
    })

    if (success) {
      exitosos++
    } else {
      fallidos++
    }

    // Pequeña pausa para no saturar APIs
    await new Promise(r => setTimeout(r, 100))
  }

  return { exitosos, fallidos }
}

// ============================================
// ESTADÍSTICAS Y HEALTH
// ============================================

export async function ragHealthCheck(): Promise<boolean> {
  return qdrantHealthCheck()
}

export async function ragStats() {
  return getCollectionStats()
}
