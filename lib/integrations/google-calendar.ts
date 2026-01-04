// Integración con Google Calendar
import { google, calendar_v3 } from 'googleapis'
import { queryOne, query, execute } from '@/lib/db'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
]

// Crear cliente OAuth2
export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://nipponflex.84.247.166.88.sslip.io'}/api/integraciones/google-calendar/callback`

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET son requeridos')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

// Generar URL de autorización
export function getAuthUrl(clienteId: number): string {
  const oauth2Client = createOAuth2Client()

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: JSON.stringify({ clienteId })
  })
}

// Intercambiar código por tokens
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

// Guardar tokens en la base de datos
export async function saveTokens(clienteId: number, tokens: any) {
  // Verificar si ya existe una integración
  const existing = await queryOne(
    `SELECT id FROM integraciones_google WHERE cliente_id = $1`,
    [clienteId]
  )

  if (existing) {
    await execute(
      `UPDATE integraciones_google
       SET access_token = $2, refresh_token = COALESCE($3, refresh_token),
           expiry_date = $4, updated_at = NOW()
       WHERE cliente_id = $1`,
      [clienteId, tokens.access_token, tokens.refresh_token, tokens.expiry_date]
    )
  } else {
    await execute(
      `INSERT INTO integraciones_google (cliente_id, access_token, refresh_token, expiry_date, calendar_id)
       VALUES ($1, $2, $3, $4, 'primary')`,
      [clienteId, tokens.access_token, tokens.refresh_token, tokens.expiry_date]
    )
  }
}

// Obtener tokens de la base de datos
export async function getTokens(clienteId: number) {
  return queryOne(
    `SELECT access_token, refresh_token, expiry_date, calendar_id
     FROM integraciones_google WHERE cliente_id = $1`,
    [clienteId]
  )
}

// Crear cliente autenticado
export async function getAuthenticatedClient(clienteId: number) {
  const tokens = await getTokens(clienteId)

  if (!tokens) {
    return null
  }

  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date
  })

  // Manejar refresh automático
  oauth2Client.on('tokens', async (newTokens) => {
    await saveTokens(clienteId, newTokens)
  })

  return oauth2Client
}

// Verificar estado de conexión
export async function checkConnection(clienteId: number): Promise<{ connected: boolean; email?: string }> {
  try {
    const auth = await getAuthenticatedClient(clienteId)
    if (!auth) return { connected: false }

    const oauth2 = google.oauth2({ version: 'v2', auth })
    const { data } = await oauth2.userinfo.get()

    return { connected: true, email: data.email || undefined }
  } catch (error) {
    console.error('Error verificando conexión Google:', error)
    return { connected: false }
  }
}

// Desconectar cuenta
export async function disconnect(clienteId: number) {
  await execute(
    `DELETE FROM integraciones_google WHERE cliente_id = $1`,
    [clienteId]
  )
}

// ==================== OPERACIONES DE CALENDARIO ====================

// Obtener cliente de calendario
async function getCalendarClient(clienteId: number) {
  const auth = await getAuthenticatedClient(clienteId)
  if (!auth) return null
  return google.calendar({ version: 'v3', auth })
}

// Listar calendarios
export async function listCalendars(clienteId: number) {
  const calendar = await getCalendarClient(clienteId)
  if (!calendar) return []

  try {
    const { data } = await calendar.calendarList.list()
    return data.items || []
  } catch (error) {
    console.error('Error listando calendarios:', error)
    return []
  }
}

// Crear evento en Google Calendar
export async function createEvent(clienteId: number, cita: {
  titulo: string
  descripcion?: string
  fecha_inicio: Date
  fecha_fin?: Date
  ubicacion?: string
  recordatorio_minutos?: number
}): Promise<string | null> {
  const calendar = await getCalendarClient(clienteId)
  if (!calendar) return null

  const tokens = await getTokens(clienteId)
  const calendarId = tokens?.calendar_id || 'primary'

  const fechaFin = cita.fecha_fin || new Date(cita.fecha_inicio.getTime() + 60 * 60 * 1000) // 1 hora por defecto

  const event: calendar_v3.Schema$Event = {
    summary: cita.titulo,
    description: cita.descripcion,
    location: cita.ubicacion,
    start: {
      dateTime: cita.fecha_inicio.toISOString(),
      timeZone: 'America/Guayaquil' // Ecuador
    },
    end: {
      dateTime: fechaFin.toISOString(),
      timeZone: 'America/Guayaquil'
    },
    reminders: {
      useDefault: false,
      overrides: cita.recordatorio_minutos ? [
        { method: 'popup', minutes: cita.recordatorio_minutos },
        { method: 'email', minutes: cita.recordatorio_minutos }
      ] : undefined
    }
  }

  try {
    const { data } = await calendar.events.insert({
      calendarId,
      requestBody: event
    })

    console.log(`Evento creado en Google Calendar: ${data.id}`)
    return data.id || null
  } catch (error) {
    console.error('Error creando evento en Google Calendar:', error)
    return null
  }
}

