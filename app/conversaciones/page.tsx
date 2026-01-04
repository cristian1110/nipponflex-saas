'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Conversacion {
  id: string
  numero: string
  nombre: string
  ultimo_mensaje: string
  fecha: string
  no_leidos: number
  canal: 'whatsapp' | 'telegram' | 'instagram'
}

interface Mensaje {
  id: string
  texto: string
  rol: 'user' | 'assistant'
  fecha: string
}

export default function ConversacionesPage() {
  const router = useRouter()
  
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversacion | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatNumber, setNewChatNumber] = useState('')
  const [newChatName, setNewChatName] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [showCreateContact, setShowCreateContact] = useState(false)
  const [creatingContact, setCreatingContact] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedConvRef = useRef<Conversacion | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Emojis comunes
  const emojis = ['😀', '😂', '🥰', '😍', '🤔', '👍', '👎', '❤️', '🔥', '✅', '🎉', '🙏', '💯', '⭐', '📷', '🎵', '📍', '💬', '📞', '✨']

  // Mantener referencia actualizada de selectedConv
  useEffect(() => {
    selectedConvRef.current = selectedConv
  }, [selectedConv])

  useEffect(() => {
    // Obtener parámetro de URL
    const params = new URLSearchParams(window.location.search)
    const numero = params.get('numero')
    checkAuth(numero)
  }, [])

  // Polling para actualizar mensajes cada 3 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedConvRef.current) {
        loadMensajes(selectedConvRef.current.numero, true)
      }
      loadConversaciones(true)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const checkAuth = async (numeroInicial?: string | null) => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const userData = await res.json()
      setUser(userData)
      await loadConversaciones()
      
      // Si hay número inicial, abrir esa conversación
      if (numeroInicial) {
        setTimeout(() => abrirConversacionPorNumero(numeroInicial), 500)
        window.history.replaceState({}, '', '/conversaciones')
      }
    } catch { router.push('/login') }
    setLoading(false)
  }

  const loadConversaciones = async (silent = false) => {
    try {
      const res = await fetch('/api/conversaciones')
      const data = await res.json()
      if (Array.isArray(data)) {
        setConversaciones(data)
      }
    } catch (e) {
      if (!silent) console.error('Error cargando conversaciones:', e)
    }
  }

  const loadMensajes = async (numero: string, silent = false) => {
    try {
      const res = await fetch(`/api/conversaciones?numero=${encodeURIComponent(numero)}`)
      const data = await res.json()
      if (data.mensajes && Array.isArray(data.mensajes)) {
        setMensajes(prev => {
          // Solo actualizar si hay nuevos mensajes
          if (data.mensajes.length !== prev.length) {
            return data.mensajes
          }
          return prev
        })
      }
    } catch (e) {
      if (!silent) console.error('Error cargando mensajes:', e)
    }
  }

  const abrirConversacionPorNumero = async (numero: string) => {
    let numNormalizado = numero.replace(/\s/g, '').replace(/-/g, '')
    if (numNormalizado.startsWith('+')) numNormalizado = numNormalizado.substring(1)
    
    const convExistente = conversaciones.find(c => {
      const numConv = c.numero.replace(/\s/g, '').replace(/-/g, '').replace('+', '')
      return numConv.includes(numNormalizado) || numNormalizado.includes(numConv)
    })
    
    if (convExistente) {
      selectConversacion(convExistente)
    } else {
      const numeroFormateado = numero.startsWith('+') ? numero : `+${numero}`
      const nuevaConv: Conversacion = {
        id: `new_${numNormalizado}`,
        numero: numeroFormateado,
        nombre: numeroFormateado,
        ultimo_mensaje: '',
        fecha: new Date().toISOString(),
        no_leidos: 0,
        canal: 'whatsapp'
      }
      setSelectedConv(nuevaConv)
      setMensajes([])
    }
  }

  const selectConversacion = async (conv: Conversacion) => {
    setSelectedConv(conv)
    await loadMensajes(conv.numero)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tamaño (max 16MB)
    if (file.size > 16 * 1024 * 1024) {
      alert('El archivo es muy grande. Maximo 16MB')
      return
    }

    setSelectedFile(file)

    // Crear preview si es imagen
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => setFilePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else if (file.type.startsWith('video/')) {
      setFilePreview('video')
    } else if (file.type.startsWith('audio/')) {
      setFilePreview('audio')
    } else {
      setFilePreview('document')
    }
  }

  const cancelarArchivo = () => {
    setSelectedFile(null)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const insertarEmoji = (emoji: string) => {
    setNuevoMensaje(prev => prev + emoji)
    setShowEmojiPicker(false)
  }

  const enviarMensaje = async () => {
    if ((!nuevoMensaje.trim() && !selectedFile) || !selectedConv) return

    const mensajeTexto = nuevoMensaje
    const archivoEnviar = selectedFile
    setNuevoMensaje('')
    setSelectedFile(null)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setEnviando(true)

    // Agregar mensaje optimistamente
    const textoOptimista = archivoEnviar
      ? (archivoEnviar.type.startsWith('image/') ? '[Enviando imagen...]' : archivoEnviar.type.startsWith('audio/') ? '[Enviando audio...]' : archivoEnviar.type.startsWith('video/') ? '[Enviando video...]' : `[Enviando ${archivoEnviar.name}...]`) + (mensajeTexto ? ` ${mensajeTexto}` : '')
      : mensajeTexto

    const nuevoMsg: Mensaje = {
      id: `temp_${Date.now()}`,
      texto: textoOptimista,
      rol: 'assistant',
      fecha: new Date().toISOString()
    }
    setMensajes(prev => [...prev, nuevoMsg])

    try {
      let res

      if (archivoEnviar) {
        // Enviar con FormData para archivos
        const formData = new FormData()
        formData.append('numero_whatsapp', selectedConv.numero)
        formData.append('mensaje', mensajeTexto)
        formData.append('file', archivoEnviar)

        res = await fetch('/api/mensajes', {
          method: 'POST',
          body: formData
        })
      } else {
        // Enviar texto normal
        res = await fetch('/api/mensajes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero_whatsapp: selectedConv.numero,
            mensaje: mensajeTexto
          })
        })
      }

      if (res.ok) {
        // Recargar mensajes para obtener el ID real
        await loadMensajes(selectedConv.numero)

        if (selectedConv.id.startsWith('new_')) {
          await loadConversaciones()
        }
      } else {
        const data = await res.json()
        alert('Error al enviar: ' + (data.error || 'Intenta de nuevo'))
        // Remover mensaje optimista si fallo
        setMensajes(prev => prev.filter(m => m.id !== nuevoMsg.id))
        setNuevoMensaje(mensajeTexto)
      }
    } catch (e) {
      console.error('Error enviando:', e)
      alert('Error al enviar mensaje')
      setMensajes(prev => prev.filter(m => m.id !== nuevoMsg.id))
      setNuevoMensaje(mensajeTexto)
    }
    setEnviando(false)
  }

  const crearNuevaConversacion = () => {
    if (!newChatNumber.trim()) return

    let numero = newChatNumber.trim()
    if (!numero.startsWith('+')) {
      if (numero.startsWith('593')) numero = '+' + numero
      else if (numero.startsWith('0')) numero = '+593' + numero.substring(1)
      else numero = '+593' + numero
    }

    const nuevaConv: Conversacion = {
      id: `new_${numero.replace('+', '')}`,
      numero: numero,
      nombre: newChatName || numero,
      ultimo_mensaje: '',
      fecha: new Date().toISOString(),
      no_leidos: 0,
      canal: 'whatsapp'
    }

    setSelectedConv(nuevaConv)
    setMensajes([])
    setShowNewChat(false)
    setNewChatNumber('')
    setNewChatName('')
  }

  const crearContactoDesdeConversacion = async () => {
    if (!selectedConv || !newContactName.trim()) return

    setCreatingContact(true)
    try {
      // Crear lead en el CRM
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newContactName.trim(),
          telefono: selectedConv.numero,
          email: newContactEmail.trim() || null,
          origen: 'whatsapp',
          notas: `Contacto creado desde conversación de WhatsApp`
        })
      })

      if (res.ok) {
        alert('Contacto creado correctamente')
        setShowCreateContact(false)
        setNewContactName('')
        setNewContactEmail('')
        // Actualizar el nombre en la conversación localmente
        setSelectedConv(prev => prev ? { ...prev, nombre: newContactName.trim() } : null)
        // Recargar conversaciones
        await loadConversaciones()
      } else {
        const data = await res.json()
        alert('Error al crear contacto: ' + (data.error || 'Intenta de nuevo'))
      }
    } catch (e) {
      console.error(e)
      alert('Error al crear contacto')
    }
    setCreatingContact(false)
  }

  const filteredConversaciones = conversaciones.filter(c =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.numero.includes(searchTerm)
  )

  const formatFecha = (fecha: string) => {
    const date = new Date(fecha)
    const hoy = new Date()
    const ayer = new Date(hoy)
    ayer.setDate(ayer.getDate() - 1)
    
    if (date.toDateString() === hoy.toDateString()) {
      return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    } else if (date.toDateString() === ayer.toDateString()) {
      return 'Ayer'
    } else {
      return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit' })
    }
  }

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Lista de conversaciones */}
        <div className="w-80 border-r border-[var(--border-color)] flex flex-col">
          <div className="p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Conversaciones</h1>
              <button onClick={() => setShowNewChat(true)} className="p-2 bg-emerald-600 rounded-lg text-white text-sm" title="Nueva conversación">
                ✏️
              </button>
            </div>
            <div className="flex gap-2 mb-3 overflow-x-auto">
              <span className="px-2 py-1 bg-emerald-600 text-white rounded-full text-xs whitespace-nowrap">● Todos {conversaciones.length}</span>
              <span className="px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full text-xs whitespace-nowrap">💚 WhatsApp {conversaciones.filter(c => c.canal === 'whatsapp').length}</span>
            </div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Buscar conversación..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" 
              />
              <span className="absolute left-2.5 top-2.5 text-[var(--text-tertiary)]">🔍</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredConversaciones.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-secondary)]">
                <p className="text-sm">No hay conversaciones</p>
                <button onClick={() => setShowNewChat(true)} className="mt-2 text-emerald-500 text-sm hover:underline">+ Nueva conversación</button>
              </div>
            ) : (
              filteredConversaciones.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => selectConversacion(conv)}
                  className={`p-3 border-b border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-secondary)] ${
                    selectedConv?.id === conv.id ? 'bg-[var(--bg-secondary)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                        {conv.nombre.charAt(0).toUpperCase()}
                      </div>
                      {conv.no_leidos > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full text-white text-xs flex items-center justify-center">
                          {conv.no_leidos}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="font-medium text-[var(--text-primary)] truncate">{conv.nombre}</span>
                        <span className="text-xs text-[var(--text-tertiary)] ml-2">{formatFecha(conv.fecha)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-[var(--text-secondary)]">✓</span>
                        <span className="text-sm text-[var(--text-secondary)] truncate">{conv.ultimo_mensaje || 'Sin mensajes'}</span>
                      </div>
                      <span className="text-xs text-[var(--text-tertiary)]">{conv.numero}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Área de chat */}
        <div className="flex-1 flex flex-col">
          {selectedConv ? (
            <>
              {/* Header del chat */}
              <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                  {selectedConv.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h2 className="font-medium text-[var(--text-primary)]">{selectedConv.nombre}</h2>
                  <p className="text-xs text-[var(--text-secondary)]">{selectedConv.numero} • WhatsApp</p>
                </div>
                {/* Botón crear contacto - solo si el nombre es igual al número (no es un contacto conocido) */}
                {(selectedConv.nombre === selectedConv.numero || selectedConv.nombre.startsWith('+')) && (
                  <button
                    onClick={() => { setNewContactName(''); setNewContactEmail(''); setShowCreateContact(true); }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    title="Agregar como contacto"
                  >
                    👤+ Crear contacto
                  </button>
                )}
                <button
                  onClick={() => loadMensajes(selectedConv.numero)}
                  className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg"
                  title="Actualizar"
                >
                  🔄
                </button>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {mensajes.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-[var(--text-secondary)]">
                      <div className="text-4xl mb-2">💬</div>
                      <p>Inicia la conversación</p>
                      <p className="text-xs mt-1">Escribe un mensaje para comenzar</p>
                    </div>
                  </div>
                ) : (
                  mensajes.map(msg => (
                    <div key={msg.id} className={`flex ${msg.rol === 'assistant' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] p-3 rounded-lg ${
                        msg.rol === 'assistant' 
                          ? 'bg-emerald-600 text-white rounded-br-none' 
                          : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-none'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.texto}</p>
                        <p className={`text-[10px] mt-1 ${msg.rol === 'assistant' ? 'text-emerald-100' : 'text-[var(--text-tertiary)]'}`}>
                          {new Date(msg.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          {msg.rol === 'assistant' && ' ✓✓'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Preview de archivo seleccionado */}
              {selectedFile && (
                <div className="px-4 py-2 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-3">
                    {filePreview && filePreview.startsWith('data:image') ? (
                      <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                    ) : filePreview === 'video' ? (
                      <div className="w-16 h-16 bg-blue-500/20 rounded-lg flex items-center justify-center text-2xl">🎬</div>
                    ) : filePreview === 'audio' ? (
                      <div className="w-16 h-16 bg-purple-500/20 rounded-lg flex items-center justify-center text-2xl">🎵</div>
                    ) : (
                      <div className="w-16 h-16 bg-gray-500/20 rounded-lg flex items-center justify-center text-2xl">📄</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">{selectedFile.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={cancelarArchivo} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg">✕</button>
                  </div>
                </div>
              )}

              {/* Input de mensaje */}
              <div className="p-4 border-t border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  {/* Boton adjuntar */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={enviando}
                    className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg disabled:opacity-50"
                    title="Adjuntar archivo"
                  >
                    📎
                  </button>

                  {/* Boton emoji */}
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      disabled={enviando}
                      className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg disabled:opacity-50"
                      title="Emojis"
                    >
                      😀
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-0 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-2 shadow-lg z-10">
                        <div className="grid grid-cols-5 gap-1">
                          {emojis.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => insertarEmoji(emoji)}
                              className="p-2 hover:bg-[var(--bg-tertiary)] rounded text-xl"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensaje()}
                    disabled={enviando}
                    className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full text-sm text-[var(--text-primary)] disabled:opacity-50"
                  />
                  <button
                    onClick={enviarMensaje}
                    disabled={enviando || (!nuevoMensaje.trim() && !selectedFile)}
                    className="p-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {enviando ? '...' : '➤'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">💬</span>
                </div>
                <h2 className="text-xl font-medium text-[var(--text-primary)]">Tus conversaciones</h2>
                <p className="text-[var(--text-secondary)] mt-2">Selecciona una conversación o inicia una nueva</p>
                <button onClick={() => setShowNewChat(true)} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg">
                  ✏️ Nueva conversación
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nueva Conversación */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">Nueva Conversación</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Número de WhatsApp *</label>
                <input
                  type="tel"
                  placeholder="0999999999"
                  value={newChatNumber}
                  onChange={(e) => setNewChatNumber(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Nombre (opcional)</label>
                <input
                  type="text"
                  placeholder="Nombre del contacto"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewChat(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cancelar</button>
              <button onClick={crearNuevaConversacion} disabled={!newChatNumber.trim()} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">Iniciar Chat</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Contacto */}
      {showCreateContact && selectedConv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">👤 Crear Contacto</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Agregar <strong>{selectedConv.numero}</strong> como contacto en el CRM
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Nombre *</label>
                <input
                  type="text"
                  placeholder="Nombre del contacto"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Email (opcional)</label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCreateContact(false)}
                disabled={creatingContact}
                className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={crearContactoDesdeConversacion}
                disabled={!newContactName.trim() || creatingContact}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {creatingContact ? 'Creando...' : 'Crear Contacto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
