// Generador de sinónimos con IA para productos
// Usa Groq para generar sinónimos y términos relacionados

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Genera sinónimos y términos relacionados para un producto usando IA
 * Esto permite que el agente encuentre productos aunque el cliente use palabras diferentes
 */
export async function generarSinonimosProducto(
  nombre: string,
  categoria?: string,
  descripcion?: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    console.error('GROQ_API_KEY no configurada')
    return ''
  }

  const prompt = `Genera una lista de sinónimos, términos alternativos y palabras relacionadas para el siguiente producto.
El objetivo es que cuando un cliente busque usando palabras diferentes, pueda encontrar este producto.

Producto: ${nombre}
${categoria ? `Categoría: ${categoria}` : ''}
${descripcion ? `Descripción: ${descripcion}` : ''}

Instrucciones:
1. Incluye sinónimos directos del nombre
2. Incluye variaciones regionales (ej: manilla/pulsera/brazalete)
3. Incluye términos coloquiales que la gente usa
4. Incluye abreviaciones comunes
5. Incluye palabras relacionadas con su función/uso
6. NO incluyas el nombre original
7. Responde SOLO con las palabras separadas por comas, sin explicaciones
8. Máximo 15 términos

Ejemplo para "Pulsera Magnética":
manilla, brazalete, muñequera, pulsera terapéutica, brazalete magnético, accesorio magnético, pulsera de imanes, banda magnética, pulsera para circulación

Ahora genera los sinónimos:`

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      console.error('Error Groq:', response.status)
      return ''
    }

    const data = await response.json()
    const sinonimos = data.choices?.[0]?.message?.content?.trim() || ''

    // Limpiar respuesta (quitar puntos, saltos de línea, etc.)
    const sinonimosLimpios = sinonimos
      .replace(/\n/g, ', ')
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim()

    return sinonimosLimpios
  } catch (error) {
    console.error('Error generando sinónimos:', error)
    return ''
  }
}

/**
 * Expande una consulta de búsqueda con posibles sinónimos
 * Útil para mejorar la búsqueda cuando el cliente usa términos diferentes
 */
export async function expandirConsulta(consulta: string): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    return [consulta]
  }

  const prompt = `El usuario está buscando un producto con esta consulta: "${consulta}"

Genera 3-5 términos alternativos o sinónimos que podrían referirse al mismo producto.
Responde SOLO con los términos separados por comas, sin incluir la consulta original.

Ejemplo:
Consulta: "manilla"
Respuesta: pulsera, brazalete, muñequera

Ahora genera los términos:`

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
    })

    if (!response.ok) {
      return [consulta]
    }

    const data = await response.json()
    const terminos = data.choices?.[0]?.message?.content?.trim() || ''

    // Convertir a array y agregar consulta original
    const terminosArray = terminos
      .split(',')
      .map((t: string) => t.trim().toLowerCase())
      .filter((t: string) => t.length > 0)

    return [consulta, ...terminosArray]
  } catch (error) {
    console.error('Error expandiendo consulta:', error)
    return [consulta]
  }
}