// Actualizar evento en Google Calendar
export async function updateEvent(clienteId: number, googleEventId: string, cita: {
  titulo: string
  descripcion?: string
  fecha_inicio: Date
  fecha_fin?: Date
  ubicacion?: string
  estado?: string
}): Promise<boolean> {
  const calendar = await getCalendarClient(clienteId)
  if (!calendar) return false

  const tokens = await getTokens(clienteId)
  const calendarId = tokens?.calendar_id || 'primary'

  const fechaFin = cita.fecha_fin || new Date(cita.fecha_inicio.getTime() + 60 * 60 * 1000)

  const event: calendar_v3.Schema$Event = {
    summary: cita.titulo,
    description: cita.descripcion,
    location: cita.ubicacion,
    start: {
      dateTime: cita.fecha_inicio.toISOString(),
      timeZone: 'America/Guayaquil'
    },
    end: {
      dateTime: fechaFin.toISOString(),
      timeZone: 'America/Guayaquil'
    },
    status: cita.estado === 'cancelada' ? 'cancelled' : 'confirmed'
  }

  try {
    await calendar.events.update({
      calendarId,
      eventId: googleEventId,
      requestBody: event
    })

    console.log(`Evento actualizado en Google Calendar: ${googleEventId}`)
    return true
  } catch (error) {
    console.error('Error actualizando evento en Google Calendar:', error)
    return false
  }
}

// Eliminar evento de Google Calendar
export async function deleteEvent(clienteId: number, googleEventId: string): Promise<boolean> {
  const calendar = await getCalendarClient(clienteId)
  if (!calendar) return false

  const tokens = await getTokens(clienteId)
  const calendarId = tokens?.calendar_id || 'primary'

  try {
    await calendar.events.delete({
      calendarId,
      eventId: googleEventId
    })

    console.log(`Evento eliminado de Google Calendar: ${googleEventId}`)
    return true
  } catch (error) {
    console.error('Error eliminando evento de Google Calendar:', error)
    return false
  }
}

// Sincronizar cita local con Google Calendar
export async function syncCitaToGoogle(clienteId: number, citaId: number): Promise<string | null> {
  const cita = await queryOne(
    `SELECT * FROM citas WHERE id = $1 AND cliente_id = $2`,
    [citaId, clienteId]
  )

  if (!cita) return null

  // Verificar si ya tiene un evento en Google Calendar
  if (cita.google_event_id) {
    // Actualizar evento existente
    const updated = await updateEvent(clienteId, cita.google_event_id, {
      titulo: cita.titulo,
      descripcion: cita.descripcion,
      fecha_inicio: new Date(cita.fecha_inicio),
      fecha_fin: cita.fecha_fin ? new Date(cita.fecha_fin) : undefined,
      ubicacion: cita.ubicacion,
      estado: cita.estado
    })

    return updated ? cita.google_event_id : null
  } else {
    // Crear nuevo evento
    const googleEventId = await createEvent(clienteId, {
      titulo: cita.titulo,
      descripcion: cita.descripcion,
      fecha_inicio: new Date(cita.fecha_inicio),
      fecha_fin: cita.fecha_fin ? new Date(cita.fecha_fin) : undefined,
      ubicacion: cita.ubicacion,
      recordatorio_minutos: cita.recordatorio_minutos
    })

    if (googleEventId) {
      // Guardar referencia en la cita
      await execute(
        `UPDATE citas SET google_event_id = $2, updated_at = NOW() WHERE id = $1`,
        [citaId, googleEventId]
      )
    }

    return googleEventId
  }
}

// Sincronizar todas las citas pendientes
export async function syncAllCitas(clienteId: number): Promise<{ synced: number; errors: number }> {
  const citas = await query(
    `SELECT id FROM citas
     WHERE cliente_id = $1
       AND estado IN ('pendiente', 'confirmada')
       AND fecha_inicio > NOW()
       AND google_event_id IS NULL`,
    [clienteId]
  )

  let synced = 0
  let errors = 0

  for (const cita of citas) {
    const result = await syncCitaToGoogle(clienteId, cita.id)
    if (result) {
      synced++
    } else {
      errors++
    }
  }

  return { synced, errors }
}
