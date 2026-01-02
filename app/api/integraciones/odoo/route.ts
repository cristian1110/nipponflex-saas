import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Test de conexión con Odoo JSON-RPC
async function testOdooConnection(url: string, database: string, username: string, apiKey: string) {
  try {
    const response = await fetch(`${url}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'common',
          method: 'authenticate',
          args: [database, username, apiKey, {}]
        },
        id: 1
      })
    })
    
    const data = await response.json()
    const uid = data.result
    return { success: !!uid && uid !== false, uid }
  } catch (error) {
    console.error('Odoo connection error:', error)
    return { success: false, error: String(error) }
  }
}

// GET - Obtener configuración de Odoo
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Buscar configuración existente de Odoo
    const config = await queryOne(
      `SELECT * FROM integraciones WHERE cuenta_id = $1 AND tipo = 'odoo'`,
      [user.cuenta_id || 1]
    )

    if (!config) {
      return NextResponse.json({
        configurado: false,
        activo: false,
        test_exitoso: false,
        config: { url: '', database: '', username: '', hasApiKey: false }
      })
    }

    const configuracion = config.config || {}

    return NextResponse.json({
      configurado: true,
      activo: config.estado === 'conectado',
      ultimo_test: config.ultimo_sync,
      test_exitoso: config.estado === 'conectado',
      config: {
        url: configuracion.odoo_url || configuracion.url || '',
        database: configuracion.database || '',
        username: configuracion.username || '',
        hasApiKey: !!(configuracion.api_key || configuracion.apiKey)
      }
    })
  } catch (error) {
    console.error('Error GET Odoo:', error)
    return NextResponse.json({ error: 'Error interno', details: String(error) }, { status: 500 })
  }
}

// POST - Guardar configuración y probar conexión
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { odoo_url, database, username, api_key, action } = body

    if (!odoo_url || !database || !username) {
      return NextResponse.json({ error: 'URL, base de datos y usuario son requeridos' }, { status: 400 })
    }

    // Obtener API key existente si no se envía una nueva
    let apiKeyToUse = api_key
    if (!apiKeyToUse) {
      const existingConfig = await queryOne(
        `SELECT config FROM integraciones WHERE cuenta_id = $1 AND tipo = 'odoo'`,
        [user.cuenta_id || 1]
      )
      apiKeyToUse = existingConfig?.config?.api_key || existingConfig?.config?.apiKey
    }

    if (!apiKeyToUse) {
      return NextResponse.json({ error: 'API Key es requerida' }, { status: 400 })
    }

    // Probar conexión
    const testResult = await testOdooConnection(odoo_url, database, username, apiKeyToUse)

    if (action === 'test') {
      // Solo actualizar estado si existe el registro
      if (testResult.success) {
        await query(
          `UPDATE integraciones SET estado = 'conectado', ultimo_sync = NOW(), error_mensaje = NULL, updated_at = NOW()
           WHERE cuenta_id = $1 AND tipo = 'odoo'`,
          [user.cuenta_id || 1]
        )
      } else {
        await query(
          `UPDATE integraciones SET estado = 'error', error_mensaje = $1, updated_at = NOW()
           WHERE cuenta_id = $2 AND tipo = 'odoo'`,
          [testResult.error || 'Error de autenticación', user.cuenta_id || 1]
        )
      }

      return NextResponse.json({
        success: testResult.success,
        mensaje: testResult.success ? '✅ Conexión exitosa' : '❌ Error de conexión',
        error: testResult.error,
        uid: testResult.uid
      })
    }

    // Guardar configuración
    const configuracion = { 
      odoo_url, 
      url: odoo_url,
      database, 
      username, 
      api_key: apiKeyToUse 
    }

    // Verificar si ya existe
    const existing = await queryOne(
      `SELECT id FROM integraciones WHERE cuenta_id = $1 AND tipo = 'odoo'`,
      [user.cuenta_id || 1]
    )

    if (existing) {
      await query(
        `UPDATE integraciones 
         SET config = $1, estado = $2, ultimo_sync = NOW(), error_mensaje = $3, updated_at = NOW()
         WHERE cuenta_id = $4 AND tipo = 'odoo'`,
        [
          JSON.stringify(configuracion), 
          testResult.success ? 'conectado' : 'error',
          testResult.success ? null : (testResult.error || 'Error de autenticación'),
          user.cuenta_id || 1
        ]
      )
    } else {
      await query(
        `INSERT INTO integraciones (cuenta_id, tipo, nombre, config, estado, ultimo_sync, error_mensaje)
         VALUES ($1, 'odoo', 'Odoo ERP', $2, $3, NOW(), $4)`,
        [
          user.cuenta_id || 1,
          JSON.stringify(configuracion),
          testResult.success ? 'conectado' : 'error',
          testResult.success ? null : (testResult.error || 'Error de autenticación')
        ]
      )
    }

    return NextResponse.json({
      success: true,
      conexion: testResult.success,
      mensaje: testResult.success 
        ? '✅ Configuración guardada y conexión exitosa' 
        : '⚠️ Configuración guardada pero la conexión falló. Verifica las credenciales.'
    })
  } catch (error) {
    console.error('Error POST Odoo:', error)
    return NextResponse.json({ error: 'Error interno', details: String(error) }, { status: 500 })
  }
}
