'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function IntegracionesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [whatsappInfo, setWhatsappInfo] = useState<any>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      setUser(data)
      checkWhatsAppStatus()
    } catch { router.push('/login') }
    setLoading(false)
  }

  const checkWhatsAppStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp?action=status')
      const data = await res.json()
      console.log('WhatsApp status:', data)
      
      if (data.instance?.state === 'open' || data.state === 'open') {
        setWhatsappStatus('connected')
        // Obtener info del número conectado
        const infoRes = await fetch('/api/whatsapp')
        const infoData = await infoRes.json()
        if (infoData && infoData[0]) {
          setWhatsappInfo(infoData[0])
        }
      } else {
        setWhatsappStatus('disconnected')
      }
    } catch (e) {
      console.error('Error checking status:', e)
      setWhatsappStatus('disconnected')
    }
  }

  const conectarWhatsApp = async () => {
    setShowQRModal(true)
    setWhatsappStatus('connecting')
    setQrCode(null)
    
    try {
      const res = await fetch('/api/whatsapp?action=qr')
      const data = await res.json()
      console.log('QR Response:', data)
      
      if (data.base64) {
        setQrCode(data.base64)
      } else if (data.qrcode?.base64) {
        setQrCode(data.qrcode.base64)
      } else if (data.code) {
        // Si viene como texto, crear QR
        setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(data.code)}`)
      }
      
      // Poll para verificar conexión cada 3 segundos
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch('/api/whatsapp?action=status')
          const statusData = await statusRes.json()
          console.log('Polling status:', statusData)
          
          if (statusData.instance?.state === 'open' || statusData.state === 'open') {
            setWhatsappStatus('connected')
            setShowQRModal(false)
            clearInterval(interval)
            checkWhatsAppStatus()
          }
        } catch (e) {
          console.error('Poll error:', e)
        }
      }, 3000)
      
      // Detener después de 2 minutos
      setTimeout(() => {
        clearInterval(interval)
        if (whatsappStatus === 'connecting') {
          setWhatsappStatus('disconnected')
        }
      }, 120000)
      
    } catch (e) {
      console.error('Error getting QR:', e)
      setWhatsappStatus('disconnected')
    }
  }

  const desconectarWhatsApp = async () => {
    try {
      await fetch('/api/whatsapp?action=logout', { method: 'POST' })
      setWhatsappStatus('disconnected')
      setWhatsappInfo(null)
    } catch (e) {
      console.error('Error disconnecting:', e)
    }
  }

  const integraciones = [
    {
      id: 'whatsapp',
      nombre: 'WhatsApp Business',
      descripcion: 'Conecta tu WhatsApp Business para atender clientes',
      icon: '💬',
      color: 'emerald',
      status: whatsappStatus,
      categoria: 'mensajeria'
    },
    {
      id: 'telegram',
      nombre: 'Telegram Bot',
      descripcion: 'Integra un bot de Telegram para atención',
      icon: '✈️',
      color: 'blue',
      status: 'disconnected',
      categoria: 'mensajeria'
    },
    {
      id: 'instagram',
      nombre: 'Instagram DM',
      descripcion: 'Responde mensajes directos de Instagram',
      icon: '📸',
      color: 'pink',
      status: 'disconnected',
      categoria: 'mensajeria'
    },
    {
      id: 'messenger',
      nombre: 'Facebook Messenger',
      descripcion: 'Atiende clientes desde Messenger',
      icon: '💙',
      color: 'blue',
      status: 'disconnected',
      categoria: 'mensajeria'
    },
    {
      id: 'email',
      nombre: 'Email SMTP',
      descripcion: 'Envía correos y notificaciones',
      icon: '📧',
      color: 'gray',
      status: 'disconnected',
      categoria: 'mensajeria'
    },
    {
      id: 'groq',
      nombre: 'Groq AI',
      descripcion: 'Modelos LLM ultra rápidos',
      icon: '🚀',
      color: 'orange',
      status: 'connected',
      categoria: 'ia'
    },
    {
      id: 'openai',
      nombre: 'OpenAI',
      descripcion: 'GPT-4 y otros modelos',
      icon: '🤖',
      color: 'green',
      status: 'disconnected',
      categoria: 'ia'
    },
    {
      id: 'qdrant',
      nombre: 'Qdrant Vector DB',
      descripcion: 'Base de datos vectorial para RAG',
      icon: '🔮',
      color: 'purple',
      status: 'connected',
      categoria: 'ia'
    },
    {
      id: 'odoo',
      nombre: 'Odoo ERP',
      descripcion: 'Sincroniza contactos, productos y pedidos',
      icon: '🏢',
      color: 'purple',
      status: 'disconnected',
      categoria: 'erp'
    },
    {
      id: 'n8n',
      nombre: 'n8n Workflows',
      descripcion: 'Automatizaciones y flujos de trabajo',
      icon: '⚡',
      color: 'orange',
      status: 'connected',
      categoria: 'automatizacion'
    }
  ]

  const categorias = [
    { id: 'mensajeria', nombre: 'Mensajería', icon: '💬' },
    { id: 'ia', nombre: 'Inteligencia Artificial', icon: '🧠' },
    { id: 'erp', nombre: 'ERP / CRM', icon: '🏢' },
    { id: 'automatizacion', nombre: 'Automatización', icon: '⚡' }
  ]

  if (loading) return <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Integraciones</h1>
            <p className="text-[var(--text-secondary)]">Conecta tus herramientas favoritas</p>
          </div>

          {categorias.map(categoria => (
            <div key={categoria.id} className="mb-8">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <span>{categoria.icon}</span> {categoria.nombre}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integraciones.filter(i => i.categoria === categoria.id).map(integracion => (
                  <div key={integracion.id} className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)]">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-${integracion.color}-500/20 flex items-center justify-center text-2xl`}>
                          {integracion.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-[var(--text-primary)]">{integracion.nombre}</h3>
                          <div className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-1 ${
                            integracion.status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 
                            integracion.status === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${
                              integracion.status === 'connected' ? 'bg-emerald-500' : 
                              integracion.status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                              'bg-gray-500'
                            }`}></div>
                            {integracion.status === 'connected' ? 'Conectado' : 
                             integracion.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-[var(--text-secondary)] mb-4">{integracion.descripcion}</p>

                    {/* Info WhatsApp conectado */}
                    {integracion.id === 'whatsapp' && whatsappStatus === 'connected' && whatsappInfo && (
                      <div className="mb-4 p-3 bg-emerald-500/10 rounded-lg">
                        <p className="text-xs text-emerald-400">Número conectado:</p>
                        <p className="text-sm text-[var(--text-primary)] font-medium">
                          {whatsappInfo.instance?.owner || whatsappInfo.ownerJid || 'WhatsApp Activo'}
                        </p>
                      </div>
                    )}

                    {/* Botón de acción */}
                    {integracion.id === 'whatsapp' ? (
                      whatsappStatus === 'connected' ? (
                        <button 
                          onClick={desconectarWhatsApp}
                          className="w-full px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                        >
                          Desconectar
                        </button>
                      ) : (
                        <button 
                          onClick={conectarWhatsApp}
                          disabled={whatsappStatus === 'connecting'}
                          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {whatsappStatus === 'connecting' ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                              Esperando QR...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              Conectar con QR
                            </>
                          )}
                        </button>
                      )
                    ) : (
                      <button 
                        className={`w-full px-4 py-2 rounded-lg ${
                          integracion.status === 'connected' 
                            ? 'bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {integracion.status === 'connected' ? 'Configurar' : 'Conectar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal QR WhatsApp */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-md text-center">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Conectar WhatsApp</h3>
              <button onClick={() => setShowQRModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            
            <div className="bg-white p-4 rounded-lg inline-block mb-4">
              {qrCode ? (
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex flex-col items-center justify-center">
                  <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full mb-4"></div>
                  <p className="text-gray-500 text-sm">Generando código QR...</p>
                </div>
              )}
            </div>
            
            <div className="space-y-2 text-left mb-4">
              <p className="text-sm text-[var(--text-primary)] font-medium">Pasos para conectar:</p>
              <ol className="text-sm text-[var(--text-secondary)] space-y-1 list-decimal list-inside">
                <li>Abre WhatsApp en tu teléfono</li>
                <li>Toca Menú (⋮) o Configuración</li>
                <li>Selecciona "Dispositivos vinculados"</li>
                <li>Toca "Vincular un dispositivo"</li>
                <li>Escanea este código QR</li>
              </ol>
            </div>
            
            <button onClick={() => setShowQRModal(false)} className="w-full px-6 py-3 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
