// RAG (Retrieval-Augmented Generation) para NipponFlex
// Integra Qdrant + Embeddings para búsqueda semántica de conocimientos
// + Búsqueda de productos con sinónimos

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
import { buscarProductos, ProductoEncontrado, formatearProductoParaIA, detectarConsultaProducto } from './productos'
import { queryOne } from './db'

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
// BÚSQUEDA COMBINADA (Conocimientos + Productos)
// ============================================

export interface ResultadoBusquedaCompleta {
  contextos: ContextoRelevante[]
  productos: ProductoEncontrado[]
  tieneProductos: boolean
}

/**
 * Busca información relevante tanto en conocimientos (Qdrant) como en productos (PostgreSQL)
 * Expande la búsqueda usando sinónimos para productos
 */
export async function buscarContextoCompleto(
  pregunta: string,
  agenteId: number,
  clienteId: number,
  maxResultados: number = 3
): Promise<ResultadoBusquedaCompleta> {
  // 1. Buscar en conocimientos (Qdrant)
  const contextos = await buscarContextoRelevante(pregunta, agenteId, maxResultados, 0.2)

  // 2. Detectar si es una consulta de productos y buscar en catálogo
  let productos: ProductoEncontrado[] = []
  const esConsultaProducto = detectarConsultaProducto(pregunta)

  if (esConsultaProducto) {
    console.log(`[RAG] Detectada consulta de producto: "${pregunta}"`)
    productos = await buscarProductos(pregunta, clienteId, 3)
  } else {
    // Aún si no detectamos explícitamente, buscar por si acaso
    // pero con menor prioridad (solo si no hay contextos)
    if (contextos.length === 0) {
      productos = await buscarProductos(pregunta, clienteId, 2)
    }
  }

  return {
    contextos,
    productos,
    tieneProductos: productos.length > 0
  }
}

/**
 * Obtiene el cliente_id desde el agente
 */
export async function obtenerClienteIdDeAgente(agenteId: number): Promise<number | null> {
  try {
    // Buscar en configuracion_agente primero
    let resultado = await queryOne(
      `SELECT cliente_id FROM configuracion_agente WHERE id = $1`,
      [agenteId]
    )

    if (resultado) return resultado.cliente_id

    // Buscar en agentes
    resultado = await queryOne(
      `SELECT cliente_id FROM agentes WHERE id = $1`,
      [agenteId]
    )

    return resultado?.cliente_id || null
  } catch (error) {
    console.error('Error obteniendo cliente_id:', error)
    return null
  }
}

// ============================================
// CONSTRUCCIÓN DE PROMPT CON RAG
// ============================================

export interface OpcionesPrompt {
  sentimiento?: {
    tipo: string
    sugerencia: string
  }
  // Modo audio: respuestas más cortas y sin caracteres especiales
  modoAudio?: boolean
  // Productos encontrados del catálogo
  productos?: ProductoEncontrado[]
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

  // Agregar productos del catálogo si existen
  if (opciones?.productos && opciones.productos.length > 0) {
    prompt += '\n\n## Productos del Catálogo\n'
    prompt += 'Estos son los productos relevantes que puedes ofrecer al cliente:\n\n'

    for (const prod of opciones.productos) {
      prompt += `### ${prod.nombre}\n`
      if (prod.precio > 0) {
        prompt += `**Precio:** ${prod.moneda} ${prod.precio.toFixed(2)}\n`
      }
      if (prod.descripcion) {
        prompt += `**Descripción:** ${prod.descripcion}\n`
      }
      if (prod.beneficios) {
        prompt += `**Beneficios:** ${prod.beneficios}\n`
      }
      if (prod.imagen_url) {
        prompt += `**Imagen disponible:** [IMAGEN:${prod.imagen_url}]\n`
      }
      if (prod.video_url) {
        prompt += `**Video disponible:** [VIDEO:${prod.video_url}]\n`
      }
      prompt += '\n'
    }

    prompt += `INSTRUCCIONES PARA PRODUCTOS:
- Si el cliente pregunta por un producto y tienes imagen/video, INCLUYE el marcador [IMAGEN:url] o [VIDEO:url] en tu respuesta
- El sistema detectará estos marcadores y enviará el multimedia automáticamente
- Menciona el precio si el cliente lo pregunta
- Puedes recomendar productos relacionados si es apropiado
`
  }

  // Agregar instrucciones de sentimiento si existen
  if (opciones?.sentimiento) {
    prompt += `\n## Estado Emocional del Usuario
El usuario parece estar: ${opciones.sentimiento.tipo}
Sugerencia de respuesta: ${opciones.sentimiento.sugerencia}
`
  }

  // Instrucciones especiales para modo audio
  if (opciones?.modoAudio) {
    prompt += `\n## IMPORTANTE: Respuesta para Audio
Tu respuesta será convertida a audio de voz. DEBES seguir estas reglas estrictamente:

1. LONGITUD: Máximo 2-3 oraciones cortas. No más de 80 palabras total.
2. FRASES COMPLETAS: Cada oración debe tener sentido por sí sola. Nunca dejes frases incompletas.
3. FORMATO LIMPIO:
   - NO uses markdown (*, **, _, #, etc.)
   - NO uses emojis
   - NO uses listas con viñetas o números
   - NO incluyas URLs
   - Solo texto plano en español
4. ESTILO HABLADO: Escribe como si estuvieras hablando, no escribiendo.
5. PUNTUACIÓN: Usa puntos para separar ideas. Termina siempre con punto, signo de interrogación o exclamación.
6. SI HAY MÁS INFO: Di "¿Te cuento más?" o "¿Quieres que te explique más?" al final.

Ejemplo de respuesta correcta:
"El Kit Básico incluye el brazalete y el squeeze. Tiene un precio de ciento cincuenta dólares. ¿Te gustaría saber más sobre los beneficios?"

Ejemplo de respuesta INCORRECTA (muy larga):
"El Kit Básico de Nipponflex es un conjunto completo que incluye varios productos como el Alcaline Squeeze que es un dispositivo para..." (esto se cortaría)
`
  }

  // Agregar instrucciones generales
  prompt += `\n## Instrucciones de Comportamiento
- Responde siempre en español
- Sé conciso y directo${opciones?.modoAudio ? ' (MÁXIMO 2-3 oraciones para audio)' : ' (máximo 2-3 párrafos para WhatsApp)'}
- Si la información de la base de conocimiento es relevante, úsala
- Si no sabes algo, dilo honestamente
- No inventes información
- Comportate como un humano real, cálido y cercano
- Usa un tono conversacional y amigable, como si hablaras con un amigo
- Puedes usar expresiones como "Claro", "Por supuesto", "Con gusto"
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
