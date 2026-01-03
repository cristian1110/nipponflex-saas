// Servicio de embeddings para búsqueda semántica
// Usa Jina AI embeddings (gratis) o HuggingFace como fallback

const JINA_API_URL = 'https://api.jina.ai/v1/embeddings'
const HF_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2'

// Tamaño del vector según el modelo
export const VECTOR_SIZE = 768 // Jina v2 base
const CHUNK_SIZE = 500 // Caracteres por chunk
const CHUNK_OVERLAP = 50 // Superposición entre chunks

// ============================================
// GENERACIÓN DE EMBEDDINGS
// ============================================

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const jinaKey = process.env.JINA_API_KEY
  const hfKey = process.env.HF_API_KEY

  // Intentar con Jina AI primero
  if (jinaKey) {
    try {
      const response = await fetch(JINA_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jinaKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v2-base-es', // Modelo optimizado para español
          input: [text.slice(0, 8000)], // Límite de tokens
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.data?.[0]?.embedding || null
      }
    } catch (error) {
      console.error('Error con Jina AI:', error)
    }
  }

  // Fallback a HuggingFace
  if (hfKey) {
    try {
      const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text.slice(0, 512), // Límite del modelo
          options: { wait_for_model: true },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // HF devuelve array de arrays, promediamos
        if (Array.isArray(data) && data.length > 0) {
          if (Array.isArray(data[0])) {
            // Promedio de todos los tokens
            const numTokens = data.length
            const dim = data[0].length
            const avg = new Array(dim).fill(0)
            for (const token of data) {
              for (let i = 0; i < dim; i++) {
                avg[i] += token[i] / numTokens
              }
            }
            // Pad o truncar a VECTOR_SIZE
            return padVector(avg, VECTOR_SIZE)
          }
          return padVector(data, VECTOR_SIZE)
        }
      }
    } catch (error) {
      console.error('Error con HuggingFace:', error)
    }
  }

  // Sin API keys, usar embeddings simples basados en hash
  console.warn('Sin API de embeddings, usando fallback local')
  return generateSimpleEmbedding(text)
}

// Genera embeddings batch (más eficiente)
export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const jinaKey = process.env.JINA_API_KEY

  // Batch con Jina AI
  if (jinaKey && texts.length > 0) {
    try {
      const response = await fetch(JINA_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jinaKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v2-base-es',
          input: texts.map(t => t.slice(0, 8000)),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.data?.map((d: any) => d.embedding) || texts.map(() => null)
      }
    } catch (error) {
      console.error('Error batch Jina AI:', error)
    }
  }

  // Fallback individual
  const results: (number[] | null)[] = []
  for (const text of texts) {
    results.push(await generateEmbedding(text))
  }
  return results
}

// ============================================
// CHUNKING DE TEXTO
// ============================================

export interface TextChunk {
  texto: string
  index: number
}

export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): TextChunk[] {
  const chunks: TextChunk[] = []

  // Limpiar texto
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (cleanText.length <= chunkSize) {
    return [{ texto: cleanText, index: 0 }]
  }

  // Dividir por párrafos primero
  const paragraphs = cleanText.split(/\n\n+/)
  let currentChunk = ''
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    // Si el párrafo solo es muy grande, dividirlo por oraciones
    if (paragraph.length > chunkSize) {
      // Guardar chunk actual si existe
      if (currentChunk.trim()) {
        chunks.push({ texto: currentChunk.trim(), index: chunkIndex++ })
        currentChunk = ''
      }

      // Dividir párrafo grande por oraciones
      const sentences = paragraph.split(/(?<=[.!?])\s+/)
      let subChunk = ''

      for (const sentence of sentences) {
        if ((subChunk + ' ' + sentence).length > chunkSize) {
          if (subChunk.trim()) {
            chunks.push({ texto: subChunk.trim(), index: chunkIndex++ })
          }
          subChunk = sentence
        } else {
          subChunk = subChunk ? subChunk + ' ' + sentence : sentence
        }
      }

      if (subChunk.trim()) {
        currentChunk = subChunk
      }
    } else {
      // Párrafo normal, intentar agregar al chunk actual
      if ((currentChunk + '\n\n' + paragraph).length > chunkSize) {
        if (currentChunk.trim()) {
          chunks.push({ texto: currentChunk.trim(), index: chunkIndex++ })
        }
        currentChunk = paragraph
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph
      }
    }
  }

  // Último chunk
  if (currentChunk.trim()) {
    chunks.push({ texto: currentChunk.trim(), index: chunkIndex })
  }

  return chunks
}

// ============================================
// HELPERS
// ============================================

function padVector(vector: number[], targetSize: number): number[] {
  if (vector.length === targetSize) return vector
  if (vector.length > targetSize) return vector.slice(0, targetSize)
  return [...vector, ...new Array(targetSize - vector.length).fill(0)]
}

// Embedding simple basado en hash (fallback cuando no hay API)
function generateSimpleEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const vector = new Array(VECTOR_SIZE).fill(0)

  for (const word of words) {
    // Hash simple de cada palabra
    let hash = 0
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i)
      hash |= 0
    }

    // Distribuir el hash en el vector
    const index = Math.abs(hash) % VECTOR_SIZE
    vector[index] += 1
  }

  // Normalizar
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude
    }
  }

  return vector
}

// ============================================
// UTILIDADES PARA BÚSQUEDA
// ============================================

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}
