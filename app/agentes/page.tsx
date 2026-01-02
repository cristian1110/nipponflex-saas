'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface TipoAgente {
  id: number
  nombre: string
  icono: string
  descripcion: string
  prompt_base: string
  categoria: string
}

interface Agente {
  id: number
  nombre_agente: string
  nombre_custom: string
  tipo_agente_id: number
  tipo_nombre: string
  tipo_icono: string
  prompt_sistema: string
  temperatura: number
  max_tokens: number
  horario_inicio: string
  horario_fin: string
  mensaje_fuera_horario: string
  opciones_tipo: any
  activo: boolean
}

interface Conocimiento {
  id: number
  nombre_archivo: string
  tipo_archivo: string
  tamano_bytes: number
  estado: string
  created_at: string
}

interface Limites {
  max_agentes: number
  agentes_actuales: number
  puede_crear: boolean
  max_archivos: number
  max_tamano_mb: number
}

export default function AgentesPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRefEdit = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [tiposAgente, setTiposAgente] = useState<TipoAgente[]>([])
  const [conocimientos, setConocimientos] = useState<Conocimiento[]>([])
  const [conocimientosTemp, setConocimientosTemp] = useState<File[]>([])
  const [limites, setLimites] = useState<Limites>({ max_agentes: 1, agentes_actuales: 0, puede_crear: true, max_archivos: 3, max_tamano_mb: 2 })
  
  const [showCrear, setShowCrear] = useState(false)
  const [showEditar, setShowEditar] = useState(false)
  const [selectedAgente, setSelectedAgente] = useState<Agente | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'conocimientos' | 'opciones'>('general')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mejorando, setMejorando] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  
  const [paso, setPaso] = useState(1)
  const [nuevoAgente, setNuevoAgente] = useState({
    tipo_agente_id: 0,
    nombre_custom: '',
    prompt_sistema: '',
    temperatura: 0.7,
    max_tokens: 300,
    horario_inicio: '08:00',
    horario_fin: '20:00',
    mensaje_fuera_horario: 'Gracias por escribirnos. Nuestro horario de atención es de 8am a 8pm. Te responderemos pronto.'
  })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
      await loadData()
    } catch { router.push('/login') }
    setLoading(false)
  }

  const loadData = async () => {
    await Promise.all([loadAgentes(), loadTipos(), loadLimites()])
  }

  const loadAgentes = async () => {
    try {
      const res = await fetch('/api/agentes')
      if (res.ok) setAgentes(await res.json())
    } catch (e) { console.error(e) }
  }

  const loadTipos = async () => {
    try {
      const res = await fetch('/api/agentes/tipos')
      if (res.ok) setTiposAgente(await res.json())
    } catch (e) { console.error(e) }
  }

  const loadLimites = async () => {
    try {
      const res = await fetch('/api/agentes/limites')
      if (res.ok) setLimites(await res.json())
    } catch (e) { console.error(e) }
  }

  const loadConocimientos = async (agenteId: number) => {
    try {
      const res = await fetch(`/api/conocimientos?agente_id=${agenteId}`)
      if (res.ok) setConocimientos(await res.json())
    } catch (e) { console.error(e) }
  }

  const seleccionarTipo = (tipo: TipoAgente) => {
    setNuevoAgente({
      ...nuevoAgente,
      tipo_agente_id: tipo.id,
      nombre_custom: tipo.nombre,
      prompt_sistema: tipo.prompt_base
    })
    setPaso(2)
  }

  const mejorarPrompt = async (isEdit: boolean = false) => {
    const prompt = isEdit ? selectedAgente?.prompt_sistema : nuevoAgente.prompt_sistema
    const tipoNombre = isEdit 
      ? selectedAgente?.tipo_nombre 
      : tiposAgente.find(t => t.id === nuevoAgente.tipo_agente_id)?.nombre

    if (!prompt) {
      setMessage({ type: 'error', text: 'Escribe un prompt primero' })
      return
    }

    setMejorando(true)
    setMessage(null)

    try {
      const res = await fetch('/api/agentes/mejorar-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, tipo_agente: tipoNombre })
      })
      const data = await res.json()

      if (res.ok && data.prompt_mejorado) {
        if (isEdit && selectedAgente) {
          setSelectedAgente({ ...selectedAgente, prompt_sistema: data.prompt_mejorado })
        } else {
          setNuevoAgente({ ...nuevoAgente, prompt_sistema: data.prompt_mejorado })
        }
        setMessage({ type: 'success', text: '✨ Prompt mejorado con IA' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al mejorar prompt' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
    setMejorando(false)
  }

  const agregarArchivoTemp = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > limites.max_tamano_mb * 1024 * 1024) {
      setMessage({ type: 'error', text: `El archivo excede ${limites.max_tamano_mb}MB` })
      return
    }

    if (conocimientosTemp.length >= limites.max_archivos) {
      setMessage({ type: 'error', text: `Máximo ${limites.max_archivos} archivos` })
      return
    }

    setConocimientosTemp([...conocimientosTemp, file])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const eliminarArchivoTemp = (index: number) => {
    setConocimientosTemp(conocimientosTemp.filter((_, i) => i !== index))
  }

  const crearAgente = async () => {
    if (!nuevoAgente.nombre_custom) {
      setMessage({ type: 'error', text: 'El nombre es requerido' })
      return
    }
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/agentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoAgente)
      })
      const data = await res.json()

      if (res.ok) {
        // Subir archivos de conocimiento
        for (const file of conocimientosTemp) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('agente_id', data.id.toString())
          await fetch('/api/conocimientos', { method: 'POST', body: formData })
        }

        setMessage({ type: 'success', text: 'Agente creado correctamente' })
        setShowCrear(false)
        setPaso(1)
        setConocimientosTemp([])
        setNuevoAgente({ tipo_agente_id: 0, nombre_custom: '', prompt_sistema: '', temperatura: 0.7, max_tokens: 300, horario_inicio: '08:00', horario_fin: '20:00', mensaje_fuera_horario: '' })
        loadData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al crear agente' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
    setSaving(false)
  }

  const editarAgente = (agente: Agente) => {
    setSelectedAgente(agente)
    setActiveTab('general')
    loadConocimientos(agente.id)
    setShowEditar(true)
  }

  const guardarAgente = async () => {
    if (!selectedAgente) return
    setSaving(true)
    try {
      const res = await fetch('/api/agentes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedAgente)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Agente actualizado' })
        loadAgentes()
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
    setSaving(false)
  }

  const subirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedAgente) return

    if (file.size > limites.max_tamano_mb * 1024 * 1024) {
      setMessage({ type: 'error', text: `El archivo excede ${limites.max_tamano_mb}MB` })
      return
    }

    setUploading(true)
    setMessage(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('agente_id', selectedAgente.id.toString())

    try {
      const res = await fetch('/api/conocimientos', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: 'Archivo subido' })
        loadConocimientos(selectedAgente.id)
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al subir' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    }
    setUploading(false)
    if (fileInputRefEdit.current) fileInputRefEdit.current.value = ''
  }

  const eliminarConocimiento = async (id: number) => {
    if (!confirm('¿Eliminar este archivo?')) return
    try {
      const res = await fetch(`/api/conocimientos?id=${id}`, { method: 'DELETE' })
      if (res.ok && selectedAgente) {
        setMessage({ type: 'success', text: 'Archivo eliminado' })
        loadConocimientos(selectedAgente.id)
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error al eliminar' })
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getTipoIcon = (tipo: string) => {
    const icons: {[key: string]: string} = { pdf: '📄', docx: '📝', xlsx: '📊', xls: '📊', txt: '📃', csv: '📋' }
    return icons[tipo] || '📎'
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">🤖 Agentes IA</h1>
            <p className="text-sm text-[var(--text-secondary)]">{limites.agentes_actuales} de {limites.max_agentes} agentes creados</p>
          </div>
          {limites.puede_crear && (
            <button
              onClick={() => { setShowCrear(true); setPaso(1); setMessage(null); setConocimientosTemp([]); }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              + Nuevo Agente
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {agentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">No tienes agentes</h2>
              <p className="text-[var(--text-secondary)] mb-4">Crea tu primer agente IA</p>
              <button onClick={() => { setShowCrear(true); setPaso(1); }} className="px-6 py-3 bg-emerald-600 text-white rounded-lg">
                + Crear Agente
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agentes.map(agente => (
                <div
                  key={agente.id}
                  onClick={() => editarAgente(agente)}
                  className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] hover:border-emerald-500 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{agente.tipo_icono || '🤖'}</span>
                      <div>
                        <h3 className="font-bold text-[var(--text-primary)]">{agente.nombre_custom || agente.nombre_agente}</h3>
                        <p className="text-sm text-[var(--text-secondary)]">{agente.tipo_nombre || 'Personalizado'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${agente.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {agente.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-tertiary)] line-clamp-2">{agente.prompt_sistema?.substring(0, 100)}...</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear */}
      {showCrear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {paso === 1 ? '1. Selecciona tipo de agente' : '2. Configurar agente'}
              </h3>
              <button onClick={() => setShowCrear(false)} className="text-2xl text-[var(--text-secondary)]">&times;</button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {message && (
                <div className={`p-3 rounded-lg mb-4 text-sm ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {message.text}
                </div>
              )}

              {paso === 1 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {tiposAgente.map(tipo => (
                    <button key={tipo.id} onClick={() => seleccionarTipo(tipo)} className="p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] hover:border-emerald-500 text-left">
                      <span className="text-3xl">{tipo.icono}</span>
                      <h4 className="font-bold text-[var(--text-primary)] mt-2">{tipo.nombre}</h4>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{tipo.descripcion}</p>
                    </button>
                  ))}
                </div>
              )}

              {paso === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg">
                    <span className="text-3xl">{tiposAgente.find(t => t.id === nuevoAgente.tipo_agente_id)?.icono}</span>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{tiposAgente.find(t => t.id === nuevoAgente.tipo_agente_id)?.nombre}</p>
                      <button onClick={() => setPaso(1)} className="text-xs text-emerald-500">Cambiar tipo</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre del agente *</label>
                    <input
                      type="text"
                      value={nuevoAgente.nombre_custom}
                      onChange={(e) => setNuevoAgente({ ...nuevoAgente, nombre_custom: e.target.value })}
                      placeholder="Ej: Ventas NipponFlex"
                      className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm text-[var(--text-secondary)]">Prompt del sistema</label>
                      <button
                        onClick={() => mejorarPrompt(false)}
                        disabled={mejorando}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50"
                      >
                        {mejorando ? '⏳ Mejorando...' : '✨ Mejorar con IA'}
                      </button>
                    </div>
                    <textarea
                      value={nuevoAgente.prompt_sistema}
                      onChange={(e) => setNuevoAgente({ ...nuevoAgente, prompt_sistema: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm"
                      placeholder="Describe cómo quieres que se comporte tu agente..."
                    />
                  </div>

                  {/* Base de conocimientos */}
                  <div className="p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-[var(--text-primary)]">📚 Base de Conocimientos</h4>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={conocimientosTemp.length >= limites.max_archivos}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                      >
                        + Subir archivo
                      </button>
                      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.txt,.csv" onChange={agregarArchivoTemp} className="hidden" />
                    </div>
                    
                    {conocimientosTemp.length === 0 ? (
                      <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                        Sube PDFs, Excel o TXT con info de tu negocio (precios, productos, FAQs)
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {conocimientosTemp.map((file, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded">
                            <div className="flex items-center gap-2">
                              <span>{getTipoIcon(file.name.split('.').pop() || '')}</span>
                              <span className="text-sm text-[var(--text-primary)]">{file.name}</span>
                              <span className="text-xs text-[var(--text-tertiary)]">({formatBytes(file.size)})</span>
                            </div>
                            <button onClick={() => eliminarArchivoTemp(i)} className="text-red-400 hover:text-red-300">🗑️</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-[var(--text-tertiary)] mt-2">{conocimientosTemp.length}/{limites.max_archivos} archivos (máx {limites.max_tamano_mb}MB c/u)</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Horario inicio</label>
                      <input type="time" value={nuevoAgente.horario_inicio} onChange={(e) => setNuevoAgente({ ...nuevoAgente, horario_inicio: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Horario fin</label>
                      <input type="time" value={nuevoAgente.horario_fin} onChange={(e) => setNuevoAgente({ ...nuevoAgente, horario_fin: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Temperatura: {nuevoAgente.temperatura}</label>
                      <input type="range" min="0" max="1" step="0.1" value={nuevoAgente.temperatura} onChange={(e) => setNuevoAgente({ ...nuevoAgente, temperatura: parseFloat(e.target.value) })} className="w-full" />
                      <div className="flex justify-between text-xs text-[var(--text-tertiary)]"><span>Preciso</span><span>Creativo</span></div>
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Max tokens</label>
                      <input type="number" value={nuevoAgente.max_tokens} onChange={(e) => setNuevoAgente({ ...nuevoAgente, max_tokens: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {paso === 2 && (
              <div className="p-4 border-t border-[var(--border-color)] flex gap-3">
                <button onClick={() => setPaso(1)} className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg">Atrás</button>
                <button onClick={crearAgente} disabled={saving || !nuevoAgente.nombre_custom} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Creando...' : 'Crear Agente'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {showEditar && selectedAgente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedAgente.tipo_icono || '🤖'}</span>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">{selectedAgente.nombre_custom || selectedAgente.nombre_agente}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{selectedAgente.tipo_nombre}</p>
                </div>
              </div>
              <button onClick={() => setShowEditar(false)} className="text-2xl text-[var(--text-secondary)]">&times;</button>
            </div>

            <div className="flex border-b border-[var(--border-color)]">
              {['general', 'conocimientos', 'opciones'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 text-sm ${activeTab === tab ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-[var(--text-secondary)]'}`}>
                  {tab === 'general' && '⚙️ General'}
                  {tab === 'conocimientos' && `📚 Conocimientos (${conocimientos.length})`}
                  {tab === 'opciones' && '🎛️ Opciones'}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto max-h-[55vh]">
              {message && (
                <div className={`p-3 rounded-lg mb-4 text-sm ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {message.text}
                </div>
              )}

              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre</label>
                    <input type="text" value={selectedAgente.nombre_custom || selectedAgente.nombre_agente} onChange={(e) => setSelectedAgente({ ...selectedAgente, nombre_custom: e.target.value, nombre_agente: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm text-[var(--text-secondary)]">Prompt</label>
                      <button onClick={() => mejorarPrompt(true)} disabled={mejorando} className="px-3 py-1 bg-purple-600 text-white rounded text-xs disabled:opacity-50">
                        {mejorando ? '⏳...' : '✨ Mejorar con IA'}
                      </button>
                    </div>
                    <textarea value={selectedAgente.prompt_sistema} onChange={(e) => setSelectedAgente({ ...selectedAgente, prompt_sistema: e.target.value })} rows={5} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Horario inicio</label>
                      <input type="time" value={selectedAgente.horario_inicio || '08:00'} onChange={(e) => setSelectedAgente({ ...selectedAgente, horario_inicio: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Horario fin</label>
                      <input type="time" value={selectedAgente.horario_fin || '20:00'} onChange={(e) => setSelectedAgente({ ...selectedAgente, horario_fin: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Temperatura: {selectedAgente.temperatura}</label>
                      <input type="range" min="0" max="1" step="0.1" value={selectedAgente.temperatura} onChange={(e) => setSelectedAgente({ ...selectedAgente, temperatura: parseFloat(e.target.value) })} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Max tokens</label>
                      <input type="number" value={selectedAgente.max_tokens} onChange={(e) => setSelectedAgente({ ...selectedAgente, max_tokens: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm text-[var(--text-secondary)]">Estado:</label>
                    <button onClick={() => setSelectedAgente({ ...selectedAgente, activo: !selectedAgente.activo })} className={`px-4 py-2 rounded-lg text-sm ${selectedAgente.activo ? 'bg-emerald-600 text-white' : 'bg-red-500/20 text-red-400'}`}>
                      {selectedAgente.activo ? '✓ Activo' : '✗ Inactivo'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'conocimientos' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-[var(--text-secondary)]">{conocimientos.length}/{limites.max_archivos} archivos</p>
                    <button onClick={() => fileInputRefEdit.current?.click()} disabled={uploading || conocimientos.length >= limites.max_archivos} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">
                      {uploading ? 'Subiendo...' : '+ Subir archivo'}
                    </button>
                    <input ref={fileInputRefEdit} type="file" accept=".pdf,.docx,.xlsx,.xls,.txt,.csv" onChange={subirArchivo} className="hidden" />
                  </div>

                  {conocimientos.length === 0 ? (
                    <div className="text-center py-8 bg-[var(--bg-primary)] rounded-lg">
                      <div className="text-4xl mb-2">📚</div>
                      <p className="text-[var(--text-secondary)]">Sin archivos</p>
                      <p className="text-sm text-[var(--text-tertiary)]">Sube PDFs, Excel o TXT</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {conocimientos.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getTipoIcon(c.tipo_archivo)}</span>
                            <div>
                              <p className="text-sm text-[var(--text-primary)]">{c.nombre_archivo}</p>
                              <p className="text-xs text-[var(--text-tertiary)]">{formatBytes(c.tamano_bytes)}</p>
                            </div>
                          </div>
                          <button onClick={() => eliminarConocimiento(c.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded">🗑️</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'opciones' && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🚧</div>
                  <p className="text-[var(--text-secondary)]">Opciones avanzadas próximamente</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-color)] flex gap-3">
              <button onClick={() => setShowEditar(false)} className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg">Cancelar</button>
              <button onClick={guardarAgente} disabled={saving} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
