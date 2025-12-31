'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Pipeline {
  id: number
  nombre: string
  descripcion: string
  color: string
  icono: string
  total_leads: number
  total_etapas: number
}

interface Etapa {
  id: number
  nombre: string
  color: string
  orden: number
  es_ganado: boolean
  es_perdido: boolean
  total_leads: number
  valor_total: number
}

interface Lead {
  id: number
  nombre: string
  telefono: string
  email?: string
  empresa?: string
  etapa_id: number
  pipeline_id: number
  valor_estimado: number
  notas?: string
  total_mensajes: number
  created_at: string
}

interface Contacto {
  id: number
  nombre: string
  telefono: string
  email?: string
  empresa?: string
  notas?: string
}

interface Plantilla {
  id: string
  nombre: string
  descripcion: string
  icono: string
  color: string
  etapas: string[]
}

export default function CRMPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pipelines' | 'contactos'>('pipelines')
  
  // Pipelines
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])
  
  // Modals
  const [showNewPipeline, setShowNewPipeline] = useState(false)
  const [showPlantillas, setShowPlantillas] = useState(false)
  const [showNewEtapa, setShowNewEtapa] = useState(false)
  const [showNewLead, setShowNewLead] = useState(false)
  const [showEditPipeline, setShowEditPipeline] = useState(false)
  const [showLeadDetail, setShowLeadDetail] = useState(false)
  
  // Plantillas
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  
  // Forms
  const [newPipeline, setNewPipeline] = useState({ nombre: '', descripcion: '', color: '#3498db', icono: '📊' })
  const [newEtapa, setNewEtapa] = useState({ nombre: '', color: '#3498db' })
  const [newLead, setNewLead] = useState({ nombre: '', telefono: '', email: '', empresa: '', valor_estimado: 0 })
  
  // Contactos con paginación
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [totalContactos, setTotalContactos] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedContactos, setSelectedContactos] = useState<number[]>([])
  const [searchContacto, setSearchContacto] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showNewContacto, setShowNewContacto] = useState(false)
  const [showEditContacto, setShowEditContacto] = useState(false)
  const [editContacto, setEditContacto] = useState<Contacto | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [newContacto, setNewContacto] = useState({ nombre: '', telefono: '', email: '', empresa: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (selectedPipeline) loadPipelineData() }, [selectedPipeline])
  useEffect(() => { if (activeTab === 'contactos') loadContactos() }, [activeTab, currentPage, itemsPerPage])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
      loadPipelines()
      loadPlantillas()
    } catch { router.push('/login') }
    setLoading(false)
  }

  const loadPipelines = async () => {
    const res = await fetch('/api/pipelines')
    const data = await res.json()
    setPipelines(Array.isArray(data) ? data : [])
    if (data.length > 0 && !selectedPipeline) setSelectedPipeline(data[0])
  }

  const loadPlantillas = async () => {
    const res = await fetch('/api/pipelines?plantillas=true')
    setPlantillas(await res.json())
  }

  const loadPipelineData = async () => {
    if (!selectedPipeline) return
    const [etapasRes, leadsRes] = await Promise.all([
      fetch(`/api/crm/etapas?pipeline_id=${selectedPipeline.id}`),
      fetch(`/api/crm/leads?pipeline_id=${selectedPipeline.id}`)
    ])
    setEtapas(await etapasRes.json() || [])
    setLeads(await leadsRes.json() || [])
  }

  const loadContactos = async () => {
    const res = await fetch(`/api/contactos?search=${searchContacto}&page=${currentPage}&limit=${itemsPerPage}`)
    const data = await res.json()
    setContactos(data.contactos || [])
    setTotalContactos(data.total || 0)
    setTotalPages(Math.ceil((data.total || 0) / itemsPerPage))
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadContactos()
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      setSelectedContactos([])
    }
  }

  // Pipeline handlers
  const crearPipelineDesdeTemplate = async (plantillaId: string) => {
    await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plantilla_id: plantillaId })
    })
    setShowPlantillas(false)
    loadPipelines()
  }

  const crearPipelinePersonalizado = async () => {
    await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPipeline)
    })
    setShowNewPipeline(false)
    setNewPipeline({ nombre: '', descripcion: '', color: '#3498db', icono: '📊' })
    loadPipelines()
  }

  const eliminarPipeline = async () => {
    if (!selectedPipeline) return
    if (!confirm(`¿Eliminar pipeline "${selectedPipeline.nombre}" y todos sus leads?`)) return
    await fetch(`/api/pipelines?id=${selectedPipeline.id}`, { method: 'DELETE' })
    setSelectedPipeline(null)
    loadPipelines()
  }

  // Etapa handlers
  const crearEtapa = async () => {
    if (!selectedPipeline) return
    await fetch('/api/crm/etapas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newEtapa, pipeline_id: selectedPipeline.id })
    })
    setShowNewEtapa(false)
    setNewEtapa({ nombre: '', color: '#3498db' })
    loadPipelineData()
  }

  const eliminarEtapa = async (id: number) => {
    if (!confirm('¿Eliminar esta etapa? Los leads se moverán a la primera etapa.')) return
    await fetch(`/api/crm/etapas?id=${id}`, { method: 'DELETE' })
    loadPipelineData()
  }

  // Lead handlers
  const crearLead = async () => {
    if (!selectedPipeline) return
    await fetch('/api/crm/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newLead, pipeline_id: selectedPipeline.id, etapa_id: etapas[0]?.id })
    })
    setShowNewLead(false)
    setNewLead({ nombre: '', telefono: '', email: '', empresa: '', valor_estimado: 0 })
    loadPipelineData()
  }

  const handleDrop = async (etapaId: number) => {
    if (!draggedLead || draggedLead.etapa_id === etapaId) return
    await fetch('/api/crm/leads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draggedLead.id, etapa_id: etapaId })
    })
    setDraggedLead(null)
    loadPipelineData()
  }

  const eliminarLeads = async () => {
    if (selectedLeads.length === 0) return
    if (!confirm(`¿Eliminar ${selectedLeads.length} lead(s)?`)) return
    await fetch('/api/crm/leads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedLeads })
    })
    setSelectedLeads([])
    loadPipelineData()
  }

  const eliminarTodosLeads = async () => {
    if (!selectedPipeline) return
    if (!confirm('¿Eliminar TODOS los leads de este pipeline?')) return
    await fetch('/api/crm/leads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteAll: true, pipeline_id: selectedPipeline.id })
    })
    loadPipelineData()
  }

  const toggleSelectLead = (id: number) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const convertirContactoALead = async (contacto: Contacto) => {
    if (!selectedPipeline || etapas.length === 0) {
      alert('Selecciona un pipeline primero')
      return
    }
    await fetch('/api/crm/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: contacto.nombre,
        telefono: contacto.telefono,
        email: contacto.email,
        empresa: contacto.empresa,
        pipeline_id: selectedPipeline.id,
        etapa_id: etapas[0]?.id
      })
    })
    alert('Contacto agregado al pipeline')
    loadPipelineData()
  }

  // Contactos handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(sheet)
      const contactosData = jsonData.map((row: any) => ({
        nombre: row['Full Name'] || row['Nombre'] || 'Sin nombre',
        telefono: row['Mobile 1'] || row['Telefono'] || row['Phone'] || '',
        email: row['Email'] || '',
        empresa: row['Address'] || row['Empresa'] || ''
      })).filter((c: any) => c.telefono)
      const res = await fetch('/api/contactos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactos: contactosData })
      })
      setImportResult(await res.json())
      loadContactos()
    } catch { setImportResult({ error: 'Error al procesar archivo' }) }
    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const crearContacto = async () => {
    await fetch('/api/contactos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newContacto)
    })
    setShowNewContacto(false)
    setNewContacto({ nombre: '', telefono: '', email: '', empresa: '' })
    loadContactos()
  }

  const actualizarContacto = async () => {
    if (!editContacto) return
    await fetch('/api/contactos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editContacto)
    })
    setShowEditContacto(false)
    setEditContacto(null)
    loadContactos()
  }

  const eliminarContactos = async (ids?: number[]) => {
    const idsToDelete = ids || selectedContactos
    if (idsToDelete.length === 0) return
    if (!confirm(`¿Eliminar ${idsToDelete.length} contacto(s)?`)) return
    await fetch('/api/contactos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idsToDelete })
    })
    setSelectedContactos([])
    loadContactos()
  }

  const eliminarTodosContactos = async () => {
    if (!confirm('¿Eliminar TODOS los contactos?')) return
    await fetch('/api/contactos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteAll: true })
    })
    loadContactos()
  }

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">CRM</h1>
            <div className="flex gap-2">
              <button onClick={() => setActiveTab('pipelines')} className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === 'pipelines' ? 'bg-emerald-600 text-white' : 'text-[var(--text-secondary)]'}`}>
                📊 Pipelines
              </button>
              <button onClick={() => setActiveTab('contactos')} className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === 'contactos' ? 'bg-emerald-600 text-white' : 'text-[var(--text-secondary)]'}`}>
                👥 Contactos ({totalContactos})
              </button>
            </div>
          </div>

          {activeTab === 'pipelines' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {pipelines.map(p => (
                <button key={p.id} onClick={() => setSelectedPipeline(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap flex items-center gap-2 ${selectedPipeline?.id === p.id ? 'text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}
                  style={{ backgroundColor: selectedPipeline?.id === p.id ? p.color : undefined }}>
                  {p.icono} {p.nombre}
                  <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs">{p.total_leads}</span>
                </button>
              ))}
              <button onClick={() => setShowPlantillas(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm whitespace-nowrap">+ Nuevo Pipeline</button>
            </div>
          )}
        </div>

        {/* Pipelines Tab */}
        {activeTab === 'pipelines' && selectedPipeline && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[var(--border-color)] flex items-center gap-2 flex-wrap">
              <span className="text-sm text-[var(--text-secondary)]">{selectedPipeline.descripcion}</span>
              <div className="flex-1"></div>
              {selectedLeads.length > 0 && (
                <button onClick={eliminarLeads} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm">🗑️ Eliminar ({selectedLeads.length})</button>
              )}
              <button onClick={eliminarTodosLeads} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm">🗑️ Vaciar</button>
              <button onClick={() => setShowNewEtapa(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">+ Etapa</button>
              <button onClick={() => setShowNewLead(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">+ Lead</button>
              <button onClick={() => setShowEditPipeline(true)} className="px-2 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg">⚙️</button>
            </div>

            <div className="flex-1 overflow-x-auto p-4">
              <div className="flex gap-3 h-full min-w-max">
                {etapas.map(etapa => (
                  <div key={etapa.id} className="w-72 flex-shrink-0 bg-[var(--bg-secondary)] rounded-lg flex flex-col"
                    onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(etapa.id)}>
                    <div className="p-3 border-b border-[var(--border-color)]">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: etapa.color }}></div>
                        <span className="font-medium text-[var(--text-primary)] text-sm flex-1">{etapa.nombre}</span>
                        {etapa.es_ganado && <span className="text-xs">✅</span>}
                        {etapa.es_perdido && <span className="text-xs">❌</span>}
                        <span className="text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">{etapa.total_leads}</span>
                        <button onClick={() => eliminarEtapa(etapa.id)} className="text-xs text-red-400 opacity-50 hover:opacity-100">×</button>
                      </div>
                      {etapa.valor_total > 0 && <p className="text-xs text-emerald-400 mt-1">${etapa.valor_total.toLocaleString()}</p>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {leads.filter(l => l.etapa_id === etapa.id).map(lead => (
                        <div key={lead.id} draggable onDragStart={() => setDraggedLead(lead)}
                          onClick={() => { setSelectedLead(lead); setShowLeadDetail(true) }}
                          className={`p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer hover:ring-1 hover:ring-emerald-500 ${selectedLeads.includes(lead.id) ? 'ring-2 ring-emerald-500' : ''}`}>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" checked={selectedLeads.includes(lead.id)}
                              onChange={(e) => { e.stopPropagation(); toggleSelectLead(lead.id) }} className="mt-1 rounded" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-[var(--text-primary)] text-sm truncate">{lead.nombre}</div>
                              <div className="text-xs text-[var(--text-secondary)]">{lead.telefono}</div>
                              {lead.empresa && <div className="text-xs text-[var(--text-tertiary)] truncate">{lead.empresa}</div>}
                              <div className="flex items-center gap-2 mt-1">
                                {lead.valor_estimado > 0 && <span className="text-xs text-emerald-400">${lead.valor_estimado}</span>}
                                {lead.total_mensajes > 0 && <span className="text-xs text-blue-400">💬 {lead.total_mensajes}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {etapas.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)]">
                    <div className="text-center">
                      <p>No hay etapas</p>
                      <button onClick={() => setShowNewEtapa(true)} className="mt-2 text-emerald-500 hover:underline">+ Crear etapa</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pipelines' && !selectedPipeline && pipelines.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📊</div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Crea tu primer Pipeline</h2>
              <p className="text-[var(--text-secondary)] mt-2 mb-6">Elige una plantilla o crea uno personalizado</p>
              <button onClick={() => setShowPlantillas(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-lg">Ver Plantillas</button>
            </div>
          </div>
        )}

        {/* Contactos Tab */}
        {activeTab === 'contactos' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-3 flex-wrap">
              <input type="text" placeholder="Buscar..." value={searchContacto}
                onChange={(e) => setSearchContacto(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] w-64" />
              <button onClick={handleSearch} className="px-3 py-1.5 bg-[var(--bg-tertiary)] rounded-lg text-sm">🔍</button>
              <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}
                className="px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
                <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option>
              </select>
              <div className="flex-1"></div>
              {selectedContactos.length > 0 && (
                <button onClick={() => eliminarContactos()} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm">🗑️ Eliminar ({selectedContactos.length})</button>
              )}
              <button onClick={eliminarTodosContactos} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm">🗑️ Todos</button>
              <button onClick={() => setShowImport(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">📥 Importar</button>
              <button onClick={() => setShowNewContacto(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">+ Nuevo</button>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-[var(--bg-secondary)] sticky top-0">
                  <tr>
                    <th className="p-3 text-left w-10">
                      <input type="checkbox" checked={selectedContactos.length === contactos.length && contactos.length > 0}
                        onChange={() => setSelectedContactos(selectedContactos.length === contactos.length ? [] : contactos.map(c => c.id))} className="rounded" />
                    </th>
                    <th className="p-3 text-left text-sm text-[var(--text-secondary)]">Nombre</th>
                    <th className="p-3 text-left text-sm text-[var(--text-secondary)]">Teléfono</th>
                    <th className="p-3 text-left text-sm text-[var(--text-secondary)]">Email</th>
                    <th className="p-3 text-left text-sm text-[var(--text-secondary)]">Empresa</th>
                    <th className="p-3 text-left text-sm text-[var(--text-secondary)]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {contactos.map(c => (
                    <tr key={c.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-secondary)]">
                      <td className="p-3">
                        <input type="checkbox" checked={selectedContactos.includes(c.id)}
                          onChange={() => setSelectedContactos(prev => prev.includes(c.id) ? prev.filter(i => i !== c.id) : [...prev, c.id])} className="rounded" />
                      </td>
                      <td className="p-3 text-[var(--text-primary)]">{c.nombre}</td>
                      <td className="p-3 text-[var(--text-secondary)]">{c.telefono}</td>
                      <td className="p-3 text-[var(--text-secondary)]">{c.email || '-'}</td>
                      <td className="p-3 text-[var(--text-secondary)]">{c.empresa || '-'}</td>
                      <td className="p-3">
                        <button onClick={() => { setEditContacto(c); setShowEditContacto(true) }} className="text-xs text-blue-400 hover:underline mr-3">✏️ Editar</button>
                        <button onClick={() => convertirContactoALead(c)} className="text-xs text-emerald-400 hover:underline mr-3">→ Pipeline</button>
                        <button onClick={() => eliminarContactos([c.id])} className="text-xs text-red-400 hover:underline">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {contactos.length === 0 && (
                <div className="text-center py-12 text-[var(--text-secondary)]">
                  <div className="text-4xl mb-3">👥</div>
                  <p>No hay contactos</p>
                  <button onClick={() => setShowImport(true)} className="mt-2 text-emerald-500 hover:underline text-sm">Importar desde Excel</button>
                </div>
              )}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-[var(--border-color)] flex items-center justify-between">
                <div className="text-sm text-[var(--text-secondary)]">
                  {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalContactos)} de {totalContactos}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="px-2 py-1 rounded text-sm disabled:opacity-30 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">««</button>
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="px-2 py-1 rounded text-sm disabled:opacity-30 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">«</button>
                  {getPageNumbers().map((page, i) => (
                    <button key={i} onClick={() => typeof page === 'number' && goToPage(page)} disabled={page === '...'}
                      className={`px-3 py-1 rounded text-sm ${page === currentPage ? 'bg-emerald-600 text-white' : page === '...' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>
                      {page}
                    </button>
                  ))}
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="px-2 py-1 rounded text-sm disabled:opacity-30 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">»</button>
                  <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 rounded text-sm disabled:opacity-30 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">»»</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Plantillas */}
      {showPlantillas && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h3 className="font-bold text-[var(--text-primary)] text-lg">Selecciona una Plantilla</h3>
              <button onClick={() => setShowPlantillas(false)} className="text-[var(--text-secondary)]">✕</button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {plantillas.map(p => (
                  <div key={p.id} onClick={() => crearPipelineDesdeTemplate(p.id)} className="p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] cursor-pointer hover:border-emerald-500">
                    <div className="text-3xl mb-2">{p.icono}</div>
                    <h4 className="font-bold text-[var(--text-primary)]">{p.nombre}</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{p.descripcion}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.etapas.slice(0, 4).map((e, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">{e}</span>
                      ))}
                      {p.etapas.length > 4 && <span className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">+{p.etapas.length - 4}</span>}
                    </div>
                  </div>
                ))}
                <div onClick={() => { setShowPlantillas(false); setShowNewPipeline(true) }} className="p-4 bg-[var(--bg-primary)] rounded-lg border-2 border-dashed border-[var(--border-color)] cursor-pointer hover:border-emerald-500 flex flex-col items-center justify-center">
                  <div className="text-3xl mb-2">➕</div>
                  <h4 className="font-bold text-[var(--text-primary)]">Personalizado</h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Pipeline */}
      {showNewPipeline && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">Nuevo Pipeline</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre *" value={newPipeline.nombre} onChange={(e) => setNewPipeline({ ...newPipeline, nombre: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <textarea placeholder="Descripción" value={newPipeline.descripcion} onChange={(e) => setNewPipeline({ ...newPipeline, descripcion: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] resize-none" rows={2} />
              <div className="flex gap-3">
                <div className="flex-1"><label className="text-xs text-[var(--text-secondary)]">Color</label><input type="color" value={newPipeline.color} onChange={(e) => setNewPipeline({ ...newPipeline, color: e.target.value })} className="w-full h-10 rounded cursor-pointer" /></div>
                <div className="flex-1"><label className="text-xs text-[var(--text-secondary)]">Icono</label>
                  <select value={newPipeline.icono} onChange={(e) => setNewPipeline({ ...newPipeline, icono: e.target.value })} className="w-full h-10 px-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm">
                    <option value="📊">📊</option><option value="💰">💰</option><option value="🛠️">🛠️</option><option value="🏠">🏠</option><option value="👥">👥</option><option value="🛒">🛒</option><option value="📚">📚</option><option value="🎉">🎉</option><option value="🛡️">🛡️</option><option value="💼">💼</option><option value="🏥">🏥</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewPipeline(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cancelar</button>
              <button onClick={crearPipelinePersonalizado} disabled={!newPipeline.nombre} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Pipeline */}
      {showEditPipeline && selectedPipeline && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">Configurar Pipeline</h3>
            <div className="p-4 bg-[var(--bg-primary)] rounded-lg mb-4">
              <p className="font-medium text-[var(--text-primary)]">{selectedPipeline.nombre}</p>
              <p className="text-xs text-[var(--text-secondary)]">{selectedPipeline.total_leads} leads • {selectedPipeline.total_etapas} etapas</p>
            </div>
            <button onClick={() => { eliminarPipeline(); setShowEditPipeline(false) }} className="w-full py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">🗑️ Eliminar Pipeline</button>
            <button onClick={() => setShowEditPipeline(false)} className="w-full mt-2 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cerrar</button>
          </div>
        </div>
      )}

      {/* Modal Nueva Etapa */}
      {showNewEtapa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">Nueva Etapa</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre *" value={newEtapa.nombre} onChange={(e) => setNewEtapa({ ...newEtapa, nombre: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <div><label className="text-xs text-[var(--text-secondary)]">Color</label><input type="color" value={newEtapa.color} onChange={(e) => setNewEtapa({ ...newEtapa, color: e.target.value })} className="w-full h-10 rounded cursor-pointer" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewEtapa(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cancelar</button>
              <button onClick={crearEtapa} disabled={!newEtapa.nombre} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Lead */}
      {showNewLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">Nuevo Lead</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre" value={newLead.nombre} onChange={(e) => setNewLead({ ...newLead, nombre: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <input type="tel" placeholder="Teléfono *" value={newLead.telefono} onChange={(e) => setNewLead({ ...newLead, telefono: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <input type="email" placeholder="Email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <input type="text" placeholder="Empresa" value={newLead.empresa} onChange={(e) => setNewLead({ ...newLead, empresa: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <input type="number" placeholder="Valor $" value={newLead.valor_estimado || ''} onChange={(e) => setNewLead({ ...newLead, valor_estimado: Number(e.target.value) })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewLead(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cancelar</button>
              <button onClick={crearLead} disabled={!newLead.telefono} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lead Detail */}
      {showLeadDetail && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-lg">{selectedLead.nombre}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{selectedLead.telefono}</p>
              </div>
              <button onClick={() => setShowLeadDetail(false)} className="text-[var(--text-secondary)]">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              {selectedLead.email && <p><span className="text-[var(--text-tertiary)]">Email:</span> <span className="text-[var(--text-primary)]">{selectedLead.email}</span></p>}
              {selectedLead.empresa && <p><span className="text-[var(--text-tertiary)]">Empresa:</span> <span className="text-[var(--text-primary)]">{selectedLead.empresa}</span></p>}
              {selectedLead.valor_estimado > 0 && <p><span className="text-[var(--text-tertiary)]">Valor:</span> <span className="text-emerald-400">${selectedLead.valor_estimado}</span></p>}
              <p><span className="text-[var(--text-tertiary)]">Mensajes:</span> <span className="text-[var(--text-primary)]">{selectedLead.total_mensajes}</span></p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => router.push(`/conversaciones?numero=${selectedLead.telefono}`)} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">💬 Chat</button>
              <button onClick={() => { setSelectedLeads([selectedLead.id]); eliminarLeads(); setShowLeadDetail(false) }} className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">🗑️</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Importar Contactos</h3>
              <button onClick={() => { setShowImport(false); setImportResult(null) }} className="text-[var(--text-secondary)]">✕</button>
            </div>
            {importResult ? (
              <div className="text-center py-4">
                {importResult.error ? <><div className="text-4xl mb-3">❌</div><p className="text-red-400">{importResult.error}</p></> : (
                  <>
                    <div className="text-4xl mb-3">✅</div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-emerald-500/20 p-2 rounded"><div className="text-emerald-400 font-bold">{importResult.importados}</div><div className="text-xs">Importados</div></div>
                      <div className="bg-yellow-500/20 p-2 rounded"><div className="text-yellow-400 font-bold">{importResult.duplicados}</div><div className="text-xs">Duplicados</div></div>
                      <div className="bg-red-500/20 p-2 rounded"><div className="text-red-400 font-bold">{importResult.errores}</div><div className="text-xs">Errores</div></div>
                    </div>
                  </>
                )}
                <button onClick={() => { setShowImport(false); setImportResult(null) }} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg">Cerrar</button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-6 text-center">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                {importing ? <><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3"></div><p>Importando...</p></> : (
                  <><div className="text-4xl mb-3">📥</div><p className="text-sm text-[var(--text-primary)] mb-2">Excel: Full Name, Mobile 1</p><button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">Seleccionar</button></>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Nuevo Contacto */}
      {showNewContacto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">Nuevo Contacto</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre" value={newContacto.nombre} onChange={(e) => setNewContacto({ ...newContacto, nombre: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <input type="tel" placeholder="Teléfono *" value={newContacto.telefono} onChange={(e) => setNewContacto({ ...newContacto, telefono: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <input type="email" placeholder="Email" value={newContacto.email} onChange={(e) => setNewContacto({ ...newContacto, email: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <input type="text" placeholder="Empresa" value={newContacto.empresa} onChange={(e) => setNewContacto({ ...newContacto, empresa: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewContacto(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cancelar</button>
              <button onClick={crearContacto} disabled={!newContacto.telefono} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Contacto */}
      {showEditContacto && editContacto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">Editar Contacto</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Nombre</label>
                <input type="text" value={editContacto.nombre} onChange={(e) => setEditContacto({ ...editContacto, nombre: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Teléfono *</label>
                <input type="tel" value={editContacto.telefono} onChange={(e) => setEditContacto({ ...editContacto, telefono: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Email</label>
                <input type="email" value={editContacto.email || ''} onChange={(e) => setEditContacto({ ...editContacto, email: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Empresa</label>
                <input type="text" value={editContacto.empresa || ''} onChange={(e) => setEditContacto({ ...editContacto, empresa: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Notas</label>
                <textarea value={editContacto.notas || ''} onChange={(e) => setEditContacto({ ...editContacto, notas: e.target.value })} rows={3} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowEditContacto(false); setEditContacto(null) }} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cancelar</button>
              <button onClick={actualizarContacto} disabled={!editContacto.telefono} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
