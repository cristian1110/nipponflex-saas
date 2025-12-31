'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Lead {
  id: number
  nombre: string
  telefono: string
  email?: string
  empresa?: string
  etapa_id: number
  etapa_nombre?: string
  etapa_color?: string
  valor_estimado: number
  origen?: string
  notas?: string
  total_mensajes: number
  created_at: string
  updated_at: string
}

interface Etapa {
  id: number
  nombre: string
  color: string
  orden: number
  total_leads: number
  valor_total: number
}

interface Mensaje {
  id: number
  rol: string
  mensaje: string
  created_at: string
}

export default function CRMPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewLead, setShowNewLead] = useState(false)
  const [newLead, setNewLead] = useState({ nombre: '', telefono: '', email: '', empresa: '', etapa_id: 0, valor_estimado: 0 })
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (selectedLead) {
      loadMensajes(selectedLead.telefono)
    }
  }, [selectedLead])

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
      const [etapasRes, leadsRes] = await Promise.all([
        fetch('/api/crm/etapas'),
        fetch('/api/crm/leads')
      ])
      const etapasData = await etapasRes.json()
      const leadsData = await leadsRes.json()
      setEtapas(Array.isArray(etapasData) ? etapasData : [])
      setLeads(Array.isArray(leadsData) ? leadsData : [])
      if (etapasData.length > 0 && newLead.etapa_id === 0) {
        setNewLead(prev => ({ ...prev, etapa_id: etapasData[0].id }))
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const loadMensajes = async (telefono: string) => {
    try {
      const res = await fetch(`/api/conversaciones?numero=${telefono}`)
      const data = await res.json()
      setMensajes(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
  }

  const handleDragStart = (lead: Lead) => setDraggedLead(lead)
  
  const handleDrop = async (etapaId: number) => {
    if (!draggedLead || draggedLead.etapa_id === etapaId) return
    
    // Actualizar optimista
    setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, etapa_id: etapaId } : l))
    
    await fetch('/api/crm/leads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draggedLead.id, etapa_id: etapaId })
    })
    
    setDraggedLead(null)
    loadData()
  }

  const crearLead = async () => {
    await fetch('/api/crm/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLead)
    })
    setShowNewLead(false)
    setNewLead({ nombre: '', telefono: '', email: '', empresa: '', etapa_id: etapas[0]?.id || 0, valor_estimado: 0 })
    loadData()
  }

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim() || !selectedLead) return
    
    await fetch('/api/mensajes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_whatsapp: selectedLead.telefono, mensaje: nuevoMensaje })
    })
    
    setNuevoMensaje('')
    loadMensajes(selectedLead.telefono)
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Pipeline Kanban */}
        <div className={`flex-1 flex flex-col overflow-hidden ${selectedLead ? 'w-1/2' : 'w-full'}`}>
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">CRM Pipeline</h1>
              <p className="text-sm text-[var(--text-secondary)]">{leads.length} leads activos</p>
            </div>
            <button onClick={() => setShowNewLead(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
              <span>+</span> Nuevo Lead
            </button>
          </div>

          {/* Kanban */}
          <div className="flex-1 overflow-x-auto p-4">
            <div className="flex gap-4 h-full min-w-max">
              {etapas.map(etapa => (
                <div
                  key={etapa.id}
                  className="w-72 flex-shrink-0 bg-[var(--bg-secondary)] rounded-lg flex flex-col"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(etapa.id)}
                >
                  {/* Header Etapa */}
                  <div className="p-3 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: etapa.color }}></div>
                      <span className="font-medium text-[var(--text-primary)]">{etapa.nombre}</span>
                      <span className="ml-auto text-xs bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--text-secondary)]">
                        {etapa.total_leads || leads.filter(l => l.etapa_id === etapa.id).length}
                      </span>
                    </div>
                    <div className="text-xs text-emerald-500 mt-1">
                      ${Number(etapa.valor_total || leads.filter(l => l.etapa_id === etapa.id).reduce((a, b) => a + Number(b.valor_estimado || 0), 0)).toLocaleString()}
                    </div>
                  </div>

                  {/* Leads */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {leads.filter(l => l.etapa_id === etapa.id).map(lead => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead)}
                        onClick={() => setSelectedLead(lead)}
                        className={`p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all ${selectedLead?.id === lead.id ? 'ring-2 ring-emerald-500' : ''}`}
                      >
                        <div className="font-medium text-[var(--text-primary)] truncate">{lead.nombre || 'Sin nombre'}</div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1">{lead.telefono}</div>
                        {lead.empresa && <div className="text-xs text-[var(--text-tertiary)] mt-1">{lead.empresa}</div>}
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-emerald-500">${Number(lead.valor_estimado || 0).toLocaleString()}</span>
                          {lead.total_mensajes > 0 && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                              {lead.total_mensajes} msgs
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel de Detalles + Chat */}
        {selectedLead && (
          <div className="w-1/2 border-l border-[var(--border-color)] flex flex-col bg-[var(--bg-secondary)]">
            {/* Header Lead */}
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{selectedLead.nombre || 'Sin nombre'}</h2>
                <p className="text-sm text-[var(--text-secondary)]">{selectedLead.telefono}</p>
                {selectedLead.email && <p className="text-xs text-[var(--text-tertiary)]">{selectedLead.email}</p>}
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
            </div>

            {/* Info Rápida */}
            <div className="p-4 border-b border-[var(--border-color)] grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[var(--text-secondary)]">Valor</div>
                <div className="text-emerald-500 font-bold">${Number(selectedLead.valor_estimado || 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-secondary)]">Empresa</div>
                <div className="text-[var(--text-primary)]">{selectedLead.empresa || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-secondary)]">Origen</div>
                <div className="text-[var(--text-primary)]">{selectedLead.origen || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-secondary)]">Mensajes</div>
                <div className="text-[var(--text-primary)]">{selectedLead.total_mensajes || 0}</div>
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mensajes.length === 0 ? (
                <div className="text-center text-[var(--text-secondary)] py-8">No hay mensajes aún</div>
              ) : (
                mensajes.map(msg => (
                  <div key={msg.id} className={`flex ${msg.rol === 'assistant' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg ${msg.rol === 'assistant' ? 'bg-emerald-600 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.mensaje}</p>
                      <p className="text-xs opacity-70 mt-1">{formatTime(msg.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Mensaje */}
            <div className="p-4 border-t border-[var(--border-color)]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && enviarMensaje()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
                <button onClick={enviarMensaje} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  Enviar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nuevo Lead */}
      {showNewLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Nuevo Lead</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Nombre *" value={newLead.nombre} onChange={(e) => setNewLead({ ...newLead, nombre: e.target.value })} className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
              <input type="tel" placeholder="Teléfono *" value={newLead.telefono} onChange={(e) => setNewLead({ ...newLead, telefono: e.target.value })} className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
              <input type="email" placeholder="Email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
              <input type="text" placeholder="Empresa" value={newLead.empresa} onChange={(e) => setNewLead({ ...newLead, empresa: e.target.value })} className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
              <input type="number" placeholder="Valor estimado" value={newLead.valor_estimado || ''} onChange={(e) => setNewLead({ ...newLead, valor_estimado: Number(e.target.value) })} className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
              <select value={newLead.etapa_id} onChange={(e) => setNewLead({ ...newLead, etapa_id: Number(e.target.value) })} className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]">
                {etapas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewLead(false)} className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]">Cancelar</button>
              <button onClick={crearLead} disabled={!newLead.nombre || !newLead.telefono} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
