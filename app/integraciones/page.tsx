'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface WhatsAppStatus {
  connected: boolean
  number?: string
  name?: string
  qrcode?: string
  instance?: string
  disconnectionReason?: string | null
  disconnectedFromDevice?: boolean
  disconnectedByQrLoop?: boolean
  isTemporaryDisconnection?: boolean
  disconnectionMessage?: string | null
}

export default function IntegracionesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('whatsapp')

  // WhatsApp Evolution
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({ connected: false })
  const [waLoading, setWaLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrPolling, setQrPolling] = useState<NodeJS.Timeout | null>(null)

  // Odoo
  const [odooConfig, setOdooConfig] = useState<any>(null)
  const [odooForm, setOdooForm] = useState({ url: '', database: '', username: '', api_key: '' })
  const [testingOdoo, setTestingOdoo] = useState(false)
  const [savingOdoo, setSavingOdoo] = useState(false)
  const [odooTab, setOdooTab] = useState<'config' | 'sync' | 'data'>('config')

  // Google Calendar
  const [gcalStatus, setGcalStatus] = useState<{ connected: boolean; email?: string; configured: boolean }>({ connected: false, configured: false })
  const [gcalLoading, setGcalLoading] = useState(false)
  const [syncingCitas, setSyncingCitas] = useState(false)

  useEffect(() => { checkAuth() }, [])

  useEffect(() => {
    return () => {
      if (qrPolling) clearInterval(qrPolling)
    }
  }, [qrPolling])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
      loadWhatsAppStatus()
      loadOdooConfig()
      loadGoogleCalendarStatus()
    } catch { router.push('/login') }
    setLoading(false)
  }

  // ============ WHATSAPP ============
  const loadWhatsAppStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp?action=status')
      if (res.ok) {
        const data = await res.json()
        setWaStatus({
          connected: data.connected || data.state === 'open',
          number: data.number || data.ownerJid?.replace('@s.whatsapp.net', ''),
          name: data.pushName || data.name,
          instance: data.instance,
          disconnectionReason: data.disconnectionReason,
          disconnectedFromDevice: data.disconnectedFromDevice,
          disconnectedByQrLoop: data.disconnectedByQrLoop,
          isTemporaryDisconnection: data.isTemporaryDisconnection,
          disconnectionMessage: data.disconnectionMessage
        })
      }
    } catch (e) { console.error(e) }
  }

  const connectWhatsApp = async () => {
    setWaLoading(true)
    setShowQR(true)
    try {
      const res = await fetch('/api/whatsapp?action=qr')
      if (res.ok) {
        const data = await res.json()
        if (data.qrcode || data.code || data.base64) {
          setWaStatus(prev => ({ ...prev, qrcode: data.qrcode || data.code || data.base64 }))
          
          // Polling para verificar conexión cada 3 segundos
          const interval = setInterval(async () => {
            const statusRes = await fetch('/api/whatsapp?action=status')
            if (statusRes.ok) {
              const statusData = await statusRes.json()
              if (statusData.connected || statusData.state === 'open') {
                clearInterval(interval)
                setQrPolling(null)
                setShowQR(false)
                setWaLoading(false)
                loadWhatsAppStatus()
              }
            }
          }, 3000)
          
          setQrPolling(interval)
          
          // Timeout después de 2 minutos
          setTimeout(() => {
            clearInterval(interval)
            setQrPolling(null)
            if (!waStatus.connected) {
              setShowQR(false)
              setWaLoading(false)
            }
          }, 120000)
        } else {
          alert('No se pudo obtener el QR. Verifica la configuración de Evolution API.')
          setShowQR(false)
        }
      }
    } catch (e) { 
      console.error(e)
      alert('Error al conectar')
      setShowQR(false)
    }
    setWaLoading(false)
  }

  const disconnectWhatsApp = async () => {
    if (!confirm('¿Desconectar WhatsApp? Tendrás que volver a escanear el QR.')) return
    try {
      await fetch('/api/whatsapp?action=logout', { method: 'POST' })
      setWaStatus({ connected: false })
    } catch (e) { console.error(e) }
  }

  const refreshQR = async () => {
    setWaLoading(true)
    try {
      const res = await fetch('/api/whatsapp?action=qr')
      if (res.ok) {
        const data = await res.json()
        setWaStatus(prev => ({ ...prev, qrcode: data.qrcode || data.code || data.base64 }))
      }
    } catch (e) { console.error(e) }
    setWaLoading(false)
  }

  // ============ ODOO ============
  const loadOdooConfig = async () => {
    try {
      const res = await fetch('/api/integraciones/odoo')
      if (res.ok) {
        const data = await res.json()
        setOdooConfig(data)
        if (data.config) {
          setOdooForm({
            url: data.config.url || '',
            database: data.config.database || '',
            username: data.config.username || '',
            api_key: ''
          })
        }
      }
    } catch (e) { console.error(e) }
  }

  const testOdooConnection = async () => {
    setTestingOdoo(true)
    try {
      const res = await fetch('/api/integraciones/odoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          odoo_url: odooForm.url.replace(/\/$/, ''),
          database: odooForm.database,
          username: odooForm.username,
          api_key: odooForm.api_key,
          action: 'test'
        })
      })
      const data = await res.json()
      if (data.success) {
        alert(`✅ Conexión exitosa!`)
        loadOdooConfig()
      } else {
        alert('❌ ' + (data.error || 'Error de conexión'))
      }
    } catch (e) { alert('Error de conexión') }
    setTestingOdoo(false)
  }

  const saveOdooConfig = async () => {
    setSavingOdoo(true)
    try {
      const res = await fetch('/api/integraciones/odoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          odoo_url: odooForm.url.replace(/\/$/, ''),
          database: odooForm.database,
          username: odooForm.username,
          api_key: odooForm.api_key
        })
      })
      const data = await res.json()
      alert(data.success ? '✅ Configuración guardada' : 'Error: ' + data.error)
      loadOdooConfig()
    } catch (e) { alert('Error al guardar') }
    setSavingOdoo(false)
  }

  // ============ GOOGLE CALENDAR ============
  const loadGoogleCalendarStatus = async () => {
    try {
      const res = await fetch('/api/integraciones/google-calendar')
      if (res.ok) {
        setGcalStatus(await res.json())
      }
    } catch (e) { console.error(e) }
  }

  const connectGoogleCalendar = async () => {
    setGcalLoading(true)
    try {
      const res = await fetch('/api/integraciones/google-calendar?action=auth-url')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        alert(data.error || 'Error obteniendo URL de autorización')
      }
    } catch (e) {
      alert('Error de conexión')
    }
    setGcalLoading(false)
  }

  const disconnectGoogleCalendar = async () => {
    if (!confirm('¿Desconectar Google Calendar?')) return
    try {
      await fetch('/api/integraciones/google-calendar', { method: 'DELETE' })
      setGcalStatus({ connected: false, configured: gcalStatus.configured })
    } catch (e) {
      alert('Error al desconectar')
    }
  }

  const syncCitasToGoogle = async () => {
    setSyncingCitas(true)
    try {
      const res = await fetch('/api/integraciones/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' })
      })
      const data = await res.json()
      if (data.success) {
        alert(`Sincronización completada: ${data.synced} citas sincronizadas, ${data.errors} errores`)
      } else {
        alert('Error: ' + data.error)
      }
    } catch (e) {
      alert('Error de sincronización')
    }
    setSyncingCitas(false)
  }

  // Lista de integraciones
  const integraciones = [
    { id: 'whatsapp', icono: '💬', nombre: 'WhatsApp', desc: 'Evolution API con QR', estado: waStatus.connected, categoria: 'mensajeria' },
    { id: 'odoo', icono: '🟣', nombre: 'Odoo', desc: 'ERP/CRM', estado: odooConfig?.test_exitoso, categoria: 'erp' },
    { id: 'telegram', icono: '✈️', nombre: 'Telegram', desc: 'Bot API', estado: false, prox: true, categoria: 'mensajeria' },
    { id: 'instagram', icono: '📸', nombre: 'Instagram', desc: 'DM API', estado: false, prox: true, categoria: 'mensajeria' },
    { id: 'messenger', icono: '💙', nombre: 'Messenger', desc: 'Facebook Chat', estado: false, prox: true, categoria: 'mensajeria' },
    { id: 'email', icono: '📧', nombre: 'Email', desc: 'Gmail/SMTP', estado: false, prox: true, categoria: 'comunicacion' },
    { id: 'calendar', icono: '📅', nombre: 'Google Calendar', desc: 'Sincronizar citas', estado: gcalStatus.connected, categoria: 'productividad' },
    { id: 'meta', icono: '☁️', nombre: 'Meta Cloud API', desc: 'WhatsApp Business', estado: false, prox: true, categoria: 'mensajeria' },
    { id: 'twilio', icono: '📱', nombre: 'Twilio', desc: 'SMS y WhatsApp', estado: false, prox: true, categoria: 'mensajeria' },
    { id: 'tiktok', icono: '🎵', nombre: 'TikTok', desc: 'Mensajes', estado: false, prox: true, categoria: 'mensajeria' },
    { id: 'stripe', icono: '💳', nombre: 'Stripe', desc: 'Pagos online', estado: false, prox: true, categoria: 'pagos' },
    { id: 'paypal', icono: '🅿️', nombre: 'PayPal', desc: 'Pagos online', estado: false, prox: true, categoria: 'pagos' },
    { id: 'zapier', icono: '⚡', nombre: 'Zapier', desc: 'Automatizaciones', estado: false, prox: true, categoria: 'automatizacion' },
    { id: 'make', icono: '🔄', nombre: 'Make', desc: 'Automatizaciones', estado: false, prox: true, categoria: 'automatizacion' },
    { id: 'slack', icono: '💼', nombre: 'Slack', desc: 'Notificaciones', estado: false, prox: true, categoria: 'comunicacion' },
    { id: 'hubspot', icono: '🟠', nombre: 'HubSpot', desc: 'CRM', estado: false, prox: true, categoria: 'erp' },
    { id: 'sheets', icono: '📊', nombre: 'Google Sheets', desc: 'Hojas de cálculo', estado: false, prox: true, categoria: 'productividad' },
  ]

  const categorias = [
    { id: 'mensajeria', nombre: '💬 Mensajería', integraciones: integraciones.filter(i => i.categoria === 'mensajeria') },
    { id: 'erp', nombre: '🏢 ERP/CRM', integraciones: integraciones.filter(i => i.categoria === 'erp') },
    { id: 'comunicacion', nombre: '📧 Comunicación', integraciones: integraciones.filter(i => i.categoria === 'comunicacion') },
    { id: 'productividad', nombre: '📅 Productividad', integraciones: integraciones.filter(i => i.categoria === 'productividad') },
    { id: 'pagos', nombre: '💳 Pagos', integraciones: integraciones.filter(i => i.categoria === 'pagos') },
    { id: 'automatizacion', nombre: '⚡ Automatización', integraciones: integraciones.filter(i => i.categoria === 'automatizacion') },
  ]

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">🔗 Integraciones</h1>
          <p className="text-sm text-[var(--text-secondary)]">Conecta NipponFlex con tus canales y herramientas</p>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Lista de integraciones */}
          <div className="w-80 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-y-auto">
            <div className="p-3">
              {categorias.map(cat => (
                <div key={cat.id} className="mb-4">
                  <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-2 px-2">{cat.nombre}</h3>
                  <div className="space-y-1">
                    {cat.integraciones.map(int => (
                      <div
                        key={int.id}
                        onClick={() => !int.prox && setActiveTab(int.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          activeTab === int.id 
                            ? 'bg-emerald-600 text-white' 
                            : int.prox 
                              ? 'bg-[var(--bg-primary)] opacity-50 cursor-not-allowed'
                              : 'bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{int.icono}</span>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-medium text-sm truncate ${activeTab === int.id ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                              {int.nombre}
                            </h4>
                            <p className={`text-xs truncate ${activeTab === int.id ? 'text-white/70' : 'text-[var(--text-tertiary)]'}`}>
                              {int.desc}
                            </p>
                          </div>
                          {int.prox ? (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-[9px] rounded shrink-0">Pronto</span>
                          ) : (
                            <span className={`w-2 h-2 rounded-full shrink-0 ${int.estado ? 'bg-emerald-400' : 'bg-gray-400'}`}></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel de configuración */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* WhatsApp */}
            {activeTab === 'whatsapp' && (
              <div className="max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-4xl">💬</span>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">WhatsApp</h2>
                    <p className="text-sm text-[var(--text-secondary)]">Conexión via Evolution API</p>
                  </div>
                </div>

                {/* Estado */}
                <div className={`p-4 rounded-xl mb-6 ${
                  waStatus.connected
                    ? 'bg-emerald-500/20 border border-emerald-500/30'
                    : waStatus.disconnectedFromDevice || waStatus.disconnectedByQrLoop
                      ? 'bg-orange-500/20 border border-orange-500/30'
                      : waStatus.isTemporaryDisconnection
                        ? 'bg-yellow-500/20 border border-yellow-500/30'
                        : 'bg-[var(--bg-secondary)] border border-[var(--border-color)]'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${
                        waStatus.connected
                          ? 'bg-emerald-500 animate-pulse'
                          : waStatus.disconnectedFromDevice || waStatus.disconnectedByQrLoop
                            ? 'bg-orange-500'
                            : waStatus.isTemporaryDisconnection
                              ? 'bg-yellow-500 animate-pulse'
                              : 'bg-gray-400'
                      }`}></div>
                      <div>
                        <p className={`font-medium ${
                          waStatus.connected
                            ? 'text-emerald-400'
                            : waStatus.disconnectedFromDevice || waStatus.disconnectedByQrLoop
                              ? 'text-orange-400'
                              : waStatus.isTemporaryDisconnection
                                ? 'text-yellow-400'
                                : 'text-[var(--text-primary)]'
                        }`}>
                          {waStatus.connected
                            ? '● Conectado'
                            : waStatus.disconnectedFromDevice
                              ? '⚠️ Desconectado desde el dispositivo'
                              : waStatus.disconnectedByQrLoop
                                ? '⚠️ Desconectado (problema detectado)'
                                : waStatus.isTemporaryDisconnection
                                  ? '⏳ Reconectando...'
                                  : '○ Desconectado'}
                        </p>
                        {waStatus.connected && waStatus.number && (
                          <p className="text-sm text-[var(--text-secondary)]">
                            📱 +{waStatus.number} {waStatus.name && `(${waStatus.name})`}
                          </p>
                        )}
                        {!waStatus.connected && waStatus.disconnectionMessage && (
                          <p className={`text-sm ${
                            waStatus.isTemporaryDisconnection ? 'text-yellow-300' : 'text-orange-300'
                          }`}>
                            {waStatus.disconnectionMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    {waStatus.connected ? (
                      <button onClick={disconnectWhatsApp} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30">
                        Desconectar
                      </button>
                    ) : (
                      <button onClick={connectWhatsApp} disabled={waLoading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-emerald-700">
                        {waLoading ? 'Cargando...' : '📲 Reconectar con QR'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Alerta de desconexión */}
                {(waStatus.disconnectedFromDevice || waStatus.disconnectedByQrLoop || waStatus.isTemporaryDisconnection) && !showQR && (
                  <div className={`border rounded-xl p-4 mb-6 ${
                    waStatus.isTemporaryDisconnection
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-orange-500/10 border-orange-500/30'
                  }`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">
                        {waStatus.isTemporaryDisconnection ? '⏳' : waStatus.disconnectedFromDevice ? '📱' : '⚠️'}
                      </span>
                      <div>
                        <h4 className={`font-medium mb-1 ${
                          waStatus.isTemporaryDisconnection ? 'text-yellow-400' : 'text-orange-400'
                        }`}>
                          {waStatus.isTemporaryDisconnection
                            ? 'Conexión temporal perdida'
                            : waStatus.disconnectedFromDevice
                              ? 'WhatsApp desconectado desde tu teléfono'
                              : 'WhatsApp desconectado'}
                        </h4>
                        <p className={`text-sm mb-3 ${
                          waStatus.isTemporaryDisconnection ? 'text-yellow-300/80' : 'text-orange-300/80'
                        }`}>
                          {waStatus.disconnectionMessage || (
                            waStatus.disconnectedFromDevice
                              ? 'Se detectó que cerraste la sesión de WhatsApp Web desde la app de tu teléfono (Ajustes → Dispositivos vinculados → Cerrar sesión).'
                              : waStatus.disconnectedByQrLoop
                                ? 'Se detectó un problema de conexión y se cerró la sesión automáticamente para evitar problemas.'
                                : 'La conexión con WhatsApp se ha perdido.'
                          )}
                        </p>
                        {!waStatus.isTemporaryDisconnection && (
                          <>
                            <p className="text-sm text-orange-300/80 mb-3">
                              Para volver a conectar, haz clic en "Reconectar con QR" y escanea el nuevo código QR.
                            </p>
                            <button
                              onClick={connectWhatsApp}
                              disabled={waLoading}
                              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50"
                            >
                              {waLoading ? 'Cargando...' : '🔄 Reconectar ahora'}
                            </button>
                          </>
                        )}
                        {waStatus.isTemporaryDisconnection && (
                          <p className="text-sm text-yellow-300/80">
                            El sistema está intentando reconectar automáticamente. Si no se reconecta en unos minutos, haz clic en "Reconectar con QR".
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* QR Code */}
                {showQR && (
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-6 text-center border border-[var(--border-color)]">
                    <h3 className="font-medium text-[var(--text-primary)] mb-4">Escanea el código QR con WhatsApp</h3>
                    
                    {waStatus.qrcode ? (
                      <div className="inline-block p-4 bg-white rounded-xl mb-4">
                        <img src={waStatus.qrcode.startsWith('data:') ? waStatus.qrcode : `data:image/png;base64,${waStatus.qrcode}`} alt="QR Code" className="w-64 h-64" />
                      </div>
                    ) : (
                      <div className="inline-block p-4 bg-[var(--bg-primary)] rounded-xl mb-4 w-64 h-64 flex items-center justify-center">
                        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                    
                    <p className="text-sm text-[var(--text-secondary)] mb-2">
                      Abre WhatsApp → Configuración → Dispositivos vinculados → Vincular dispositivo
                    </p>
                    
                    <div className="flex justify-center gap-2 mt-4">
                      <button onClick={refreshQR} disabled={waLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                        🔄 Refrescar QR
                      </button>
                      <button onClick={() => { setShowQR(false); if (qrPolling) clearInterval(qrPolling) }} className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-sm">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Instrucciones */}
                {!waStatus.connected && !showQR && (
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)]">
                    <h3 className="font-medium text-[var(--text-primary)] mb-3">📋 Cómo conectar</h3>
                    <ol className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <li className="flex items-start gap-2">
                        <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">1</span>
                        <span>Haz clic en "Conectar con QR"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">2</span>
                        <span>Abre WhatsApp en tu teléfono</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">3</span>
                        <span>Ve a Configuración → Dispositivos vinculados</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">4</span>
                        <span>Toca "Vincular un dispositivo" y escanea el QR</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">5</span>
                        <span>¡Listo! El agente IA responderá automáticamente</span>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Info cuando está conectado */}
                {waStatus.connected && !showQR && (
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)]">
                    <h3 className="font-medium text-[var(--text-primary)] mb-3">✅ WhatsApp conectado</h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      Tu agente IA está listo para responder mensajes automáticamente. Los mensajes entrantes aparecerán en la sección de Conversaciones.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => router.push('/conversaciones')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
                        💬 Ver Conversaciones
                      </button>
                      <button onClick={() => router.push('/agentes')} className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-sm">
                        🤖 Configurar Agente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Odoo */}
            {activeTab === 'odoo' && (
              <div className="max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-4xl">🟣</span>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">Odoo ERP</h2>
                    <p className="text-sm text-[var(--text-secondary)]">Sincroniza contactos, leads, facturas y más</p>
                  </div>
                </div>

                {/* Tabs Odoo */}
                <div className="flex gap-2 mb-6">
                  <button onClick={() => setOdooTab('config')} className={`px-4 py-2 rounded-lg text-sm ${odooTab === 'config' ? 'bg-purple-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
                    ⚙️ Configuración
                  </button>
                  <button onClick={() => setOdooTab('sync')} className={`px-4 py-2 rounded-lg text-sm ${odooTab === 'sync' ? 'bg-purple-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
                    🔄 Sincronizar
                  </button>
                  <button onClick={() => setOdooTab('data')} className={`px-4 py-2 rounded-lg text-sm ${odooTab === 'data' ? 'bg-purple-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
                    📊 Datos
                  </button>
                </div>

                {odooConfig?.test_exitoso && (
                  <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-400 text-sm mb-6 border border-emerald-500/30">
                    ✅ Conectado • Último test: {new Date(odooConfig.ultimo_test).toLocaleString()}
                  </div>
                )}

                {odooTab === 'config' && (
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] space-y-4">
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">URL de Odoo *</label>
                      <input
                        type="url"
                        value={odooForm.url}
                        onChange={(e) => setOdooForm({ ...odooForm, url: e.target.value })}
                        placeholder="https://tu-empresa.odoo.com"
                        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Base de datos *</label>
                      <input
                        type="text"
                        value={odooForm.database}
                        onChange={(e) => setOdooForm({ ...odooForm, database: e.target.value })}
                        placeholder="nombre_db"
                        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Usuario (email) *</label>
                      <input
                        type="email"
                        value={odooForm.username}
                        onChange={(e) => setOdooForm({ ...odooForm, username: e.target.value })}
                        placeholder="admin@empresa.com"
                        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">API Key *</label>
                      <input
                        type="password"
                        value={odooForm.api_key}
                        onChange={(e) => setOdooForm({ ...odooForm, api_key: e.target.value })}
                        placeholder={odooConfig?.config?.hasApiKey ? '••••••••' : 'Tu API key'}
                        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                      />
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">En Odoo 14+: Configuración → Usuarios → API Keys</p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={testOdooConnection}
                        disabled={testingOdoo || !odooForm.url || !odooForm.database || !odooForm.username}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                      >
                        {testingOdoo ? 'Probando...' : '🔍 Probar'}
                      </button>
                      <button
                        onClick={saveOdooConfig}
                        disabled={savingOdoo || !odooForm.url}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                      >
                        {savingOdoo ? 'Guardando...' : '💾 Guardar'}
                      </button>
                    </div>
                  </div>
                )}

                {odooTab === 'sync' && (
                  <div className="space-y-4">
                    <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)]">
                      <h3 className="font-medium text-[var(--text-primary)] mb-2">👥 Contactos</h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">Sincroniza contactos entre NipponFlex y Odoo</p>
                      <div className="flex gap-2">
                        <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">→ Enviar a Odoo</button>
                        <button className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm">← Traer de Odoo</button>
                      </div>
                    </div>
                    <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)]">
                      <h3 className="font-medium text-[var(--text-primary)] mb-2">🎯 Leads</h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">Sincroniza leads del CRM</p>
                      <div className="flex gap-2">
                        <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">→ Enviar a Odoo</button>
                        <button className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm">← Traer de Odoo</button>
                      </div>
                    </div>
                  </div>
                )}

                {odooTab === 'data' && (
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)]">
                    <h3 className="font-medium text-[var(--text-primary)] mb-4">📊 Explorar Datos de Odoo</h3>
                    <p className="text-sm text-[var(--text-secondary)]">Conecta Odoo primero para ver los datos disponibles.</p>
                  </div>
                )}
              </div>
            )}

            {/* Google Calendar */}
            {activeTab === 'calendar' && (
              <div className="max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-4xl">📅</span>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">Google Calendar</h2>
                    <p className="text-sm text-[var(--text-secondary)]">Sincroniza citas con tu calendario</p>
                  </div>
                </div>

                {/* Estado de conexión */}
                <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${gcalStatus.connected ? 'bg-emerald-400' : 'bg-gray-400'}`}></div>
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">
                          {gcalStatus.connected ? 'Conectado' : 'No conectado'}
                        </span>
                        {gcalStatus.email && (
                          <p className="text-sm text-[var(--text-secondary)]">{gcalStatus.email}</p>
                        )}
                      </div>
                    </div>
                    {gcalStatus.connected ? (
                      <button
                        onClick={disconnectGoogleCalendar}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30"
                      >
                        Desconectar
                      </button>
                    ) : (
                      <button
                        onClick={connectGoogleCalendar}
                        disabled={gcalLoading || !gcalStatus.configured}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                      >
                        {gcalLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Conectando...
                          </>
                        ) : (
                          '🔗 Conectar con Google'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {!gcalStatus.configured && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                    <p className="text-yellow-400 text-sm">
                      <strong>Configuración requerida:</strong> El administrador debe configurar las credenciales de Google OAuth
                      (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) en el servidor.
                    </p>
                  </div>
                )}

                {gcalStatus.connected && (
                  <>
                    {/* Sincronización */}
                    <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] mb-4">
                      <h3 className="font-medium text-[var(--text-primary)] mb-3">🔄 Sincronización</h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-4">
                        Las citas nuevas se sincronizan automáticamente. Usa este botón para sincronizar citas existentes.
                      </p>
                      <button
                        onClick={syncCitasToGoogle}
                        disabled={syncingCitas}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                      >
                        {syncingCitas ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Sincronizando...
                          </>
                        ) : (
                          '📤 Sincronizar citas pendientes'
                        )}
                      </button>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                      <p className="text-blue-400 text-sm">
                        <strong>Sincronización automática:</strong> Cuando creas, editas o eliminas una cita en NipponFlex,
                        se actualiza automáticamente en Google Calendar.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
