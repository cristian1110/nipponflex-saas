'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Agente {
  id: number
  nombre_agente: string
  prompt_sistema: string
  temperatura: number
  max_tokens: number
  activo: boolean
  horario_inicio?: string
  horario_fin?: string
  mensaje_fuera_horario?: string
  created_at: string
}

interface Archivo {
  id: number
  nombre: string
  tipo: string
  size: number
  created_at: string
}

export default function AgentesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingAgente, setEditingAgente] = useState<Agente | null>(null)
  const [archivos, setArchivos] = useState<Archivo[]>([])
  
  const [formData, setFormData] = useState({
    nombre_agente: '',
    prompt_sistema: '',
    temperatura: 0.7,
    max_tokens: 300,
    horario_inicio: '08:00',
    horario_fin: '20:00',
    mensaje_fuera_horario: 'Gracias por tu mensaje. Nuestro horario de atención es de 8:00 AM a 8:00 PM. Te responderemos pronto.',
    activo: true
  })

  const [integraciones, setIntegraciones] = useState({
    whatsapp: true,
    telegram: false,
    instagram: false,
    web: false
  })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      setUser(data)
      loadAgentes()
    } catch { router.push('/login') }
  }

  const loadAgentes = async () => {
    try {
      const res = await fetch('/api/agentes')
      const data = await res.json()
      setAgentes(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const guardarAgente = async () => {
    try {
      const method = editingAgente ? 'PUT' : 'POST'
      const body = editingAgente ? { id: editingAgente.id, ...formData } : formData
      
      await fetch('/api/agentes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      setShowEditor(false)
      setEditingAgente(null)
      resetForm()
      loadAgentes()
    } catch (e) { console.error(e) }
  }

  const editarAgente = (agente: Agente) => {
    setEditingAgente(agente)
    setFormData({
      nombre_agente: agente.nombre_agente,
      prompt_sistema: agente.prompt_sistema || '',
      temperatura: Number(agente.temperatura) || 0.7,
      max_tokens: agente.max_tokens || 300,
      horario_inicio: agente.horario_inicio || '08:00',
      horario_fin: agente.horario_fin || '20:00',
      mensaje_fuera_horario: agente.mensaje_fuera_horario || '',
      activo: agente.activo
    })
    setShowEditor(true)
  }

  const resetForm = () => {
    setFormData({
      nombre_agente: '',
      prompt_sistema: '',
      temperatura: 0.7,
      max_tokens: 300,
      horario_inicio: '08:00',
      horario_fin: '20:00',
      mensaje_fuera_horario: 'Gracias por tu mensaje. Nuestro horario de atención es de 8:00 AM a 8:00 PM. Te responderemos pronto.',
      activo: true
    })
    setArchivos([])
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    const newArchivos: Archivo[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      newArchivos.push({
        id: Date.now() + i,
        nombre: file.name,
        tipo: file.type || file.name.split('.').pop() || 'unknown',
        size: file.size,
        created_at: new Date().toISOString()
      })
    }
    setArchivos([...archivos, ...newArchivos])
  }

  const eliminarArchivo = (id: number) => {
    setArchivos(archivos.filter(a => a.id !== id))
  }

  const getTemperaturaColor = (temp: number) => {
    if (temp <= 0.3) return 'bg-blue-500'
    if (temp <= 0.5) return 'bg-cyan-500'
    if (temp <= 0.7) return 'bg-emerald-500'
    if (temp <= 0.9) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getTemperaturaLabel = (temp: number) => {
    if (temp <= 0.3) return 'Muy preciso'
    if (temp <= 0.5) return 'Conservador'
    if (temp <= 0.7) return 'Balanceado'
    if (temp <= 0.9) return 'Creativo'
    return 'Muy creativo'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (tipo: string) => {
    if (tipo.includes('pdf')) return '📄'
    if (tipo.includes('excel') || tipo.includes('spreadsheet') || tipo.includes('xlsx') || tipo.includes('xls')) return '📊'
    if (tipo.includes('word') || tipo.includes('document') || tipo.includes('docx') || tipo.includes('doc')) return '📝'
    if (tipo.includes('text') || tipo === 'txt') return '📃'
    return '📎'
  }

  if (loading) return <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Agentes IA</h1>
              <p className="text-[var(--text-secondary)]">Configura tus asistentes inteligentes</p>
            </div>
            <button 
              onClick={() => { resetForm(); setEditingAgente(null); setShowEditor(true) }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <span className="text-xl">+</span> Nuevo Agente
            </button>
          </div>

          {/* Lista de Agentes */}
          {!showEditor ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agentes.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-[var(--bg-secondary)] rounded-xl">
                  <div className="text-6xl mb-4">🤖</div>
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">No tienes agentes configurados</h3>
                  <p className="text-[var(--text-secondary)] mt-2">Crea tu primer agente IA para comenzar</p>
                </div>
              ) : (
                agentes.map(agente => (
                  <div key={agente.id} className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)]">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-2xl">
                          🤖
                        </div>
                        <div>
                          <h3 className="font-bold text-[var(--text-primary)]">{agente.nombre_agente}</h3>
                          <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${agente.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {agente.activo ? 'Activo' : 'Inactivo'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-4">
                      {agente.prompt_sistema || 'Sin prompt configurado'}
                    </p>

                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1">
                        <div className="text-xs text-[var(--text-tertiary)] mb-1">Temperatura</div>
                        <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getTemperaturaColor(Number(agente.temperatura))}`}
                            style={{ width: `${Number(agente.temperatura) * 100}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1">{getTemperaturaLabel(Number(agente.temperatura))}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-tertiary)]">Max Tokens</div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">{agente.max_tokens}</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => editarAgente(agente)}
                        className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      >
                        Configurar
                      </button>
                      <button className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                        Probar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Editor de Agente */
            <div className="max-w-4xl mx-auto">
              <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                {/* Header Editor */}
                <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {editingAgente ? 'Editar Agente' : 'Nuevo Agente'}
                  </h2>
                  <button onClick={() => { setShowEditor(false); setEditingAgente(null) }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Nombre y Estado */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Nombre del Agente *</label>
                      <input
                        type="text"
                        value={formData.nombre_agente}
                        onChange={(e) => setFormData({ ...formData, nombre_agente: e.target.value })}
                        placeholder="Ej: Asistente de Ventas"
                        className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Estado</label>
                      <div className="flex items-center gap-4 h-[46px]">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.activo}
                            onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                            className="w-5 h-5 rounded bg-[var(--bg-primary)] border-[var(--border-color)]"
                          />
                          <span className="text-[var(--text-primary)]">Agente Activo</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Prompt del Sistema */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Prompt del Sistema (Identidad del Agente) *</label>
                    <textarea
                      value={formData.prompt_sistema}
                      onChange={(e) => setFormData({ ...formData, prompt_sistema: e.target.value })}
                      placeholder="Eres un asistente de ventas amable y profesional para [empresa]. Tu objetivo es ayudar a los clientes con información sobre productos, precios y resolver sus dudas..."
                      rows={6}
                      className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] resize-none"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{formData.prompt_sistema.length} caracteres</p>
                  </div>

                  {/* Temperatura con Medidor Visual */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Temperatura: <span className={`${getTemperaturaColor(formData.temperatura).replace('bg-', 'text-')}`}>{formData.temperatura.toFixed(1)}</span>
                      <span className="ml-2 text-[var(--text-secondary)] font-normal">({getTemperaturaLabel(formData.temperatura)})</span>
                    </label>
                    <div className="relative">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.temperatura}
                        onChange={(e) => setFormData({ ...formData, temperatura: parseFloat(e.target.value) })}
                        className="w-full h-3 bg-gradient-to-r from-blue-500 via-emerald-500 to-red-500 rounded-full appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
                        <span>Preciso</span>
                        <span>Balanceado</span>
                        <span>Creativo</span>
                      </div>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Máximo de Tokens (longitud respuesta)</label>
                    <input
                      type="number"
                      value={formData.max_tokens}
                      onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                      min={50}
                      max={2000}
                      className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    />
                  </div>

                  {/* Base de Conocimientos */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Base de Conocimientos</label>
                    <div className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-6 text-center">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <div className="text-4xl mb-2">📁</div>
                        <p className="text-[var(--text-primary)] font-medium">Arrastra archivos aquí o haz clic para seleccionar</p>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">PDF, Word, Excel, TXT (máx. 10MB por archivo)</p>
                      </label>
                    </div>

                    {/* Lista de Archivos */}
                    {archivos.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {archivos.map(archivo => (
                          <div key={archivo.id} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{getFileIcon(archivo.tipo)}</span>
                              <div>
                                <p className="text-sm text-[var(--text-primary)]">{archivo.nombre}</p>
                                <p className="text-xs text-[var(--text-tertiary)]">{formatFileSize(archivo.size)}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => eliminarArchivo(archivo.id)}
                              className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-500/20 rounded-lg"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Canales / Integraciones */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Canales Activos</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: 'whatsapp', label: 'WhatsApp', icon: '💬', color: 'emerald' },
                        { key: 'telegram', label: 'Telegram', icon: '✈️', color: 'blue' },
                        { key: 'instagram', label: 'Instagram', icon: '📸', color: 'pink' },
                        { key: 'web', label: 'Web Chat', icon: '🌐', color: 'purple' }
                      ].map(canal => (
                        <label 
                          key={canal.key}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            integraciones[canal.key as keyof typeof integraciones] 
                              ? `bg-${canal.color}-500/20 border-${canal.color}-500` 
                              : 'bg-[var(--bg-primary)] border-[var(--border-color)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={integraciones[canal.key as keyof typeof integraciones]}
                            onChange={(e) => setIntegraciones({ ...integraciones, [canal.key]: e.target.checked })}
                            className="hidden"
                          />
                          <span className="text-xl">{canal.icon}</span>
                          <span className="text-sm text-[var(--text-primary)]">{canal.label}</span>
                          {integraciones[canal.key as keyof typeof integraciones] && (
                            <span className="ml-auto text-emerald-400">✓</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Horario */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Horario Inicio</label>
                      <input
                        type="time"
                        value={formData.horario_inicio}
                        onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
                        className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Horario Fin</label>
                      <input
                        type="time"
                        value={formData.horario_fin}
                        onChange={(e) => setFormData({ ...formData, horario_fin: e.target.value })}
                        className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  {/* Mensaje Fuera de Horario */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Mensaje Fuera de Horario</label>
                    <textarea
                      value={formData.mensaje_fuera_horario}
                      onChange={(e) => setFormData({ ...formData, mensaje_fuera_horario: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] resize-none"
                    />
                  </div>

                  {/* Botones */}
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => { setShowEditor(false); setEditingAgente(null) }}
                      className="flex-1 px-4 py-3 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={guardarAgente}
                      disabled={!formData.nombre_agente || !formData.prompt_sistema}
                      className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {editingAgente ? 'Guardar Cambios' : 'Crear Agente'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
