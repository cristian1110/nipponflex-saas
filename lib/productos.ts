// Búsqueda de productos con soporte de sinónimos
import { query, queryOne } from './db'
import { expandirConsulta } from './sinonimos'

export interface ProductoEncontrado {
  id: number
  nombre: string
  descripcion: string
  precio: number
  moneda: string
  imagen_url: string | null
  video_url: string | null
  categoria: string | null
  beneficios: string | null
  relevancia: number
}

/**
 * Busca productos relevantes para una consulta
 * Usa sinónimos y búsqueda de texto completo para encontrar coincidencias
 */
export async function buscarProductos(
  consulta: string,
  clienteId: number,
  limite: number = 3
): Promise<ProductoEncontrado[]> {

  // 1. Expandir consulta con sinónimos (usando IA)
  const terminosBusqueda = await expandirConsulta(consulta)
  console.log(`[Productos] Buscando: "${consulta}" -> Términos expandidos: ${terminosBusqueda.join(', ')}`)

  // 2. Construir condiciones de búsqueda para cada término
  const condiciones: string[] = []
  const params: any[] = [clienteId]

  terminosBusqueda.forEach((termino, index) => {
    const paramIndex = index + 2
    params.push(`%${termino}%`)
    condiciones.push(`
      nombre ILIKE $${paramIndex} OR
      sinonimos ILIKE $${paramIndex} OR
      palabras_clave ILIKE $${paramIndex} OR
      descripcion ILIKE $${paramIndex} OR
      categoria ILIKE $${paramIndex}
    `)
  })

  // 3. Ejecutar búsqueda
  const sql = `
    SELECT
      id, nombre, descripcion, precio, moneda, imagen_url, video_url,
      categoria, beneficios,
      (
        CASE WHEN nombre ILIKE $2 THEN 100
             WHEN sinonimos ILIKE $2 THEN 80
             WHEN palabras_clave ILIKE $2 THEN 60
             WHEN descripcion ILIKE $2 THEN 40
             ELSE 20
        END
      ) as relevancia
    FROM productos
    WHERE cliente_id = $1
      AND activo = true
      AND (${condiciones.join(' OR ')})
    ORDER BY relevancia DESC, nombre
    LIMIT $${params.length + 1}
  `
  params.push(limite)

  try {
    const productos = await query(sql, params)

    if (productos.length > 0) {
      console.log(`[Productos] Encontrados ${productos.length} productos para "${consulta}"`)
    }

    return productos.map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precio: parseFloat(p.precio) || 0,
      moneda: p.moneda || 'USD',
      imagen_url: p.imagen_url,
      video_url: p.video_url,
      categoria: p.categoria,
      beneficios: p.beneficios,
      relevancia: p.relevancia / 100,
    }))
  } catch (error) {
    console.error('Error buscando productos:', error)
    return []
  }
}

/**
 * Obtiene un producto por ID
 */
export async function obtenerProducto(
  productoId: number,
  clienteId: number
): Promise<ProductoEncontrado | null> {
  const producto = await queryOne(
    `SELECT id, nombre, descripcion, precio, moneda, imagen_url, video_url,
            categoria, beneficios
     FROM productos
     WHERE id = $1 AND cliente_id = $2 AND activo = true`,
    [productoId, clienteId]
  )

  if (!producto) return null

  return {
    id: producto.id,
    nombre: producto.nombre,
    descripcion: producto.descripcion || '',
    precio: parseFloat(producto.precio) || 0,
    moneda: producto.moneda || 'USD',
    imagen_url: producto.imagen_url,
    video_url: producto.video_url,
    categoria: producto.categoria,
    beneficios: producto.beneficios,
    relevancia: 1,
  }
}

/**
 * Formatea información de producto para incluir en respuesta de IA
 */
export function formatearProductoParaIA(producto: ProductoEncontrado): string {
  let info = `**${producto.nombre}**`

  if (producto.precio > 0) {
    info += ` - Precio: ${producto.moneda} ${producto.precio.toFixed(2)}`
  }

  if (producto.descripcion) {
    info += `\n${producto.descripcion}`
  }

  if (producto.beneficios) {
    info += `\nBeneficios: ${producto.beneficios}`
  }

  return info
}

/**
 * Detecta si un mensaje del usuario está preguntando por un producto
 */
export function detectarConsultaProducto(mensaje: string): boolean {
  const patronesProducto = [
    /\b(precio|costo|cuanto|cuánto|vale|cuesta)\b/i,
    /\b(tienen|tienes|venden|hay)\b/i,
    /\b(producto|articulo|artículo)\b/i,
    /\b(comprar|adquirir|pedir)\b/i,
    /\b(info|información|informacion|detalles)\s+(de|del|sobre)\b/i,
    /\b(muéstrame|muestrame|enseñame|enséñame|ver)\b/i,
    /\b(imagen|foto|video|ver)\b/i,
  ]

  return patronesProducto.some(patron => patron.test(mensaje))
}
