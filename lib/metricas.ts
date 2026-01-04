// Servicio de métricas para trackear uso de APIs de pago
import { query, execute } from './db'

export type ServicioAPI = 'groq' | 'jina' | 'twilio' | 'elevenlabs' | 'whisper' | 'vision' | 'whatsapp'

interface LogAPIParams {
  clienteId: number
  servicio: ServicioAPI
  endpoint?: string
  tokensInput?: number
  tokensOutput?: number
  costoUsd?: number
  duracionMs?: number
  modelo?: string
  metadata?: Record<string, any>
}

// Precios aproximados por servicio (USD)
export const PRECIOS_API = {
  groq: {
    'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 }, // por 1K tokens
    'llama-3.1-70b-versatile': { input: 0.00059, output: 0.00079 },
    'llama-3.2-11b-vision-preview': { input: 0.00018, output: 0.00018 },
    'whisper-large-v3': 0.000111, // por segundo
    'meta-llama/llama-4-scout-17b-16e-instruct': { input: 0.00011, output: 0.00034 },
  },
  jina: {
    'jina-embeddings-v2-base-es': 0.00002, // por 1K tokens (gratis hasta 1M)
  },
  elevenlabs: {
    default: 0.00003, // por carácter aprox
  },
  twilio: {
    sms: 0.0079, // por mensaje
    llamada: 0.014, // por minuto
  },
}

