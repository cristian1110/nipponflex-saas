import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, saveTokens, checkConnection } from '@/lib/integrations/google-calendar'

export const dynamic = 'force-dynamic'

// GET - Callback de OAuth de Google
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // URL base para redirección
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nipponflex.84.247.166.88.sslip.io'

    if (error) {
      console.error('Error en OAuth Google:', error)
      return NextResponse.redirect(`${baseUrl}/integraciones?error=google_auth_failed`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/integraciones?error=missing_params`)
    }

    // Parsear state para obtener clienteId
    let clienteId: number
    try {
      const stateData = JSON.parse(state)
      clienteId = stateData.clienteId
    } catch {
      return NextResponse.redirect(`${baseUrl}/integraciones?error=invalid_state`)
    }

    // Intercambiar código por tokens
    const tokens = await exchangeCodeForTokens(code)

    // Guardar tokens en la base de datos
    await saveTokens(clienteId, tokens)

    // Verificar conexión
    const status = await checkConnection(clienteId)

    if (status.connected) {
      return NextResponse.redirect(`${baseUrl}/integraciones?success=google_connected&email=${encodeURIComponent(status.email || '')}`)
    } else {
      return NextResponse.redirect(`${baseUrl}/integraciones?error=google_connection_failed`)
    }

  } catch (error) {
    console.error('Error en callback Google Calendar:', error)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nipponflex.84.247.166.88.sslip.io'
    return NextResponse.redirect(`${baseUrl}/integraciones?error=google_callback_error`)
  }
}
