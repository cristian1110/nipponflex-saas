import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { OdooClient } from '@/lib/integrations/odoo'

export const dynamic = 'force-dynamic'

// GET - Obtener configuración y estado de conexión Odoo
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Buscar configuración existente
    const config = await queryOne(
      `SELECT ic.*, pi.nombre as proveedor_nombre
       FROM integraciones_cliente ic
       JOIN proveedores_integracion pi ON ic.proveedor_id = pi.id
       WHERE ic.cliente_id = $1 AND pi.nombre = 'Odoo'`,
      [user.cliente_id]
    )

    if (!config) {
      return NextResponse.json({ 
        configurado: false,
        mensaje: 'Odoo no está configurado'
      })
    }

    return NextResponse.json({
      configurado: true,
      activo: config.activo,
      ultimo_test: config.ultimo_test,
      test_exitoso: config.test_exitoso,
      config: {
        url: config.configuracion?.odoo_url || '',
        database: config.configuracion?.database || '',
        username: config.configuracion?.username || '',
        hasApiKey: !!config.configuracion?.api_key
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Guardar/Actualizar configuración y probar conexión
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { odoo_url, database, username, api_key, action } = body

    // Obtener ID del proveedor Odoo
    const proveedor = await queryOne(
      `SELECT id FROM proveedores_integracion WHERE nombre = 'Odoo'`
    )
    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor Odoo no encontrado' }, { status: 400 })
    }

    // Si es solo test de conexión
    if (action === 'test') {
      const client = new OdooClient({ url: odoo_url, database, username, apiKey: api_key })
      const authenticated = await client.authenticate()
      
      if (authenticated) {
        // Intentar obtener módulos instalados
        const modules = await client.getInstalledModules()
        
        // Actualizar estado del test
        await query(
          `UPDATE integraciones_cliente 
           SET ultimo_test = NOW(), test_exitoso = $1, updated_at = NOW()
           WHERE cliente_id = $2 AND proveedor_id = $3`,
          [authenticated, user.cliente_id, proveedor.id]
        )

        return NextResponse.json({ 
          success: true, 
          mensaje: 'Conexión exitosa',
          modulos_instalados: modules.success ? modules.data?.length || 0 : 0
        })
      } else {
        return NextResponse.json({ 
          success: false, 
          error: 'No se pudo autenticar con Odoo. Verifica las credenciales.'
        })
      }
    }

    // Guardar configuración
    const configuracion = { odoo_url, database, username, api_key }

    await query(
      `INSERT INTO integraciones_cliente (cliente_id, proveedor_id, configuracion, activo, updated_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (cliente_id, proveedor_id) 
       DO UPDATE SET configuracion = $3, updated_at = NOW()`,
      [user.cliente_id, proveedor.id, JSON.stringify(configuracion)]
    )

    // Probar conexión automáticamente
    const client = new OdooClient({ url: odoo_url, database, username, apiKey: api_key })
    const authenticated = await client.authenticate()

    await query(
      `UPDATE integraciones_cliente 
       SET ultimo_test = NOW(), test_exitoso = $1
       WHERE cliente_id = $2 AND proveedor_id = $3`,
      [authenticated, user.cliente_id, proveedor.id]
    )

    return NextResponse.json({ 
      success: true, 
      conexion: authenticated,
      mensaje: authenticated ? 'Configuración guardada y conexión exitosa' : 'Configuración guardada pero la conexión falló'
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
