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
  const [filtro, setFiltro] = useState('')
  const [canalFiltro, setCanalFiltro] = useState('todos')
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
  const formatDate = (date: string) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (d.toDateString() === today.toDateString()) return 'Hoy'
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
  }

  const conversacionesFiltradas = conversaciones.filter(conv => {
    const matchTexto = !filtro || 
      (conv.lead_nombre?.toLowerCase().includes(filtro.toLowerCase())) ||
      conv.numero_whatsapp.includes(filtro)
    return matchTexto
  })

  const canales = [
    { id: 'todos', label: 'Todos', icon: '💬', count: conversaciones.length },
    { id: 'whatsapp', label: 'WhatsApp', icon: '💚', count: conversaciones.length },
    { id: 'telegram', label: 'Telegram', icon: '✈️', count: 0 },
    { id: 'instagram', label: 'Instagram', icon: '📸', count: 0 },
    { id: 'messenger', label: 'Messenger', icon: '💙', count: 0 },
    { id: 'email', label: 'Email', icon: '📧', count: 0 },
  ]

  if (loading) return <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Panel izquierdo - Lista de conversaciones */}
        <div className="w-80 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-secondary)]">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-color)]">
            <h1 className="text-lg font-bold text-[var(--text-primary)] mb-3">Conversaciones</h1>
            
            {/* Filtro por canal */}
            <div className="flex gap-1 overflow-x-auto pb-2 mb-3">
              {canales.map(canal => (
                <button
                  key={canal.id}
                  onClick={() => setCanalFiltro(canal.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                    canalFiltro === canal.id 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <span>{canal.icon}</span>
                  <span>{canal.label}</span>
                  {canal.count > 0 && <span className="bg-white/20 px-1.5 rounded-full">{canal.count}</span>}
                </button>
              ))}
            </div>

            {/* Búsqueda */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Buscar conversación..." 
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" 
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">🔍</span>
            </div>
          </div>

          {/* Lista de conversaciones */}
          <div className="flex-1 overflow-y-auto">
            {conversacionesFiltradas.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-[var(--text-secondary)]">No hay conversaciones</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Las conversaciones aparecerán aquí cuando recibas mensajes</p>
              </div>
            ) : (
              conversacionesFiltradas.map(conv => (
                <div
                  key={conv.numero_whatsapp}
                  onClick={() => setSelectedConv(conv)}
                  className={`p-4 border-b border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors ${
                    selectedConv?.numero_whatsapp === conv.numero_whatsapp ? 'bg-[var(--bg-tertiary)]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white font-bold text-lg">
                        {(conv.lead_nombre || conv.numero_whatsapp)[0].toUpperCase()}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-xs">
                        💬
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-[var(--text-primary)] truncate">
                          {conv.lead_nombre || conv.numero_whatsapp}
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0 ml-2">
                          {formatDate(conv.ultimo_mensaje)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] truncate">
                        {conv.ultimo_rol === 'assistant' && <span className="text-emerald-400">✓ </span>}
                        {conv.ultimo_texto || 'Sin mensajes'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[var(--text-tertiary)]">{conv.numero_whatsapp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel derecho - Chat */}
        {selectedConv ? (
          <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
            {/* Header del chat */}
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white font-bold">
                  {(selectedConv.lead_nombre || selectedConv.numero_whatsapp)[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-[var(--text-primary)]">{selectedConv.lead_nombre || selectedConv.numero_whatsapp}</h2>
                  <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    {selectedConv.numero_whatsapp} • WhatsApp
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)]" title="Ver perfil">
                  👤
                </button>
                <button 
                  onClick={() => router.push(`/crm?lead=${selectedConv.lead_id}`)}
                  className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)]" 
                  title="Ver en CRM"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
              {mensajes.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-[var(--text-secondary)]">No hay mensajes aún</p>
                  </div>
                </div>
              ) : (
                mensajes.map((msg, idx) => {
                  const showDate = idx === 0 || 
                    new Date(mensajes[idx-1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
                  
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="px-3 py-1 bg-[var(--bg-secondary)] rounded-full text-xs text-[var(--text-tertiary)]">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${msg.rol === 'assistant' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${
                          msg.rol === 'assistant' 
                            ? 'bg-emerald-600 text-white rounded-br-md' 
                            : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-md'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.mensaje}</p>
                          <p className={`text-xs mt-1 text-right ${msg.rol === 'assistant' ? 'text-emerald-200' : 'text-[var(--text-tertiary)]'}`}>
                            {formatTime(msg.created_at)}
                            {msg.rol === 'assistant' && ' ✓✓'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de mensaje */}
            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-[var(--bg-tertiary)] rounded-full text-[var(--text-secondary)]">
                  📎
                </button>
                <input
                  type="text"
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && enviarMensaje()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-full text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button className="p-2 hover:bg-[var(--bg-tertiary)] rounded-full text-[var(--text-secondary)]">
                  😊
                </button>
                <button 
                  onClick={enviarMensaje}
                  disabled={!nuevoMensaje.trim()}
                  className="p-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[var(--bg-secondary)]">
            <div className="text-center max-w-md">
              <div className="w-32 h-32 mx-auto mb-6 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center">
                <span className="text-6xl">💬</span>
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Tus conversaciones</h3>
              <p className="text-[var(--text-secondary)]">
                Selecciona una conversación para ver los mensajes o espera a que tus clientes te escriban.
              </p>
              <button 
                onClick={() => router.push('/integraciones')}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 inline-flex items-center gap-2"
              >
                🔗 Configurar canales
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
