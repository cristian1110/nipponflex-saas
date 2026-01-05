import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { configureWebhook, getWebhookConfig, deleteInstance } from '@/lib/evolution'

export const dynamic = 'force-dynamic'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-nipponflex.84.247.166.88.sslip.io'
const EVOLUTION_GLOBAL_KEY = process.env.EVOLUTION_API_KEY || 'FsaZvcT2t2Fv1pc0cmm00QsEQNkIEMSc'

// URL del webhook de nuestra aplicación
const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/whatsapp`
  : 'https://nipponflex.84.247.166.88.sslip.io/api/webhook/whatsapp'

// Obtener instancia de WhatsApp del cliente
async function getClientInstance(clienteId: number): Promise<{ instance: string; apiKey: string } | null> {
  const instancia = await queryOne(
    `SELECT evolution_instance, evolution_api_key FROM instancias_whatsapp
     WHERE cliente_id = $1 AND estado != 'eliminado'
     ORDER BY id LIMIT 1`,
    [clienteId]
  )

  if (instancia?.evolution_instance) {
    return {
      instance: instancia.evolution_instance,
      apiKey: instancia.evolution_api_key || EVOLUTION_GLOBAL_KEY
    }
  }
  return null
}

// Crear nueva instancia para el cliente en Evolution API
async function createInstanceForClient(clienteId: number, instanceName: string): Promise<boolean> {
  try {
    // Crear instancia en Evolution API
    const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_GLOBAL_KEY
      },
      body: JSON.stringify({
        instanceName: instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true
      })
    })

    if (!res.ok) {
      console.error('Error creando instancia:', await res.text())
      return false
    }

    const data = await res.json()
    const apiKey = data.hash?.apikey || EVOLUTION_GLOBAL_KEY

    // Registrar en BD
    await execute(
      `INSERT INTO instancias_whatsapp (cliente_id, nombre, numero_whatsapp, evolution_instance, evolution_api_key, tipo, estado)
       VALUES ($1, $2, '', $3, $4, 'evolution', 'desconectado')
       ON CONFLICT (cliente_id, numero_whatsapp) DO UPDATE SET
         evolution_instance = EXCLUDED.evolution_instance,
         evolution_api_key = EXCLUDED.evolution_api_key`,
      [clienteId, `WhatsApp ${instanceName}`, instanceName, apiKey]
    )

    // Configurar webhook automáticamente (CRÍTICO para detectar desconexiones)
    console.log(`[WhatsApp] Configurando webhook para nueva instancia: ${instanceName}`)
    const webhookResult = await configureWebhook(instanceName, apiKey, WEBHOOK_URL)
    if (!webhookResult.success) {
      console.error(`[WhatsApp] Error configurando webhook: ${webhookResult.error}`)
      // No fallar la creación, el webhook se puede configurar después
    } else {
      console.log(`[WhatsApp] Webhook configurado exitosamente para ${instanceName}`)
    }

    return true
  } catch (e) {
    console.error('Error creando instancia:', e)
    return false
  }
}

// Asegurar que el webhook está configurado para una instancia existente
async function ensureWebhookConfigured(instanceName: string, apiKey: string): Promise<void> {
  try {
    const webhookConfig = await getWebhookConfig(instanceName, apiKey)

    // Si no está configurado o la URL es diferente, configurar
    if (!webhookConfig.configured || webhookConfig.url !== WEBHOOK_URL) {
      console.log(`[WhatsApp] Reconfigurando webhook para ${instanceName}`)
      await configureWebhook(instanceName, apiKey, WEBHOOK_URL)
    }
  } catch (e) {
    console.error(`[WhatsApp] Error verificando webhook: ${e}`)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!user.cliente_id) {
      return NextResponse.json({ error: 'Usuario sin cliente asignado', connected: false }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Obtener instancia del cliente
    let clientInstance = await getClientInstance(user.cliente_id)

    // Si no tiene instancia, crear una nueva
    if (!clientInstance) {
      const instanceName = `cliente_${user.cliente_id}`
      const created = await createInstanceForClient(user.cliente_id, instanceName)
      if (created) {
        clientInstance = await getClientInstance(user.cliente_id)
      }
    }

    if (!clientInstance) {
      return NextResponse.json({
        error: 'No se pudo obtener/crear instancia de WhatsApp',
        connected: false,
        needsSetup: true
      }, { status: 400 })
    }

    const instance = clientInstance.instance
    const apiKey = clientInstance.apiKey

    if (action === 'status') {
      // Primero obtener estado de BD (incluye motivo_desconexion)
      const instanciaDB = await queryOne(
        `SELECT estado, motivo_desconexion FROM instancias_whatsapp
         WHERE cliente_id = $1 AND evolution_instance = $2`,
        [user.cliente_id, instance]
      )

      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?instanceName=${instance}`, {
        headers: { 'apikey': apiKey }
      })
      const data = await res.json()

      if (Array.isArray(data) && data.length > 0) {
        const inst = data[0]
        const isConnected = inst.connectionStatus === 'open'

        // Actualizar estado en BD
        if (isConnected) {
          await execute(
            `UPDATE instancias_whatsapp SET estado = 'conectado', numero_whatsapp = $1, motivo_desconexion = NULL, updated_at = NOW()
             WHERE cliente_id = $2 AND evolution_instance = $3`,
            [inst.number || inst.ownerJid?.split('@')[0] || '', user.cliente_id, instance]
          )
        }

        // Determinar motivo de desconexión para UI
        const motivo = instanciaDB?.motivo_desconexion
        const isDeviceRemoved = motivo === 'device_removed' || motivo === 'manual_reconnect_required'
        const isQrLoop = motivo === 'qr_loop_detected'
        const isTemporary = motivo === 'temporary'

        return NextResponse.json({
          connected: isConnected,
          state: inst.connectionStatus,
          number: inst.number || inst.ownerJid?.split('@')[0],
          name: inst.profileName,
          profilePic: inst.profilePicUrl,
          instance: instance,
          // Info de desconexión desde BD
          disconnectionReason: motivo || null,
          disconnectedFromDevice: isDeviceRemoved,
          disconnectedByQrLoop: isQrLoop,
          isTemporaryDisconnection: isTemporary,
          // Mensaje descriptivo para UI
          disconnectionMessage: isDeviceRemoved
            ? 'Se cerró la sesión desde WhatsApp en tu teléfono'
            : isQrLoop
              ? 'Se detectó un problema de conexión y se cerró la sesión automáticamente'
              : isTemporary
                ? 'Conexión perdida temporalmente, intentando reconectar...'
                : motivo
                  ? `Desconexión: ${motivo}`
                  : null
        })
      }
      // Usar la misma lógica para el estado desconectado
      const motivo = instanciaDB?.motivo_desconexion
      const isDeviceRemoved = motivo === 'device_removed' || motivo === 'manual_reconnect_required'
      const isQrLoop = motivo === 'qr_loop_detected'
      const isTemporary = motivo === 'temporary'

      return NextResponse.json({
        connected: false,
        state: 'disconnected',
        instance,
        disconnectionReason: motivo || null,
        disconnectedFromDevice: isDeviceRemoved,
        disconnectedByQrLoop: isQrLoop,
        isTemporaryDisconnection: isTemporary,
        disconnectionMessage: isDeviceRemoved
          ? 'Se cerró la sesión desde WhatsApp en tu teléfono'
          : isQrLoop
            ? 'Se detectó un problema de conexión y se cerró la sesión automáticamente'
            : isTemporary
              ? 'Conexión perdida temporalmente, intentando reconectar...'
              : null
      })
    }

    if (action === 'qr') {
      const statusRes = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?instanceName=${instance}`, {
        headers: { 'apikey': apiKey }
      })
      const statusData = await statusRes.json()

      if (Array.isArray(statusData) && statusData.length > 0 && statusData[0].connectionStatus === 'open') {
        // Limpiar motivo de desconexión si ya está conectado
        await execute(
          `UPDATE instancias_whatsapp SET motivo_desconexion = NULL WHERE cliente_id = $1 AND evolution_instance = $2`,
          [user.cliente_id, instance]
        )
        return NextResponse.json({
          connected: true,
          number: statusData[0].number,
          name: statusData[0].profileName
        })
      }

      // IMPORTANTE: Asegurar que el webhook está configurado antes de mostrar QR
      // Esto es crítico para detectar desconexiones desde el dispositivo
      await ensureWebhookConfigured(instance, apiKey)

      // Limpiar motivo de desconexión al solicitar nuevo QR (usuario está reconectando)
      await execute(
        `UPDATE instancias_whatsapp SET motivo_desconexion = NULL WHERE cliente_id = $1 AND evolution_instance = $2`,
        [user.cliente_id, instance]
      )

      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${instance}`, {
        headers: { 'apikey': apiKey }
      })
      const data = await res.json()

      // Evolution API devuelve el QR en diferentes formatos según la versión
      const qrCode = data.base64 || data.qrcode?.base64 || data.qr || data.qrcode || null

      console.log('QR Response:', { hasQR: !!qrCode, keys: Object.keys(data) })

      return NextResponse.json({
        connected: false,
        qrcode: qrCode,
        base64: qrCode,
        code: data.code || data.pairingCode || null,
        instance: instance
      })
    }

    const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?instanceName=${instance}`, {
      headers: { 'apikey': apiKey }
    })
    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('Error WhatsApp:', error)
    return NextResponse.json({ error: 'Error de conexión', connected: false }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!user.cliente_id) {
      return NextResponse.json({ error: 'Usuario sin cliente asignado' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Obtener instancia del cliente
    const clientInstance = await getClientInstance(user.cliente_id)
    if (!clientInstance) {
      return NextResponse.json({ error: 'No hay instancia de WhatsApp configurada' }, { status: 400 })
    }

    const instance = clientInstance.instance
    const apiKey = clientInstance.apiKey

    if (action === 'logout') {
      // Eliminar instancia de Evolution API completamente
      const deleteResult = await deleteInstance(instance, apiKey)

      // Eliminar registro de la BD
      await execute(
        `DELETE FROM instancias_whatsapp WHERE cliente_id = $1 AND evolution_instance = $2`,
        [user.cliente_id, instance]
      )

      console.log(`[WhatsApp] Instancia ${instance} eliminada. Evolution: ${deleteResult.success}`)

      return NextResponse.json({ success: true, deleted: deleteResult.success })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    console.error('Error WhatsApp:', error)
    return NextResponse.json({ error: 'Error de conexión' }, { status: 500 })
  }
}
