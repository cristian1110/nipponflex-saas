
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import Input, { Textarea, Select } from '@/components/Input'
import { LoadingPage } from '@/components/Loading'
import { formatCurrency, formatRelativeTime, ORIGENES_LEAD } from '@/lib/utils'

interface Lead {
  id: number
  nombre: string
  telefono: string
  email?: string
  empresa?: string
  etapa_id: number
  etapa_nombre: string
  etapa_color: string
  valor_estimado: number
  origen: string
  created_at: string
}

interface Etapa {
  id: number
  nombre: string
  color: string
  orden: number
}

export default function CRMPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban')
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    empresa: '',
    origen: 'WhatsApp',
    valor_estimado: '',
    notas: '',
  })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      setShowModal(true)
    }
  }, [searchParams])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        setUser(await res.json())
        loadData()
      } else {
        router.push('/login')
      }
    } catch {
      router.push('/login')
    }
  }

  const loadData = async () => {
    try {
      const [leadsRes, etapasRes] = await Promise.all([
        fetch('/api/crm/leads'),
        fetch('/api/crm/etapas'),
      ])

      if (leadsRes.ok) setLeads(await leadsRes.json())
      if (etapasRes.ok) setEtapas(await etapasRes.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          valor_estimado: parseFloat(formData.valor_estimado) || 0,
        }),
      })

      if (res.ok) {
        setShowModal(false)
        setFormData({ nombre: '', telefono: '', email: '', empresa: '', origen: 'WhatsApp', valor_estimado: '', notas: '' })
        loadData()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, leadId: number) => {
    e.dataTransfer.setData('leadId', leadId.toString())
  }

  const handleDrop = async (e: React.DragEvent, etapaId: number) => {
    e.preventDefault()
    const leadId = parseInt(e.dataTransfer.getData('leadId'))
    
    // Actualizar localmente
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, etapa_id: etapaId } : l))

    // Actualizar en servidor
    await fetch(`/api/crm/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa_id: etapaId }),
    })
  }

  const filteredLeads = leads.filter(l =>
    l.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.telefono.includes(searchTerm) ||
    l.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <main className="ml-64">
        <Header
          title="CRM / Leads"
          subtitle={`${leads.length} leads en total`}
          actions={
            <div className="flex items-center gap-3">
              <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${viewMode === 'kanban' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
                >
                  Kanban
                </button>
                <button
                  onClick={() => setViewMode('lista')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${viewMode === 'lista' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
                >
                  Lista
                </button>
              </div>
              <Button onClick={() => setShowModal(true)}>
                + Nuevo Lead
              </Button>
            </div>
          }
        />

        <div className="p-6">
          {/* Search */}
          <div className="mb-6">
            <Input
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {viewMode === 'kanban' ? (
            /* Kanban View */
            <div className="flex gap-4 overflow-x-auto pb-4">
              {etapas.map((etapa) => {
                const etapaLeads = filteredLeads.filter(l => l.etapa_id === etapa.id)
                return (
                  <div
                    key={etapa.id}
                    className="flex-shrink-0 w-80 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, etapa.id)}
                  >
                    {/* Column Header */}
                    <div className="p-4 border-b border-[var(--border-color)]">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: etapa.color }} />
                        <h3 className="font-semibold text-[var(--text-primary)]">{etapa.nombre}</h3>
                        <span className="ml-auto px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)]">
                          {etapaLeads.length}
                        </span>
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
                      {etapaLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead.id)}
                          onClick={() => router.push(`/crm/${lead.id}`)}
                          className="kanban-card p-4 bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] hover:border-green-500/50 transition-colors"
                        >
                          <h4 className="font-medium text-[var(--text-primary)] mb-1">{lead.nombre}</h4>
                          <p className="text-sm text-[var(--text-muted)] mb-2">{lead.telefono}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--text-muted)]">{lead.origen}</span>
                            {lead.valor_estimado > 0 && (
                              <span className="text-xs font-medium text-green-500">
                                {formatCurrency(lead.valor_estimado)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {etapaLeads.length === 0 && (
                        <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                          Sin leads
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* List View */
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Email</th>
                    <th>Etapa</th>
                    <th>Origen</th>
                    <th>Valor</th>
                    <th>Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => router.push(`/crm/${lead.id}`)}
                      className="cursor-pointer"
                    >
                      <td className="font-medium text-[var(--text-primary)]">{lead.nombre}</td>
                      <td>{lead.telefono}</td>
                      <td className="text-[var(--text-muted)]">{lead.email || '-'}</td>
                      <td>
                        <span
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ backgroundColor: `${lead.etapa_color}20`, color: lead.etapa_color }}
                        >
                          {lead.etapa_nombre}
                        </span>
                      </td>
                      <td className="text-[var(--text-muted)]">{lead.origen}</td>
                      <td className="text-green-500">{formatCurrency(lead.valor_estimado)}</td>
                      <td className="text-[var(--text-muted)]">{formatRelativeTime(lead.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Nuevo Lead */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo Lead"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Guardar Lead
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            required
          />
          <Input
            label="Teléfono"
            value={formData.telefono}
            onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
            placeholder="+593 99 999 9999"
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Empresa"
            value={formData.empresa}
            onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Origen"
              value={formData.origen}
              onChange={(e) => setFormData({ ...formData, origen: e.target.value })}
              options={ORIGENES_LEAD.map(o => ({ value: o, label: o }))}
            />
            <Input
              label="Valor Estimado"
              type="number"
              value={formData.valor_estimado}
              onChange={(e) => setFormData({ ...formData, valor_estimado: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <Textarea
            label="Notas"
            value={formData.notas}
            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            rows={3}
          />
        </form>
      </Modal>
    </div>
  )
}
