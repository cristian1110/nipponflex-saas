// Utilidades para agendar citas desde el chat IA

import { queryOne, query, execute } from './db'

export interface CitaDetectada {
  detectada: boolean
  titulo?: string
  fecha?: Date
  hora?: string
  duracion?: number // minutos
  descripcion?: string
  confianza: number // 0-1
}

// Palabras clave que indican intención de agendar cita
const PALABRAS_CITA = [
  'cita', 'agendar', 'reservar', 'apartar', 'programar',
  'consulta', 'visita', 'turno', 'hora', 'horario',
  'disponibilidad', 'cuando puedo', 'puedo ir', 'me pueden atender',
  'quiero una cita', 'necesito una cita', 'agendar una cita',
  'hacer una cita', 'sacar cita', 'pedir cita', 'solicitar cita'
]

// Días de la semana
const DIAS_SEMANA: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
  'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6
}

// Meses
const MESES: Record<string, number> = {
  'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
  'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
}

// Detectar si el mensaje del usuario indica intención de agendar cita
export function detectarIntencionCita(mensaje: string): boolean {
  const mensajeLower = mensaje.toLowerCase()

  // Buscar palabras clave
  for (const palabra of PALABRAS_CITA) {
    if (mensajeLower.includes(palabra)) {
      return true
    }
  }

  // Patrones adicionales
  const patrones = [
    /quiero\s+(ver|ir|visitarles?)/i,
    /cuand[oa]\s+pued[oe]/i,
    /hay\s+espacio/i,
    /tienen\s+disponible/i,
    /me\s+pueden\s+(atender|recibir)/i,
    /a\s+qu[eé]\s+hora/i,
    /para\s+(el|la|este|esta)\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/i
  ]

  for (const patron of patrones) {
    if (patron.test(mensajeLower)) {
      return true
    }
  }

  return false
}

