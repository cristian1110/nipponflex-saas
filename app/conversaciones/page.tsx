'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Conversacion {
  numero_whatsapp: string
  ultimo_mensaje: string
  total_mensajes: number
  ultimo_texto: string
  ultimo_rol: string
  lead_nombre?: string
  lead_id?: number
}

interface Mensaje {
  id: number
  rol: string
  mensaje: string
  created_at: string
}

export default function ConversacionesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversacion | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [loading, setLoading] = useState(true)
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [showQR, setShowQR] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (selectedConv) {
      loadMensajes(selectedConv.numero_whatsapp)
    }
  }, [selectedConv])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      setUser(data)
      loadData()
      checkWhatsAppStatus()
    } catch { router.push('/login') }
  }

  const loadData = async () => {
    try {
      const res = await fetch('/api/conversaciones')
      const data = await res.json()
      setConversaciones(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const loadMensajes = async (numero: string) => {
    try {
      const res = await fetch(`/api/conversaciones?numero=${numero}`)
      const data = await res.json()
      setMensajes(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
  }

  const checkWhatsAppStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp?action=status')
      const data = await res.json()
      if (data.instance?.state === 'open' || data.state === 'open') {
        setWhatsappStatus('connected')
      } else {
        setWhatsappStatus('disconnected')
      }
    } catch {
      setWhatsappStatus('disconnected')
    }
  }

  const getQRCode = async () => {
    setShowQR(true)
    setQrCode(null)
    try {
      const res = await fetch('/api/whatsapp?action=qr')
      const data = await res.json()
      if (data.base64 || data.qrcode?.base64) {
        setQrCode(data.base64 || data.qrcode?.base64)
      } else if (data.code) {
        setQrCode(data.code)
      }
      // Poll para verificar conexión
      const interval = setInterval(async () => {
        const statusRes = await fetch('/api/whatsapp?action=status')
        const statusData = await statusRes.json()
        if (statusData.instance?.state === 'open' || statusData.state === 'open') {
          setWhatsappStatus('connected')
          setShowQR(false)
          clearInterval(interval)
        }
      }, 3000)
      setTimeout(() => clearInterval(interval), 60000)
    } catch (e) {
      console.error(e)
    }
  }

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim() || !selectedConv) return
    
    try {
      await fetch('/api/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_whatsapp: selectedConv.numero_whatsapp, mensaje: nuevoMensaje })
      })
      setNuevoMensaje('')
      loadMensajes(selectedConv.numero_whatsapp)
    } catch (e) { console.error(e) }
  }

  const formatTime = (date: string) => new Date(date).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (date: string) => new Date(date).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })

  if (loading) return <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Lista de Conversaciones */}
        <div className="w-80 border-r border-[var(--border-color)] flex flex-col">
          {/* Header con Estado WhatsApp */}
          <div className="p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Conversaciones</h1>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${whatsappStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                <div className={`w-2 h-2 rounded-full ${whatsappStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                {whatsappStatus === 'connected' ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
            {whatsappStatus === 'disconnected' && (
              <button onClick={getQRCode} className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Conectar WhatsApp
              </button>
            )}
          </div>

          {/* Búsqueda */}
          <div className="p-3">
            <input type="text" placeholder="Buscar conversación..." className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {conversaciones.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-secondary)]">No hay conversaciones</div>
            ) : (
              conversaciones.map(conv => (
                <div
                  key={conv.numero_whatsapp}
                  onClick={() => setSelectedConv(conv)}
                  className={`p-4 border-b border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors ${selectedConv?.numero_whatsapp === conv.numero_whatsapp ? 'bg-[var(--bg-secondary)]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
                      {(conv.lead_nombre || conv.numero_whatsapp)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-[var(--text-primary)] truncate">{conv.lead_nombre || conv.numero_whatsapp}</span>
                        <span className="text-xs text-[var(--text-tertiary)]">{formatDate(conv.ultimo_mensaje)}</span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] truncate mt-1">{conv.ultimo_texto || 'Sin mensajes'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[var(--text-tertiary)]">{conv.total_mensajes} mensajes</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel de Chat */}
        {selectedConv ? (
          <div className="flex-1 flex flex-col">
            {/* Header Chat */}
            <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
                {(selectedConv.lead_nombre || selectedConv.numero_whatsapp)[0].toUpperCase()}
              </div>
              <div>
                <h2 className="font-bold text-[var(--text-primary)]">{selectedConv.lead_nombre || selectedConv.numero_whatsapp}</h2>
                <p className="text-xs text-[var(--text-secondary)]">{selectedConv.numero_whatsapp}</p>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-secondary)]">
              {mensajes.map(msg => (
                <div key={msg.id} className={`flex ${msg.rol === 'assistant' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-2xl ${msg.rol === 'assistant' ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-bl-md'}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.mensaje}</p>
                    <p className="text-xs opacity-70 mt-1 text-right">{formatTime(msg.created_at)}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[var(--border-color)]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && enviarMensaje()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full text-[var(--text-primary)]"
                />
                <button onClick={enviarMensaje} className="px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[var(--bg-secondary)]">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-[var(--text-primary)]">Selecciona una conversación</h3>
              <p className="text-[var(--text-secondary)] mt-1">Elige un chat para ver los mensajes</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal QR */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-sm text-center">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Escanea el código QR</h3>
            <div className="bg-white p-4 rounded-lg inline-block mb-4">
              {qrCode ? (
                qrCode.startsWith('data:') || qrCode.startsWith('http') ? (
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-500 break-all">{qrCode}</div>
                )
              ) : (
                <div className="w-48 h-48 flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Abre WhatsApp en tu teléfono y escanea este código</p>
            <button onClick={() => setShowQR(false)} className="px-6 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
