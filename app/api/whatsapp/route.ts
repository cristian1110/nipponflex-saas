import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'

export const dynamic = 'force-dynamic'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-nipponflex.84.247.166.88.sslip.io'
const EVOLUTION_GLOBAL_KEY = process.env.EVOLUTION_API_KEY || 'FsaZvcT2t2Fv1pc0cmm00QsEQNkIEMSc'

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

    return true
  } catch (e) {
    console.error('Error creando instancia:', e)
    return false
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
            `UPDATE instancias_whatsapp SET estado = 'conectado', numero_whatsapp = $1, updated_at = NOW()
             WHERE cliente_id = $2 AND evolution_instance = $3`,
            [inst.number || inst.ownerJid?.split('@')[0] || '', user.cliente_id, instance]
          )
        }

        return NextResponse.json({
          connected: isConnected,
          state: inst.connectionStatus,
          number: inst.number || inst.ownerJid?.split('@')[0],
          name: inst.profileName,
          profilePic: inst.profilePicUrl,
          instance: instance
        })
      }
      return NextResponse.json({ connected: false, state: 'disconnected', instance })
    }

    if (action === 'qr') {
      const statusRes = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?instanceName=${instance}`, {
        headers: { 'apikey': apiKey }
      })
      const statusData = await statusRes.json()

      if (Array.isArray(statusData) && statusData.length > 0 && statusData[0].connectionStatus === 'open') {
        return NextResponse.json({
          connected: true,
          number: statusData[0].number,
          name: statusData[0].profileName
        })
      }

      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${instance}`, {
        headers: { 'apikey': apiKey }
      })
      const data = await res.json()

      return NextResponse.json({
        connected: false,
        qr: data.base64 || data.qrcode?.base64 || null,
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
      const res = await fetch(`${EVOLUTION_URL}/instance/logout/${instance}`, {
        method: 'DELETE',
        headers: { 'apikey': apiKey }
      })

      // Actualizar estado en BD
      await execute(
        `UPDATE instancias_whatsapp SET estado = 'desconectado', updated_at = NOW()
         WHERE cliente_id = $1 AND evolution_instance = $2`,
        [user.cliente_id, instance]
      )

      return NextResponse.json({ success: true, data: await res.json() })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    console.error('Error WhatsApp:', error)
    return NextResponse.json({ error: 'Error de conexión' }, { status: 500 })
  }
}
