import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { generarSinonimosProducto } from '@/lib/sinonimos'

export const dynamic = 'force-dynamic'

// GET - Listar productos del cliente
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria')
    const busqueda = searchParams.get('q')

    let sql = `
      SELECT * FROM productos
      WHERE cliente_id = $1 AND activo = true
    `
    const params: any[] = [user.cliente_id]

    if (categoria) {
      params.push(categoria)
      sql += ` AND categoria = $${params.length}`
    }

    if (busqueda) {
      params.push(`%${busqueda}%`)
      sql += ` AND (
        nombre ILIKE $${params.length} OR
        sinonimos ILIKE $${params.length} OR
        palabras_clave ILIKE $${params.length} OR
        descripcion ILIKE $${params.length}
      )`
    }

    sql += ' ORDER BY categoria, nombre'

    const productos = await query(sql, params)

    // Obtener categorías únicas
    const categorias = await query(
      `SELECT DISTINCT categoria FROM productos
       WHERE cliente_id = $1 AND activo = true AND categoria IS NOT NULL
       ORDER BY categoria`,
      [user.cliente_id]
    )

    return NextResponse.json({
      productos,
      categorias: categorias.map((c: any) => c.categoria)
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear nuevo producto
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      nombre,
      descripcion,
      categoria,
      precio,
      precio_antes,
      moneda = 'USD',
      stock,
      sku,
      imagen_url,
      video_url,
      imagenes_adicionales = [],
      beneficios,
      palabras_clave = '',
    } = body

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    // Generar sinónimos automáticamente con IA
    console.log(`[Productos] Generando sinónimos para: ${nombre}`)
    const sinonimos = await generarSinonimosProducto(nombre, categoria, descripcion)
    console.log(`[Productos] Sinónimos generados: ${sinonimos}`)

    // Crear producto
    const producto = await queryOne(
      `INSERT INTO productos (
        cliente_id, nombre, descripcion, categoria, precio, precio_antes,
        moneda, stock, sku, imagen_url, video_url, imagenes_adicionales,
        beneficios, sinonimos, palabras_clave
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        user.cliente_id, nombre, descripcion, categoria, precio, precio_antes,
        moneda, stock, sku, imagen_url, video_url, JSON.stringify(imagenes_adicionales),
        beneficios, sinonimos, palabras_clave
      ]
    )

    return NextResponse.json(producto, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT - Actualizar producto
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      id,
      nombre,
      descripcion,
      categoria,
      precio,
      precio_antes,
      moneda,
      stock,
      sku,
      imagen_url,
      video_url,
      imagenes_adicionales,
      beneficios,
      palabras_clave,
      regenerar_sinonimos = false,
      activo,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Verificar que el producto pertenece al cliente
    const productoExistente = await queryOne(
      `SELECT * FROM productos WHERE id = $1 AND cliente_id = $2`,
      [id, user.cliente_id]
    )

    if (!productoExistente) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // Regenerar sinónimos si se cambió el nombre o se solicitó explícitamente
    let sinonimos = productoExistente.sinonimos
    if (regenerar_sinonimos || (nombre && nombre !== productoExistente.nombre)) {
      console.log(`[Productos] Regenerando sinónimos para: ${nombre || productoExistente.nombre}`)
      sinonimos = await generarSinonimosProducto(
        nombre || productoExistente.nombre,
        categoria || productoExistente.categoria,
        descripcion || productoExistente.descripcion
      )
      console.log(`[Productos] Nuevos sinónimos: ${sinonimos}`)
    }

    // Actualizar producto
    const producto = await queryOne(
      `UPDATE productos SET
        nombre = COALESCE($2, nombre),
        descripcion = COALESCE($3, descripcion),
        categoria = COALESCE($4, categoria),
        precio = COALESCE($5, precio),
        precio_antes = COALESCE($6, precio_antes),
        moneda = COALESCE($7, moneda),
        stock = COALESCE($8, stock),
        sku = COALESCE($9, sku),
        imagen_url = COALESCE($10, imagen_url),
        video_url = COALESCE($11, video_url),
        imagenes_adicionales = COALESCE($12, imagenes_adicionales),
        beneficios = COALESCE($13, beneficios),
        palabras_clave = COALESCE($14, palabras_clave),
        sinonimos = $15,
        activo = COALESCE($16, activo),
        updated_at = NOW()
      WHERE id = $1 AND cliente_id = $17
      RETURNING *`,
      [
        id, nombre, descripcion, categoria, precio, precio_antes,
        moneda, stock, sku, imagen_url, video_url,
        imagenes_adicionales ? JSON.stringify(imagenes_adicionales) : null,
        beneficios, palabras_clave, sinonimos, activo, user.cliente_id
      ]
    )

    return NextResponse.json(producto)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Eliminar producto
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Soft delete
    await execute(
      `UPDATE productos SET activo = false, updated_at = NOW()
       WHERE id = $1 AND cliente_id = $2`,
      [id, user.cliente_id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
