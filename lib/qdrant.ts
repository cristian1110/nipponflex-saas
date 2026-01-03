import { QdrantClient } from '@qdrant/js-client-rest'

const QDRANT_URL = process.env.QDRANT_URL || 'http://qdrant-igogc4kw8kow4cssgos0g8gs:6333'
const QDRANT_API_KEY = process.env.QDRANT_API_KEY
const QDRANT_ENABLED = process.env.QDRANT_ENABLED !== 'false'
const COLLECTION_NAME = 'conocimientos'
const VECTOR_SIZE = 768 // Jina embeddings v2 size

let qdrantClient: QdrantClient | null = null

export function getQdrant(): QdrantClient | null {
  if (!QDRANT_ENABLED) return null

  if (!qdrantClient) {
    try {
      qdrantClient = new QdrantClient({
        url: QDRANT_URL,
        apiKey: QDRANT_API_KEY,
      })
    } catch (error) {
      console.error('Error creando cliente Qdrant:', error)
      return null
    }
  }
  return qdrantClient
}

// ============================================
// INICIALIZACIÓN DE COLECCIÓN
// ============================================

export async function initQdrantCollection(): Promise<boolean> {
  const client = getQdrant()
  if (!client) return false

  try {
    // Verificar si la colección existe
    const collections = await client.getCollections()
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME)

    if (!exists) {
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      })

      // Crear índices para filtrado rápido
      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'cliente_id',
        field_schema: 'integer',
      })

      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'agente_id',
        field_schema: 'integer',
      })

      console.log('Colección Qdrant creada:', COLLECTION_NAME)
    }

    return true
  } catch (error) {
    console.error('Error inicializando Qdrant:', error)
    return false
  }
}

// ============================================
// OPERACIONES CRUD
// ============================================

export interface ChunkPayload {
  cliente_id: number
  agente_id: number
  conocimiento_id: number
  nombre_archivo: string
  chunk_index: number
  texto: string
}

export async function upsertChunks(
  chunks: { id: string; vector: number[]; payload: ChunkPayload }[]
): Promise<boolean> {
  const client = getQdrant()
  if (!client || chunks.length === 0) return false

  try {
    await client.upsert(COLLECTION_NAME, {
      wait: true,
      points: chunks.map(chunk => ({
        id: chunk.id,
        vector: chunk.vector,
        payload: chunk.payload,
      })),
    })
    return true
  } catch (error) {
    console.error('Error insertando chunks en Qdrant:', error)
    return false
  }
}

export async function deleteByConocimientoId(conocimientoId: number): Promise<boolean> {
  const client = getQdrant()
  if (!client) return false

  try {
    await client.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [
          { key: 'conocimiento_id', match: { value: conocimientoId } }
        ]
      }
    })
    return true
  } catch (error) {
    console.error('Error eliminando chunks de Qdrant:', error)
    return false
  }
}

export async function deleteByAgenteId(agenteId: number): Promise<boolean> {
  const client = getQdrant()
  if (!client) return false

  try {
    await client.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [
          { key: 'agente_id', match: { value: agenteId } }
        ]
      }
    })
    return true
  } catch (error) {
    console.error('Error eliminando chunks de agente:', error)
    return false
  }
}

// ============================================
// BÚSQUEDA SEMÁNTICA
// ============================================

export interface SearchResult {
  texto: string
  nombre_archivo: string
  score: number
  conocimiento_id: number
}

export async function searchSimilar(
  queryVector: number[],
  agenteId: number,
  limit: number = 5,
  scoreThreshold: number = 0.5
): Promise<SearchResult[]> {
  const client = getQdrant()
  if (!client) return []

  try {
    const results = await client.search(COLLECTION_NAME, {
      vector: queryVector,
      filter: {
        must: [
          { key: 'agente_id', match: { value: agenteId } }
        ]
      },
      limit,
      score_threshold: scoreThreshold,
      with_payload: true,
    })

    return results.map(r => ({
      texto: (r.payload as ChunkPayload).texto,
      nombre_archivo: (r.payload as ChunkPayload).nombre_archivo,
      score: r.score,
      conocimiento_id: (r.payload as ChunkPayload).conocimiento_id,
    }))
  } catch (error) {
    console.error('Error buscando en Qdrant:', error)
    return []
  }
}

// ============================================
// ESTADÍSTICAS
// ============================================

export async function getCollectionStats() {
  const client = getQdrant()
  if (!client) return null

  try {
    const info = await client.getCollection(COLLECTION_NAME)
    return {
      vectors_count: info.vectors_count,
      points_count: info.points_count,
      status: info.status,
    }
  } catch (error) {
    return null
  }
}

// ============================================
// HEALTH CHECK
// ============================================

export async function qdrantHealthCheck(): Promise<boolean> {
  const client = getQdrant()
  if (!client) return false

  try {
    await client.getCollections()
    return true
  } catch {
    return false
  }
}
