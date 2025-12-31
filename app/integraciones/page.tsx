'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function IntegracionesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [whatsapp, setWhatsapp] = useState<{
    connected: boolean
    number?: string
    name?: string
    profilePic?: string
  }>({ connected: false })
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
      checkWhatsAppStatus()
    } catch { router.push('/login') }
    setLoading(false)
  }

  const checkWhatsAppStatus = async () => {
    setCheckingStatus(true)
    try {
      const res = await fetch('/api/whatsapp?action=status')
      const data = await res.json()
      console.log('WhatsApp Status:', data)
      
      setWhatsapp({
        connected: data.connected === true,
        number: data.number,
        name: data.name,
        profilePic: data.profilePic
      })
    } catch (e) {
      console.error('Error:', e)
      setWhatsapp({ connected: false })
    }
    setCheckingStatus(false)
  }

  const conectarWhatsApp = async () => {
    setShowQRModal(true)
    setQrCode(null)
    
    try {
      const res = await fetch('/api/whatsapp?action=qr')
      const data = await res.json()
      console.log('QR Response:', data)
      
      if (data.connected) {
        setWhatsapp({
          connected: true,
          number: data.number,
          name: data.name
        })
        setShowQRModal(false)
        return
      }
      
      if (data.qr) {
        setQrCode(data.qr.startsWith('data:') ? data.qr : `data:image/png;base64,${data.qr}`)
      } else if (data.code) {
        setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.code)}`)
      }
      
      // Poll cada 3 segundos
      const interval = setInterval(async () => {
        const statusRes = await fetch('/api/whatsapp?action=status')
        const statusData = await statusRes.json()
        if (statusData.connected) {
          setWhatsapp({
            connected: true,
            number: statusData.number,
            name: statusData.name,
            profilePic: statusData.profilePic
          })
          setShowQRModal(false)
          clearInterval(interval)
        }
      }, 3000)
      
      setTimeout(() => clearInterval(interval), 120000)
    } catch (e) {
      console.error('Error:', e)
    }
  }

  const desconectarWhatsApp = async () => {
    if (!confirm('¿Estás seguro de desconectar WhatsApp? Tendrás que escanear el QR de nuevo.')) return
    
    setActionLoading(true)
    try {
      await fetch('/api/whatsapp?action=logout', { method: 'POST' })
      setWhatsapp({ connected: false })
    } catch (e) {
      console.error('Error:', e)
    }
    setActionLoading(false)
  }

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)]">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Integraciones</h1>
          <p className="text-xs text-[var(--text-secondary)]">Conecta tus canales de comunicación</p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {/* WhatsApp */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">💬 Mensajería</h2>
            
            <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar/Logo */}
                  <div className="relative">
                    {whatsapp.connected && whatsapp.profilePic ? (
                      <img src={whatsapp.profilePic} alt="" className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </div>
                    )}
                    {whatsapp.connected && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[var(--bg-secondary)]"></div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)] text-lg">WhatsApp Business</h3>
                    
                    {whatsapp.connected ? (
                      <>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                          <span className="text-emerald-400 text-sm font-medium">Conectado</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-[var(--text-primary)] font-medium">{whatsapp.name || 'WhatsApp'}</span>
                          <span className="text-[var(--text-secondary)]">•</span>
                          <span className="text-[var(--text-secondary)]">+{whatsapp.number}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                          <span className="text-gray-400 text-sm">Desconectado</span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Conecta tu WhatsApp para recibir mensajes</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={checkWhatsAppStatus}
                    disabled={checkingStatus}
                    className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg"
                    title="Verificar estado"
                  >
                    {checkingStatus ? (
                      <div className="animate-spin h-5 w-5 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full"></div>
                    ) : '🔄'}
                  </button>
                  
                  {whatsapp.connected ? (
                    <button
                      onClick={desconectarWhatsApp}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {actionLoading ? 'Desconectando...' : '🔌 Desconectar'}
                    </button>
                  ) : (
                    <button
                      onClick={conectarWhatsApp}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      📱 Conectar con QR
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Otras integraciones */}
          <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">🔗 Otras Integraciones</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: 'telegram', nombre: 'Telegram', icon: '✈️', status: 'soon' },
              { id: 'instagram', nombre: 'Instagram DM', icon: '📸', status: 'soon' },
              { id: 'messenger', nombre: 'Messenger', icon: '💙', status: 'soon' },
              { id: 'email', nombre: 'Email SMTP', icon: '📧', status: 'soon' },
              { id: 'n8n', nombre: 'n8n Workflows', icon: '⚡', status: 'connected' },
              { id: 'groq', nombre: 'Groq AI', icon: '🚀', status: 'connected' },
            ].map(int => (
              <div key={int.id} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-xl">{int.icon}</div>
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">{int.nombre}</h3>
                    <span className={`text-xs ${int.status === 'connected' ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {int.status === 'connected' ? '● Conectado' : '○ Próximamente'}
                    </span>
                  </div>
                </div>
                <button disabled={int.status === 'soon'} className="w-full py-2 bg-[var(--bg-primary)] rounded-lg text-sm text-[var(--text-secondary)] disabled:opacity-50">
                  {int.status === 'connected' ? 'Configurar' : 'Próximamente'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal QR */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Conectar WhatsApp</h3>
              <button onClick={() => setShowQRModal(false)} className="text-[var(--text-secondary)]">✕</button>
            </div>
            
            <div className="bg-white p-4 rounded-lg mb-4">
              {qrCode ? (
                <img src={qrCode} alt="QR" className="w-full aspect-square" />
              ) : (
                <div className="w-full aspect-square flex flex-col items-center justify-center">
                  <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full mb-3"></div>
                  <p className="text-gray-500 text-sm">Generando QR...</p>
                </div>
              )}
            </div>

            <div className="text-sm text-[var(--text-secondary)] space-y-1 mb-4">
              <p className="font-medium text-[var(--text-primary)]">Pasos:</p>
              <p>1. Abre WhatsApp en tu teléfono</p>
              <p>2. Ve a Configuración → Dispositivos vinculados</p>
              <p>3. Toca "Vincular dispositivo"</p>
              <p>4. Escanea este código QR</p>
            </div>

            <button onClick={() => setShowQRModal(false)} className="w-full py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
