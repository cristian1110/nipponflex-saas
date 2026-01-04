import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  getAuthUrl,
  checkConnection,
  disconnect,
  listCalendars,
  syncAllCitas
} from '@/lib/integrations/google-calendar'
import { execute, queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Obtener estado de conexión o URL de autorización
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'auth-url') {
      // Verificar que las credenciales estén configuradas
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return NextResponse.json({
          error: 'Google Calendar no está configurado. Contacta al administrador.',
          configured: false
        }, { status: 400 })
      }

      const authUrl = getAuthUrl(user.cliente_id!)
      return NextResponse.json({ authUrl })
    }

    if (action === 'calendars') {
      const calendars = await listCalendars(user.cliente_id!)
      return NextResponse.json({ calendars })
    }

    // Por defecto: verificar estado de conexión
    const status = await checkConnection(user.cliente_id!)
    return NextResponse.json({
      connected: status.connected,
      email: status.email,
      configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    })

  } catch (error) {
    console.error('Error Google Calendar:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Sincronizar citas o configurar calendario
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { action, calendarId } = body

    if (action === 'sync') {
      // Sincronizar todas las citas pendientes
      const result = await syncAllCitas(user.cliente_id!)
      return NextResponse.json({
        success: true,
        ...result
      })
    }

    if (action === 'set-calendar' && calendarId) {
      // Configurar calendario a usar
      await execute(
        `UPDATE integraciones_google SET calendar_id = $2, updated_at = NOW() WHERE cliente_id = $1`,
        [user.cliente_id, calendarId]
      )
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Error Google Calendar POST:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Desconectar cuenta
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    await disconnect(user.cliente_id!)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error desconectando Google Calendar:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