// Registrar uso de API
export async function registrarUsoAPI(params: LogAPIParams): Promise<void> {
  const {
    clienteId,
    servicio,
    endpoint,
    tokensInput = 0,
    tokensOutput = 0,
    costoUsd = 0,
    duracionMs = 0,
    modelo,
    metadata = {}
  } = params

  try {
    // Log detallado
    await execute(
      `INSERT INTO logs_api (cliente_id, servicio, endpoint, tokens_input, tokens_output, costo_usd, duracion_ms, modelo, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [clienteId, servicio, endpoint, tokensInput, tokensOutput, costoUsd, duracionMs, modelo, JSON.stringify(metadata)]
    )

    // Actualizar métricas diarias
    await actualizarMetricasDiarias(clienteId, servicio, {
      tokensInput,
      tokensOutput,
      costoUsd,
      duracionMs,
      metadata
    })
  } catch (error) {
    console.error('Error registrando uso API:', error)
  }
}

// Actualizar métricas diarias agregadas
async function actualizarMetricasDiarias(
  clienteId: number,
  servicio: ServicioAPI,
  data: { tokensInput: number; tokensOutput: number; costoUsd: number; duracionMs?: number; metadata?: any }
): Promise<void> {
  const hoy = new Date().toISOString().split('T')[0]

  // Insertar o actualizar registro del día
  await execute(
    `INSERT INTO metricas_api (cliente_id, fecha)
     VALUES ($1, $2)
     ON CONFLICT (cliente_id, fecha) DO NOTHING`,
    [clienteId, hoy]
  )

  // Actualizar según servicio
  switch (servicio) {
    case 'groq':
      await execute(
        `UPDATE metricas_api SET
          groq_requests = groq_requests + 1,
          groq_tokens_input = groq_tokens_input + $3,
          groq_tokens_output = groq_tokens_output + $4,
          groq_costo_usd = groq_costo_usd + $5,
          updated_at = NOW()
         WHERE cliente_id = $1 AND fecha = $2`,
        [clienteId, hoy, data.tokensInput, data.tokensOutput, data.costoUsd]
      )
      break

    case 'jina':
      await execute(
        `UPDATE metricas_api SET
          jina_requests = jina_requests + 1,
          jina_tokens = jina_tokens + $3,
          jina_costo_usd = jina_costo_usd + $4,
          updated_at = NOW()
         WHERE cliente_id = $1 AND fecha = $2`,
        [clienteId, hoy, data.tokensInput, data.costoUsd]
      )
      break

    case 'whisper':
      const segundos = Math.ceil((data.duracionMs || 0) / 1000)
      await execute(
        `UPDATE metricas_api SET
          whisper_segundos = whisper_segundos + $3,
          whisper_costo_usd = whisper_costo_usd + $4,
          updated_at = NOW()
         WHERE cliente_id = $1 AND fecha = $2`,
        [clienteId, hoy, segundos, data.costoUsd]
      )
      break

    case 'vision':
      await execute(
        `UPDATE metricas_api SET
          vision_imagenes = vision_imagenes + 1,
          vision_costo_usd = vision_costo_usd + $3,
          updated_at = NOW()
         WHERE cliente_id = $1 AND fecha = $2`,
        [clienteId, hoy, data.costoUsd]
      )
      break

    case 'elevenlabs':
      await execute(
        `UPDATE metricas_api SET
          elevenlabs_caracteres = elevenlabs_caracteres + $3,
          elevenlabs_costo_usd = elevenlabs_costo_usd + $4,
          updated_at = NOW()
         WHERE cliente_id = $1 AND fecha = $2`,
        [clienteId, hoy, data.metadata?.caracteres || 0, data.costoUsd]
      )
      break

    case 'twilio':
      if (data.metadata?.tipo === 'sms') {
        await execute(
          `UPDATE metricas_api SET
            twilio_sms_enviados = twilio_sms_enviados + 1,
            twilio_costo_usd = twilio_costo_usd + $3,
            updated_at = NOW()
           WHERE cliente_id = $1 AND fecha = $2`,
          [clienteId, hoy, data.costoUsd]
        )
      } else if (data.metadata?.tipo === 'llamada') {
        await execute(
          `UPDATE metricas_api SET
            twilio_minutos_llamada = twilio_minutos_llamada + $3,
            twilio_costo_usd = twilio_costo_usd + $4,
            updated_at = NOW()
           WHERE cliente_id = $1 AND fecha = $2`,
          [clienteId, hoy, data.metadata?.minutos || 0, data.costoUsd]
        )
      }
      break

    case 'whatsapp':
      if (data.metadata?.direccion === 'enviado') {
        await execute(
          `UPDATE metricas_api SET
            whatsapp_mensajes_enviados = whatsapp_mensajes_enviados + 1,
            whatsapp_media_enviada = whatsapp_media_enviada + $3,
            updated_at = NOW()
           WHERE cliente_id = $1 AND fecha = $2`,
          [clienteId, hoy, data.metadata?.media ? 1 : 0]
        )
      } else {
        await execute(
          `UPDATE metricas_api SET
            whatsapp_mensajes_recibidos = whatsapp_mensajes_recibidos + 1,
            updated_at = NOW()
           WHERE cliente_id = $1 AND fecha = $2`,
          [clienteId, hoy]
        )
      }
      break
  }
}

// Calcular costo de Groq
export function calcularCostoGroq(modelo: string, tokensInput: number, tokensOutput: number): number {
  const precios = PRECIOS_API.groq[modelo as keyof typeof PRECIOS_API.groq]
  if (!precios) return 0

  if (typeof precios === 'number') {
    // Whisper - precio por segundo
    return precios * tokensInput
  }

  return (tokensInput / 1000 * precios.input) + (tokensOutput / 1000 * precios.output)
}

// Calcular costo de Jina
export function calcularCostoJina(tokens: number): number {
  return (tokens / 1000) * PRECIOS_API.jina['jina-embeddings-v2-base-es']
}

// Obtener métricas por cliente y rango de fechas
export async function obtenerMetricas(
  clienteId: number | null,
  fechaInicio: string,
  fechaFin: string
): Promise<any[]> {
  const params: any[] = [fechaInicio, fechaFin]
  let whereCliente = ''

  if (clienteId) {
    whereCliente = 'AND cliente_id = $3'
    params.push(clienteId)
  }

  const result = await query(
    `SELECT
      fecha,
      cliente_id,
      groq_requests, groq_tokens_input, groq_tokens_output, groq_costo_usd,
      jina_requests, jina_tokens, jina_costo_usd,
      whisper_segundos, whisper_costo_usd,
      vision_imagenes, vision_costo_usd,
      elevenlabs_caracteres, elevenlabs_costo_usd,
      twilio_sms_enviados, twilio_minutos_llamada, twilio_costo_usd,
      whatsapp_mensajes_enviados, whatsapp_mensajes_recibidos, whatsapp_media_enviada,
      (groq_costo_usd + jina_costo_usd + whisper_costo_usd + vision_costo_usd +
       elevenlabs_costo_usd + twilio_costo_usd) as costo_total
     FROM metricas_api
     WHERE fecha >= $1 AND fecha <= $2 ${whereCliente}
     ORDER BY fecha DESC`,
    params
  )

  return result
}

// Obtener resumen global para super admin
export async function obtenerResumenGlobal(dias: number = 30): Promise<any> {
  const result = await query(
    `SELECT
      SUM(groq_requests) as total_groq_requests,
      SUM(groq_tokens_input + groq_tokens_output) as total_groq_tokens,
      SUM(groq_costo_usd) as total_groq_costo,

      SUM(jina_requests) as total_jina_requests,
      SUM(jina_tokens) as total_jina_tokens,
      SUM(jina_costo_usd) as total_jina_costo,

      SUM(whisper_segundos) as total_whisper_segundos,
      SUM(whisper_costo_usd) as total_whisper_costo,

      SUM(vision_imagenes) as total_vision_imagenes,
      SUM(vision_costo_usd) as total_vision_costo,

      SUM(elevenlabs_caracteres) as total_elevenlabs_caracteres,
      SUM(elevenlabs_costo_usd) as total_elevenlabs_costo,

      SUM(twilio_sms_enviados) as total_twilio_sms,
      SUM(twilio_minutos_llamada) as total_twilio_minutos,
      SUM(twilio_costo_usd) as total_twilio_costo,

      SUM(whatsapp_mensajes_enviados) as total_whatsapp_enviados,
      SUM(whatsapp_mensajes_recibidos) as total_whatsapp_recibidos,

      SUM(groq_costo_usd + jina_costo_usd + whisper_costo_usd + vision_costo_usd +
          elevenlabs_costo_usd + twilio_costo_usd) as costo_total
     FROM metricas_api
     WHERE fecha >= CURRENT_DATE - $1::integer`,
    [dias]
  )

  return result[0] || {}
}

// Obtener métricas por día para gráficos
export async function obtenerMetricasPorDia(dias: number = 30, clienteId?: number): Promise<any[]> {
  const params: any[] = [dias]
  let whereCliente = ''

  if (clienteId) {
    whereCliente = 'AND cliente_id = $2'
    params.push(clienteId)
  }

  return query(
    `SELECT
      fecha,
      SUM(groq_tokens_input + groq_tokens_output) as tokens,
      SUM(groq_costo_usd + jina_costo_usd + whisper_costo_usd + vision_costo_usd +
          elevenlabs_costo_usd + twilio_costo_usd) as costo,
      SUM(whatsapp_mensajes_enviados + whatsapp_mensajes_recibidos) as mensajes
     FROM metricas_api
     WHERE fecha >= CURRENT_DATE - $1::integer ${whereCliente}
     GROUP BY fecha
     ORDER BY fecha ASC`,
    params
  )
}
