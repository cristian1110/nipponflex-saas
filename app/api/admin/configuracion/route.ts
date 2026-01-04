import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, execute } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Mapeo de claves de configuración a variables de entorno
const ENV_MAPPING: Record<string, string> = {
  'GROQ_API_KEY': 'GROQ_API_KEY',
  'JINA_API_KEY': 'JINA_API_KEY',
  'ELEVENLABS_API_KEY': 'ELEVENLABS_API_KEY',
  'EVOLUTION_API_URL': 'EVOLUTION_API_URL',
  'EVOLUTION_API_KEY': 'EVOLUTION_API_KEY',
  'QDRANT_URL': 'QDRANT_URL',
  'SMTP_HOST': 'SMTP_HOST',
  'SMTP_PORT': 'SMTP_PORT',
  'SMTP_USER': 'SMTP_USER',
  'SMTP_PASS': 'SMTP_PASS',
}

// GET - Obtener configuraciones globales (solo super admin)
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.nivel < 100) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const configs = await query(
      `SELECT id, clave, valor, descripcion, tipo, updated_at FROM configuracion_global ORDER BY clave`
    )

    // Verificar también las variables de entorno
    const configsSeguras = configs.map((c: any) => {
      const envVar = ENV_MAPPING[c.clave]
      const envValue = envVar ? process.env[envVar] : null
      const dbValue = c.valor

      // Usar valor de BD si existe, si no usar valor de .env
      const hasValue = !!(dbValue || envValue)
      const displayValue = c.tipo === 'password'
        ? (hasValue ? '********' : '')
        : (dbValue || envValue || '')

      return {
        ...c,
        valor: displayValue,
        hasValue,
        source: dbValue ? 'database' : (envValue ? 'env' : 'none')
      }
    })

    return NextResponse.json(configsSeguras)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT - Actualizar configuración
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.nivel < 100) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { clave, valor } = await request.json()

    if (!clave) {
      return NextResponse.json({ error: 'Clave requerida' }, { status: 400 })
    }

    // No actualizar si el valor es ******** (significa que no cambió)
    if (valor === '********') {
      return NextResponse.json({ success: true, message: 'Sin cambios' })
    }

    await execute(
      `UPDATE configuracion_global SET valor = $1, updated_at = NOW(), updated_by = $2 WHERE clave = $3`,
      [valor, user.id, clave]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear nueva configuración
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.nivel < 100) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { clave, valor, descripcion, tipo } = await request.json()

    if (!clave) {
      return NextResponse.json({ error: 'Clave requerida' }, { status: 400 })
    }

    await execute(
      `INSERT INTO configuracion_global (clave, valor, descripcion, tipo, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (clave) DO UPDATE SET valor = $2, descripcion = $3, tipo = $4, updated_at = NOW(), updated_by = $5`,
      [clave, valor || '', descripcion || '', tipo || 'text', user.id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
