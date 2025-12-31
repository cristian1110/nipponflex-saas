'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
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
  activo: boolean
  usuario_nombre?: string
}

interface Conocimiento {
  id: number
  nombre_archivo: string
  contenido: string
  activo: boolean
}

interface LimitesUsuario {
  max_agentes: number
  agentes_actuales: number
  puede_crear: boolean
}

export default function AgentesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'agentes' | 'conocimientos'>('agentes')
  
  // Agentes
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [tiposAgente, setTiposAgente] = useState<TipoAgente[]>([])
  const [limites, setLimites] = useState<LimitesUsuario>({ max_agentes: 1, agentes_actuales: 0, puede_crear: true })
  const [selectedAgente, setSelectedAgente] = useState<Agente | null>(null)
  const [showNewAgente, setShowNewAgente] = useState(false)
  const [showEditAgente, setShowEditAgente] = useState(false)
  const [showTestAgente, setShowTestAgente] = useState(false)
  
  // Formulario nuevo agente
  const [newAgente, setNewAgente] = useState({
    tipo_agente_id: 0,
    nombre_custom: '',
    prompt_sistema: '',
    temperatura: 0.7,
    max_tokens: 300
  })
  
  // Conocimientos
  const [conocimientos, setConocimientos] = useState<Conocimiento[]>([])
  const [showNewConocimiento, setShowNewConocimiento] = useState(false)
  const [newConocimiento, setNewConocimiento] = useState({ nombre: '', contenido: '' })
  
  // Test
  const [testMessage, setTestMessage] = useState('')
  const [testResponse, setTestResponse] = useState('')
  const [testing, setTesting] = useState(false)
  
  const [saving, setSaving] = useState(false)

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
      loadData()
    } catch { router.push('/login') }
    setLoading(false)
  }

  const loadData = async () => {
    await Promise.all([
      loadAgentes(),
      loadTiposAgente(),
      loadLimites(),
      loadConocimientos()
    ])
  }

  const loadAgentes = async () => {
    try {
      const res = await fetch('/api/agentes')
      if (res.ok) setAgentes(await res.json())
    } catch (e) { console.error(e) }
  }

  const loadTiposAgente = async () => {
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

  const loadConocimientos = async () => {
    try {
      const res = await fetch('/api/agentes/conocimientos')
      if (res.ok) setConocimientos(await res.json())
    } catch (e) { console.error(e) }
  }

  const selectTipoAgente = (tipo: TipoAgente) => {
    setNewAgente({
      ...newAgente,
      tipo_agente_id: tipo.id,
      nombre_custom: tipo.nombre,
      prompt_sistema: tipo.prompt_base
    })
  }

  const crearAgente = async () => {
    if (!newAgente.tipo_agente_id) return
    setSaving(true)
    try {
      const res = await fetch('/api/agentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgente)
      })
      if (res.ok) {
        setShowNewAgente(false)
        setNewAgente({ tipo_agente_id: 0, nombre_custom: '', prompt_sistema: '', temperatura: 0.7, max_tokens: 300 })
        loadData()
      } else {
        const data = await res.json()
        alert(data.error || 'Error al crear agente')
      }
    } catch (e) { alert('Error al crear agente') }
    setSaving(false)
  }

  const actualizarAgente = async () => {
    if (!selectedAgente) return
    setSaving(true)
    try {
      const res = await fetch('/api/agentes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedAgente)
      })
      if (res.ok) {
        setShowEditAgente(false)
        loadAgentes()
        alert('✅ Agente actualizado')
      }
    } catch (e) { alert('Error al actualizar') }
    setSaving(false)
  }

  const toggleAgente = async (id: number, activo: boolean) => {
    try {
      await fetch('/api/agentes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo: !activo })
      })
      loadAgentes()
    } catch (e) { console.error(e) }
  }

  const eliminarAgente = async (id: number) => {
    if (!confirm('¿Eliminar este agente?')) return
    try {
      await fetch(`/api/agentes?id=${id}`, { method: 'DELETE' })
      loadData()
    } catch (e) { console.error(e) }
  }

  const testAgente = async () => {
    if (!testMessage.trim() || !selectedAgente) return
    setTesting(true)
    setTestResponse('')
    try {
      const res = await fetch('/api/agentes/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: testMessage, agente_id: selectedAgente.id })
      })
      const data = await res.json()
      setTestResponse(data.respuesta || data.error)
    } catch (e) { setTestResponse('Error al probar') }
    setTesting(false)
  }

  // Conocimientos
  const addConocimiento = async () => {
    if (!newConocimiento.nombre || !newConocimiento.contenido) return
    try {
      await fetch('/api/agentes/conocimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConocimiento)
      })
      setShowNewConocimiento(false)
      setNewConocimiento({ nombre: '', contenido: '' })
      loadConocimientos()
    } catch (e) { console.error(e) }
  }

  const toggleConocimiento = async (id: number, activo: boolean) => {
    try {
      await fetch('/api/agentes/conocimientos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo: !activo })
      })
      loadConocimientos()
    } catch (e) { console.error(e) }
  }

  const deleteConocimiento = async (id: number) => {
    if (!confirm('¿Eliminar?')) return
    await fetch(`/api/agentes/conocimientos?id=${id}`, { method: 'DELETE' })
    loadConocimientos()
  }

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">🤖 Agentes IA</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {limites.agentes_actuales} de {limites.max_agentes} agentes creados
              </p>
            </div>
            {limites.puede_crear && activeTab === 'agentes' && (
              <button onClick={() => setShowNewAgente(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">
                + Nuevo Agente
              </button>
            )}
          </div>
          
          <div className="flex gap-4 mt-4">
            <button onClick={() => setActiveTab('agentes')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'agentes' ? 'bg-emerald-600 text-white' : 'text-[var(--text-secondary)]'}`}>
              🤖 Mis Agentes ({agentes.length})
            </button>
            <button onClick={() => setActiveTab('conocimientos')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'conocimientos' ? 'bg-emerald-600 text-white' : 'text-[var(--text-secondary)]'}`}>
              📚 Conocimientos ({conocimientos.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Tab Agentes */}
          {activeTab === 'agentes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agentes.length === 0 ? (
                <div className="col-span-full bg-[var(--bg-secondary)] rounded-xl p-8 text-center">
                  <div className="text-6xl mb-4">🤖</div>
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">No tienes agentes</h3>
                  <p className="text-[var(--text-secondary)] mt-2">Crea tu primer agente IA para automatizar conversaciones</p>
                  {limites.puede_crear && (
                    <button onClick={() => setShowNewAgente(true)} className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg">
                      + Crear Agente
                    </button>
                  )}
                </div>
              ) : (
                agentes.map(agente => (
                  <div key={agente.id} className="bg-[var(--bg-secondary)] rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{agente.tipo_icono}</span>
                        <div>
                          <h3 className="font-medium text-[var(--text-primary)]">{agente.nombre_custom || agente.nombre_agente}</h3>
                          <p className="text-xs text-[var(--text-tertiary)]">{agente.tipo_nombre}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${agente.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {agente.activo ? '● Activo' : '● Inactivo'}
                      </span>
                    </div>
                    
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-4">
                      {agente.prompt_sistema?.substring(0, 100)}...
                    </p>
                    
                    {agente.usuario_nombre && (
                      <p className="text-xs text-[var(--text-tertiary)] mb-3">👤 {agente.usuario_nombre}</p>
                    )}
                    
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedAgente(agente); setShowEditAgente(true) }} className="flex-1 px-3 py-1.5 bg-[var(--bg-tertiary)] rounded-lg text-sm text-[var(--text-primary)]">
                        ⚙️ Configurar
                      </button>
                      <button onClick={() => { setSelectedAgente(agente); setShowTestAgente(true) }} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">
                        🧪
                      </button>
                      <button onClick={() => toggleAgente(agente.id, agente.activo)} className="px-3 py-1.5 bg-[var(--bg-tertiary)] rounded-lg text-sm">
                        {agente.activo ? '⏸️' : '▶️'}
                      </button>
                      <button onClick={() => eliminarAgente(agente.id)} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab Conocimientos */}
          {activeTab === 'conocimientos' && (
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">Base de Conocimientos</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Información compartida por todos los agentes</p>
                </div>
                <button onClick={() => setShowNewConocimiento(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
                  + Agregar
                </button>
              </div>

              <div className="space-y-3">
                {conocimientos.length === 0 ? (
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-8 text-center">
                    <div className="text-4xl mb-3">📚</div>
                    <p className="text-[var(--text-secondary)]">No hay conocimientos</p>
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">Agrega catálogos, precios, FAQs, etc.</p>
                  </div>
                ) : (
                  conocimientos.map(c => (
                    <div key={c.id} className="bg-[var(--bg-secondary)] rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-[var(--text-primary)]">{c.nombre_archivo}</h4>
                            <span className={`px-2 py-0.5 rounded text-xs ${c.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                              {c.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">{c.contenido?.substring(0, 150)}...</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button onClick={() => toggleConocimiento(c.id, c.activo)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                            {c.activo ? '⏸️' : '▶️'}
                          </button>
                          <button onClick={() => deleteConocimiento(c.id)} className="p-2 hover:bg-red-500/20 rounded-lg text-red-400">
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nuevo Agente */}
      {showNewAgente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h3 className="font-bold text-[var(--text-primary)] text-lg">Crear Nuevo Agente</h3>
              <button onClick={() => setShowNewAgente(false)} className="text-[var(--text-secondary)]">✕</button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {!newAgente.tipo_agente_id ? (
                <>
                  <p className="text-[var(--text-secondary)] mb-4">Selecciona el tipo de agente:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {tiposAgente.map(tipo => (
                      <div key={tipo.id} onClick={() => selectTipoAgente(tipo)} className="p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] cursor-pointer hover:border-emerald-500 transition-colors">
                        <div className="text-3xl mb-2">{tipo.icono}</div>
                        <h4 className="font-bold text-[var(--text-primary)]">{tipo.nombre}</h4>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">{tipo.descripcion}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg">
                    <span className="text-3xl">{tiposAgente.find(t => t.id === newAgente.tipo_agente_id)?.icono}</span>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{tiposAgente.find(t => t.id === newAgente.tipo_agente_id)?.nombre}</p>
                      <button onClick={() => setNewAgente({ ...newAgente, tipo_agente_id: 0 })} className="text-xs text-emerald-400">Cambiar tipo</button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre del Agente</label>
                    <input type="text" value={newAgente.nombre_custom} onChange={(e) => setNewAgente({ ...newAgente, nombre_custom: e.target.value })} placeholder="Ej: María, Asistente de Ventas..." className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">Instrucciones / Prompt</label>
                    <textarea value={newAgente.prompt_sistema} onChange={(e) => setNewAgente({ ...newAgente, prompt_sistema: e.target.value })} rows={8} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] resize-none text-sm" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Creatividad: {newAgente.temperatura}</label>
                      <input type="range" min="0" max="1" step="0.1" value={newAgente.temperatura} onChange={(e) => setNewAgente({ ...newAgente, temperatura: parseFloat(e.target.value) })} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Max Tokens</label>
                      <input type="number" value={newAgente.max_tokens} onChange={(e) => setNewAgente({ ...newAgente, max_tokens: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <button onClick={() => setShowNewAgente(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]">Cancelar</button>
                    <button onClick={crearAgente} disabled={saving} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                      {saving ? 'Creando...' : 'Crear Agente'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Agente */}
      {showEditAgente && selectedAgente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedAgente.tipo_icono}</span>
                <h3 className="font-bold text-[var(--text-primary)]">Configurar Agente</h3>
              </div>
              <button onClick={() => setShowEditAgente(false)} className="text-[var(--text-secondary)]">✕</button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              <div className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-lg">
                <span className="text-[var(--text-primary)]">Estado del Agente</span>
                <button onClick={() => setSelectedAgente({ ...selectedAgente, activo: !selectedAgente.activo })} className={`w-14 h-7 rounded-full transition-colors relative ${selectedAgente.activo ? 'bg-emerald-600' : 'bg-gray-600'}`}>
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${selectedAgente.activo ? 'right-1' : 'left-1'}`}></span>
                </button>
              </div>
              
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre</label>
                <input type="text" value={selectedAgente.nombre_custom || selectedAgente.nombre_agente} onChange={(e) => setSelectedAgente({ ...selectedAgente, nombre_custom: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
              </div>
              
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Instrucciones</label>
                <textarea value={selectedAgente.prompt_sistema} onChange={(e) => setSelectedAgente({ ...selectedAgente, prompt_sistema: e.target.value })} rows={10} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] resize-none text-sm" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Creatividad: {selectedAgente.temperatura}</label>
                  <input type="range" min="0" max="1" step="0.1" value={selectedAgente.temperatura} onChange={(e) => setSelectedAgente({ ...selectedAgente, temperatura: parseFloat(e.target.value) })} className="w-full" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Max Tokens</label>
                  <input type="number" value={selectedAgente.max_tokens} onChange={(e) => setSelectedAgente({ ...selectedAgente, max_tokens: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <button onClick={() => setShowEditAgente(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]">Cancelar</button>
                <button onClick={actualizarAgente} disabled={saving} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Probar Agente */}
      {showTestAgente && selectedAgente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedAgente.tipo_icono}</span>
                <h3 className="font-bold text-[var(--text-primary)]">Probar {selectedAgente.nombre_custom || selectedAgente.nombre_agente}</h3>
              </div>
              <button onClick={() => { setShowTestAgente(false); setTestResponse('') }} className="text-[var(--text-secondary)]">✕</button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Mensaje de prueba</label>
                <input type="text" value={testMessage} onChange={(e) => setTestMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && testAgente()} placeholder="Ej: Hola, ¿qué productos tienen?" className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
              </div>
              
              <button onClick={testAgente} disabled={testing || !testMessage.trim()} className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                {testing ? 'Procesando...' : '➤ Enviar'}
              </button>
              
              {testResponse && (
                <div className="p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
                  <p className="text-xs text-[var(--text-tertiary)] mb-2">Respuesta:</p>
                  <p className="text-[var(--text-primary)] whitespace-pre-wrap">{testResponse}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Conocimiento */}
      {showNewConocimiento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-lg">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">Agregar Conocimiento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre</label>
                <input type="text" value={newConocimiento.nombre} onChange={(e) => setNewConocimiento({ ...newConocimiento, nombre: e.target.value })} placeholder="Ej: Catálogo, Precios, FAQs..." className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Contenido</label>
                <textarea value={newConocimiento.contenido} onChange={(e) => setNewConocimiento({ ...newConocimiento, contenido: e.target.value })} rows={10} placeholder="Pega la información aquí..." className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewConocimiento(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]">Cancelar</button>
              <button onClick={addConocimiento} disabled={!newConocimiento.nombre || !newConocimiento.contenido} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
