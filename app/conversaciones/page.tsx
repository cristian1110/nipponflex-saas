
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { LoadingPage } from '@/components/Loading'
import { formatRelativeTime } from '@/lib/utils'

interface Conversacion {
  numero_whatsapp: string
  nombre: string
  ultimo_mensaje: string
  ultimo_rol: string
  fecha_ultimo: string
  total_mensajes: number
  canal: string
  sin_leer: number
}

interface Mensaje {
  id: number
  rol: 'user' | 'assistant' | 'system'
  mensaje: string
  created_at: string
}

export default function ConversacionesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [conversacionActiva, setConversacionActiva] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMensajes, setLoadingMensajes] = useState(false)
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    const numero = searchParams.get('numero')
    if (numero && conversaciones.length > 0) {
      selectConversacion(numero)
    }
  }, [searchParams, conversaciones])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  useEffect(() => {
    const interval = setInterval(() => {
      loadConversaciones()
      if (conversacionActiva) loadMensajes(conversacionActiva, false)
    }, 10000)
    return () => clearInterval(interval)
  }, [conversacionActiva])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        setUser(await res.json())
        loadConversaciones()
      } else {
        router.push('/login')
      }
    } catch {
      router.push('/login')
    }
  }

  const loadConversaciones = async () => {
    try {
      const res = await fetch('/api/conversaciones')
      if (res.ok) setConversaciones(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadMensajes = async (numero: string, showLoading = true) => {
    if (showLoading) setLoadingMensajes(true)
    try {
      const res = await fetch(`/api/conversaciones/${numero}/mensajes`)
      if (res.ok) setMensajes(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMensajes(false)
    }
  }

  const selectConversacion = (numero: string) => {
    setConversacionActiva(numero)
    loadMensajes(numero)
  }

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim() || !conversacionActiva || enviando) return

    setEnviando(true)
    try {
      const res = await fetch(`/api/conversaciones/${conversacionActiva}/mensajes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: nuevoMensaje }),
      })

      if (res.ok) {
        setNuevoMensaje('')
        loadMensajes(conversacionActiva, false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setEnviando(false)
    }
  }

  const conversacionesFiltradas = conversaciones.filter(c =>
    c.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.numero_whatsapp.includes(searchTerm)
  )

  const conversacionInfo = conversaciones.find(c => c.numero_whatsapp === conversacionActiva)

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />

      <main className="ml-64 flex h-screen">
        {/* Lista de conversaciones */}
        <div className="w-96 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-secondary)]">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-color)]">
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-4">Conversaciones</h1>
            <input
              type="text"
              placeholder="Buscar conversación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {conversacionesFiltradas.length > 0 ? (
              conversacionesFiltradas.map((conv) => (
                <button
                  key={conv.numero_whatsapp}
                  onClick={() => selectConversacion(conv.numero_whatsapp)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-[var(--bg-tertiary)] transition-colors text-left border-b border-[var(--border-color)] ${
                    conversacionActiva === conv.numero_whatsapp ? 'bg-[var(--bg-tertiary)]' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">
                      {conv.canal === 'telegram' ? '✈️' : conv.canal === 'email' ? '📧' : '💬'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        {conv.nombre || conv.numero_whatsapp}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatRelativeTime(conv.fecha_ultimo)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] truncate">
                      {conv.ultimo_rol === 'assistant' && '✓ '}
                      {conv.ultimo_mensaje}
                    </p>
                  </div>
                  {conv.sin_leer > 0 && (
                    <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-xs text-white flex-shrink-0">
                      {conv.sin_leer}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-[var(--text-muted)]">
                No hay conversaciones
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col">
          {conversacionActiva ? (
            <>
              {/* Chat Header */}
              <div className="h-16 px-6 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-lg">💬</span>
                  </div>
                  <div>
                    <h2 className="font-medium text-[var(--text-primary)]">
                      {conversacionInfo?.nombre || conversacionActiva}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">{conversacionActiva}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                    <span>📞</span>
                  </button>
                  <button className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                    <span>⋮</span>
                  </button>
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--bg-primary)]">
                {loadingMensajes ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <>
                    {mensajes.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.rol === 'user' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-3 ${
                            msg.rol === 'user'
                              ? 'chat-bubble-assistant text-[var(--text-primary)]'
                              : 'chat-bubble-user text-white'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.mensaje}</p>
                          <p className={`text-xs mt-1 ${msg.rol === 'user' ? 'text-[var(--text-muted)]' : 'text-white/70'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-3">
                  <button className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                    <span>📎</span>
                  </button>
                  <input
                    type="text"
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensaje()}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  />
                  <button
                    onClick={enviarMensaje}
                    disabled={!nuevoMensaje.trim() || enviando}
                    className="p-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white transition-colors"
                  >
                    {enviando ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>➤</span>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">💬</span>
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  Selecciona una conversación
                </h2>
                <p className="text-[var(--text-muted)]">
                  Elige una conversación de la lista para ver los mensajes
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