// Parsear fecha y hora de texto en lenguaje natural
export function parsearFechaHora(texto: string): { fecha: Date | null, hora: string | null } {
  const textoLower = texto.toLowerCase()
  const ahora = new Date()
  let fecha: Date | null = null
  let hora: string | null = null

  // Buscar hora explícita (ej: "3pm", "15:00", "3 de la tarde", "10 de la mañana")
  const patronesHora = [
    /(\d{1,2})\s*(?::|h)\s*(\d{2})?\s*(am|pm)?/i,
    /(\d{1,2})\s*(am|pm)/i,
    /(\d{1,2})\s+de\s+la\s+(mañana|tarde|noche)/i,
    /a\s+las?\s+(\d{1,2})(?:\s*(?::|h)\s*(\d{2}))?\s*(am|pm)?/i
  ]

  for (const patron of patronesHora) {
    const match = textoLower.match(patron)
    if (match) {
      let horas = parseInt(match[1])
      let minutos = match[2] ? parseInt(match[2]) : 0

      // Ajustar AM/PM
      const ampm = match[3]?.toLowerCase() || match[2]?.toLowerCase()
      if (ampm === 'pm' || ampm === 'tarde' || ampm === 'noche') {
        if (horas < 12) horas += 12
      } else if (ampm === 'am' || ampm === 'mañana') {
        if (horas === 12) horas = 0
      }

      hora = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`
      break
    }
  }

  // Buscar fecha - palabras relativas
  if (textoLower.includes('hoy')) {
    fecha = new Date(ahora)
  } else if (textoLower.includes('mañana')) {
    fecha = new Date(ahora)
    fecha.setDate(fecha.getDate() + 1)
  } else if (textoLower.includes('pasado mañana')) {
    fecha = new Date(ahora)
    fecha.setDate(fecha.getDate() + 2)
  } else if (textoLower.match(/pr[oó]xim[oa]\s+semana/)) {
    fecha = new Date(ahora)
    fecha.setDate(fecha.getDate() + 7)
  }

  // Buscar día de la semana (ej: "el lunes", "este martes", "próximo viernes")
  if (!fecha) {
    const patronDia = /(este|pr[oó]xim[oa])?\s*(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i
    const matchDia = textoLower.match(patronDia)

    if (matchDia) {
      const diaTexto = matchDia[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      const diaObjetivo = DIAS_SEMANA[diaTexto]

      if (diaObjetivo !== undefined) {
        fecha = new Date(ahora)
        const diaActual = ahora.getDay()
        let diasSumar = diaObjetivo - diaActual

        // Si es hoy o ya pasó, ir a la próxima semana
        if (diasSumar <= 0) {
          diasSumar += 7
        }

        // Si dice "próximo", agregar una semana más
        if (matchDia[1]?.toLowerCase().includes('proxim')) {
          diasSumar += 7
        }

        fecha.setDate(fecha.getDate() + diasSumar)
      }
    }
  }

  // Buscar fecha explícita (ej: "15 de enero", "el 20", "20/01")
  if (!fecha) {
    // Patrón: "15 de enero"
    const patronFechaMes = /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i
    const matchFechaMes = textoLower.match(patronFechaMes)

    if (matchFechaMes) {
      const dia = parseInt(matchFechaMes[1])
      const mes = MESES[matchFechaMes[2].toLowerCase()]

      if (mes !== undefined) {
        fecha = new Date(ahora.getFullYear(), mes, dia)
        // Si la fecha ya pasó, usar el próximo año
        if (fecha < ahora) {
          fecha.setFullYear(fecha.getFullYear() + 1)
        }
      }
    }

    // Patrón: "el 15" o "día 20"
    if (!fecha) {
      const patronDiaNumero = /(?:el|d[ií]a)\s+(\d{1,2})/i
      const matchDiaNumero = textoLower.match(patronDiaNumero)

      if (matchDiaNumero) {
        const dia = parseInt(matchDiaNumero[1])
        fecha = new Date(ahora.getFullYear(), ahora.getMonth(), dia)

        // Si la fecha ya pasó, usar el próximo mes
        if (fecha < ahora) {
          fecha.setMonth(fecha.getMonth() + 1)
        }
      }
    }

    // Patrón: "20/01" o "20-01-2024"
    if (!fecha) {
      const patronFechaNum = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/
      const matchFechaNum = textoLower.match(patronFechaNum)

      if (matchFechaNum) {
        const dia = parseInt(matchFechaNum[1])
        const mes = parseInt(matchFechaNum[2]) - 1
        let anio = matchFechaNum[3] ? parseInt(matchFechaNum[3]) : ahora.getFullYear()

        if (anio < 100) anio += 2000

        fecha = new Date(anio, mes, dia)
      }
    }
  }

  return { fecha, hora }
}

// Opciones de recordatorio disponibles
export const OPCIONES_RECORDATORIO = [
  { valor: 15, texto: '15 minutos antes' },
  { valor: 30, texto: '30 minutos antes' },
  { valor: 60, texto: '1 hora antes' },
  { valor: 120, texto: '2 horas antes' },
  { valor: 1440, texto: '1 día antes' },
  { valor: 2880, texto: '2 días antes' },
]

// Prompt adicional para que la IA detecte y confirme citas
export function getPromptCitas(citasDelCliente?: any[]): string {
  const hoy = new Date()
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 1)

  const formatoFecha = (d: Date) => d.toISOString().split('T')[0]

  let citasInfo = ''
  if (citasDelCliente && citasDelCliente.length > 0) {
    citasInfo = `
## CITAS DEL CLIENTE
El cliente tiene las siguientes citas programadas:
${citasDelCliente.map((c, i) => `${i + 1}. ID: ${c.id} - "${c.titulo}" - ${c.fecha_formateada} a las ${c.hora_formateada} - Estado: ${c.estado}`).join('\n')}

Si el cliente pregunta por sus citas, proporciona esta información.
`
  }

  return `

## GESTIÓN DE CITAS
Fecha de hoy: ${formatoFecha(hoy)}
Fecha de mañana: ${formatoFecha(manana)}
${citasInfo}

### AGENDAR NUEVA CITA
Cuando el cliente quiere agendar una cita:
1. Pregunta la fecha y hora deseada si no la mencionó
2. Confirma los detalles antes de agendar
3. Si el cliente confirma, responde con:

[CITA_CONFIRMADA]
fecha: YYYY-MM-DD
hora: HH:MM
titulo: Descripción breve de la cita
duracion: 30
[/CITA_CONFIRMADA]

### CONSULTAR CITAS
Si el cliente pregunta por sus citas (ej: "¿tengo citas?", "mi cita", "cuándo es mi cita"):
- Proporciona la información de las citas listadas arriba
- Si no tiene citas, indica que no tiene citas programadas

### MODIFICAR CITA
Si el cliente quiere cambiar la fecha/hora de una cita existente:
1. Confirma qué cita desea modificar (si tiene varias)
2. Pregunta la nueva fecha y hora
3. Confirma el cambio y responde con:

[CITA_MODIFICADA]
cita_id: (número del ID de la cita)
nueva_fecha: YYYY-MM-DD
nueva_hora: HH:MM
[/CITA_MODIFICADA]

### CANCELAR CITA
Si el cliente quiere cancelar una cita:
1. Confirma qué cita desea cancelar (si tiene varias)
2. Pide confirmación de cancelación
3. Si confirma, responde con:

[CITA_CANCELADA]
cita_id: (número del ID de la cita)
motivo: (razón breve de cancelación)
[/CITA_CANCELADA]

IMPORTANTE:
- Usa SIEMPRE el año ${hoy.getFullYear()} para las fechas
- Si dicen "mañana", usa la fecha ${formatoFecha(manana)}
- Solo incluye los bloques especiales cuando el cliente haya confirmado explícitamente la acción
`
}

// Extraer datos de cita de la respuesta de la IA
export function extraerCitaDeRespuesta(respuesta: string): CitaDetectada | null {
  const regex = /\[CITA_CONFIRMADA\]([\s\S]*?)\[\/CITA_CONFIRMADA\]/i
  const match = respuesta.match(regex)

  if (!match) {
    return null
  }

  const contenido = match[1]
  const datos: Record<string, string> = {}

  // Parsear campos
  const lineas = contenido.split('\n')
  for (const linea of lineas) {
    const [clave, ...valor] = linea.split(':')
    if (clave && valor.length) {
      datos[clave.trim().toLowerCase()] = valor.join(':').trim()
    }
  }

  if (!datos.fecha || !datos.hora) {
    return null
  }

  // Construir fecha
  const [year, month, day] = datos.fecha.split('-').map(Number)
  const [hours, minutes] = datos.hora.split(':').map(Number)

  const fecha = new Date(year, month - 1, day, hours, minutes)

  return {
    detectada: true,
    fecha,
    hora: datos.hora,
    titulo: datos.titulo || 'Cita agendada',
    duracion: parseInt(datos.duracion) || 30,
    descripcion: datos.descripcion,
    confianza: 1.0
  }
}

// Crear cita en la base de datos
export async function crearCitaDesdeIA(
  clienteId: number,
  leadId: number | null,
  telefono: string,
  citaData: CitaDetectada
): Promise<{ success: boolean, citaId?: number, error?: string }> {
  try {
    if (!citaData.fecha) {
      return { success: false, error: 'Fecha no válida' }
    }

    const fechaInicio = citaData.fecha
    const fechaFin = new Date(fechaInicio)
    fechaFin.setMinutes(fechaFin.getMinutes() + (citaData.duracion || 30))

    // Usar formato local para evitar conversión UTC
    const fechaInicioStr = formatearFechaLocal(fechaInicio)
    const fechaFinStr = formatearFechaLocal(fechaFin)

    console.log(`Creando cita: ${citaData.titulo} - ${fechaInicioStr} a ${fechaFinStr}`)

    const result = await queryOne(
      `INSERT INTO citas (
        cliente_id, lead_id, titulo, descripcion,
        fecha_inicio, fecha_fin, tipo, estado,
        recordatorio_minutos, recordatorio_canal, telefono_recordatorio,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ia', 'pendiente', 120, 'whatsapp', $7, NOW())
      RETURNING id`,
      [
        clienteId,
        leadId,
        citaData.titulo || 'Cita agendada por IA',
        citaData.descripcion || 'Cita agendada automáticamente desde WhatsApp',
        fechaInicioStr,
        fechaFinStr,
        telefono
      ]
    )

    if (result?.id) {
      console.log('Cita creada por IA:', result.id)
      return { success: true, citaId: result.id }
    }

    return { success: false, error: 'No se pudo crear la cita' }
  } catch (error) {
    console.error('Error creando cita desde IA:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// Obtener citas de un cliente por teléfono
export async function obtenerCitasDelCliente(
  clienteId: number,
  telefono: string
): Promise<any[]> {
  try {
    const citas = await query(
      `SELECT
        c.id,
        c.titulo,
        c.descripcion,
        c.fecha_inicio,
        c.fecha_fin,
        c.estado,
        to_char(c.fecha_inicio, 'DD/MM/YYYY') as fecha_formateada,
        to_char(c.fecha_inicio, 'HH12:MI') || ' ' ||
        CASE WHEN EXTRACT(HOUR FROM c.fecha_inicio) >= 12 THEN 'p.m.' ELSE 'a.m.' END as hora_formateada
      FROM citas c
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE c.cliente_id = $1
        AND (c.telefono_recordatorio = $2 OR l.telefono = $2)
        AND c.estado IN ('pendiente', 'confirmada')
        AND c.fecha_inicio >= NOW() - interval '1 day'
      ORDER BY c.fecha_inicio
      LIMIT 10`,
      [clienteId, telefono]
    )
    return citas
  } catch (error) {
    console.error('Error obteniendo citas del cliente:', error)
    return []
  }
}

// Extraer modificación de cita de la respuesta
export interface CitaModificada {
  citaId: number
  nuevaFecha: string
  nuevaHora: string
}

export function extraerModificacionCita(respuesta: string): CitaModificada | null {
  const regex = /\[CITA_MODIFICADA\]([\s\S]*?)\[\/CITA_MODIFICADA\]/i
  const match = respuesta.match(regex)

  if (!match) return null

  const contenido = match[1]
  const datos: Record<string, string> = {}

  const lineas = contenido.split('\n')
  for (const linea of lineas) {
    const [clave, ...valor] = linea.split(':')
    if (clave && valor.length) {
      datos[clave.trim().toLowerCase().replace('_', '')] = valor.join(':').trim()
    }
  }

  if (!datos.citaid || !datos.nuevafecha || !datos.nuevahora) return null

  return {
    citaId: parseInt(datos.citaid),
    nuevaFecha: datos.nuevafecha,
    nuevaHora: datos.nuevahora
  }
}

// Modificar cita existente
export async function modificarCita(
  clienteId: number,
  citaId: number,
  nuevaFecha: string,
  nuevaHora: string
): Promise<{ success: boolean, error?: string }> {
  try {
    // Verificar que la cita pertenece al cliente
    const cita = await queryOne(
      `SELECT id FROM citas WHERE id = $1 AND cliente_id = $2`,
      [citaId, clienteId]
    )

    if (!cita) {
      return { success: false, error: 'Cita no encontrada' }
    }

    // Construir nueva fecha/hora
    const [year, month, day] = nuevaFecha.split('-').map(Number)
    const [hours, minutes] = nuevaHora.split(':').map(Number)
    const fechaInicio = new Date(year, month - 1, day, hours, minutes)
    const fechaFin = new Date(fechaInicio)
    fechaFin.setMinutes(fechaFin.getMinutes() + 30)

    const fechaInicioStr = formatearFechaLocal(fechaInicio)
    const fechaFinStr = formatearFechaLocal(fechaFin)

    await execute(
      `UPDATE citas
       SET fecha_inicio = $1, fecha_fin = $2, recordatorio_enviado = false, updated_at = NOW()
       WHERE id = $3`,
      [fechaInicioStr, fechaFinStr, citaId]
    )

    console.log(`Cita ${citaId} modificada a ${fechaInicioStr}`)
    return { success: true }
  } catch (error) {
    console.error('Error modificando cita:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// Formatear fecha local (mover a scope global en el archivo)
function formatearFechaLocal(fecha: Date): string {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, '0')
  const day = String(fecha.getDate()).padStart(2, '0')
  const hours = String(fecha.getHours()).padStart(2, '0')
  const minutes = String(fecha.getMinutes()).padStart(2, '0')
  const seconds = String(fecha.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

// Extraer cancelación de cita de la respuesta
export interface CitaCancelada {
  citaId: number
  motivo: string
}

export function extraerCancelacionCita(respuesta: string): CitaCancelada | null {
  const regex = /\[CITA_CANCELADA\]([\s\S]*?)\[\/CITA_CANCELADA\]/i
  const match = respuesta.match(regex)

  if (!match) return null

  const contenido = match[1]
  const datos: Record<string, string> = {}

  const lineas = contenido.split('\n')
  for (const linea of lineas) {
    const [clave, ...valor] = linea.split(':')
    if (clave && valor.length) {
      datos[clave.trim().toLowerCase().replace('_', '')] = valor.join(':').trim()
    }
  }

  if (!datos.citaid) return null

  return {
    citaId: parseInt(datos.citaid),
    motivo: datos.motivo || 'Cancelada por el cliente'
  }
}

// Cancelar cita existente
export async function cancelarCita(
  clienteId: number,
  citaId: number,
  motivo: string
): Promise<{ success: boolean, error?: string }> {
  try {
    // Verificar que la cita pertenece al cliente
    const cita = await queryOne(
      `SELECT id FROM citas WHERE id = $1 AND cliente_id = $2`,
      [citaId, clienteId]
    )

    if (!cita) {
      return { success: false, error: 'Cita no encontrada' }
    }

    await execute(
      `UPDATE citas
       SET estado = 'cancelada', descripcion = COALESCE(descripcion, '') || ' | Cancelada: ' || $1, updated_at = NOW()
       WHERE id = $2`,
      [motivo, citaId]
    )

    console.log(`Cita ${citaId} cancelada: ${motivo}`)
    return { success: true }
  } catch (error) {
    console.error('Error cancelando cita:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// Limpiar respuesta removiendo bloques de cita/modificación/cancelación
export function limpiarRespuestaCitas(respuesta: string): string {
  return respuesta
    .replace(/\[CITA_CONFIRMADA\][\s\S]*?\[\/CITA_CONFIRMADA\]/gi, '')
    .replace(/\[CITA_MODIFICADA\][\s\S]*?\[\/CITA_MODIFICADA\]/gi, '')
    .replace(/\[CITA_CANCELADA\][\s\S]*?\[\/CITA_CANCELADA\]/gi, '')
    .trim()
}
