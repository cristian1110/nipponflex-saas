import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const EVOLUTION_URL = 'https://evolution-api-nipponflex.84.247.166.88.sslip.io'
const EVOLUTION_KEY = 'FsaZvcT2t2Fv1pc0cmm00QsEQNkIEMSc'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const instance = 'nipponflex'

    if (action === 'status') {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?instanceName=${instance}`, {
        headers: { 'apikey': EVOLUTION_KEY }
      })
      const data = await res.json()
      
      if (Array.isArray(data) && data.length > 0) {
        const inst = data[0]
        return NextResponse.json({
          connected: inst.connectionStatus === 'open',
          state: inst.connectionStatus,
          number: inst.number || inst.ownerJid?.split('@')[0],
          name: inst.profileName,
          profilePic: inst.profilePicUrl
        })
      }
      return NextResponse.json({ connected: false, state: 'disconnected' })
    }

    if (action === 'qr') {
      const statusRes = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?instanceName=${instance}`, {
        headers: { 'apikey': EVOLUTION_KEY }
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
        headers: { 'apikey': EVOLUTION_KEY }
      })
      const data = await res.json()
      
      return NextResponse.json({
        connected: false,
        qr: data.base64 || data.qrcode?.base64 || null,
        code: data.code || data.pairingCode || null
      })
    }

    const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?instanceName=${instance}`, {
      headers: { 'apikey': EVOLUTION_KEY }
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

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const instance = 'nipponflex'

    if (action === 'logout') {
      const res = await fetch(`${EVOLUTION_URL}/instance/logout/${instance}`, {
        method: 'DELETE',
        headers: { 'apikey': EVOLUTION_KEY }
      })
      return NextResponse.json({ success: true, data: await res.json() })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    console.error('Error WhatsApp:', error)
    return NextResponse.json({ error: 'Error de conexión' }, { status: 500 })
  }
}
