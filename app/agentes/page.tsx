
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import Input, { Textarea, Select } from '@/components/Input'
import { LoadingPage } from '@/components/Loading'

interface Agente {
  id: number
  nombre: string
  descripcion?: string
  prompt_sistema: string
  personalidad?: string
  temperatura: number
  modelo: string
  activo: boolean
  whatsapp_numero?: string
  telegram_bot?: string
}

const MODELOS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Fast (Groq)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (Groq)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)' },
]

const PERSONALIDADES = [
  { value: 'profesional', label: '👔 Profesional' },
  { value: 'amigable', label: '😊 Amigable' },
  { value: 'formal', label: '📋 Formal' },
  { value: 'casual', label: '😎 Casual' },
]

export default function AgentesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agente | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', prompt_sistema: '', personalidad: 'profesional', temperatura: 0.7, modelo: 'llama-3.3-70b-versatile', whatsapp_numero: '', telegram_bot: '' })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) { setUser(await res.json()); loadAgentes() }
      else router.push('/login')
    } catch { router.push('/login') }
  }

  const loadAgentes = async () => {
    try {
      const res = await fetch('/api/agentes')
      if (res.ok) setAgentes(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const url = editingAgent ? `/api/agentes/${editingAgent.id}` : '/api/agentes'
      const res = await fetch(url, { method: editingAgent ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) { setShowModal(false); resetForm(); loadAgentes() }
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const toggleActivo = async (agente: Agente) => {
    await fetch(`/api/agentes/${agente.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !agente.activo }) })
    loadAgentes()
  }

  const editAgent = (agente: Agente) => {
    setEditingAgent(agente)
    setFormData({ nombre: agente.nombre, descripcion: agente.descripcion || '', prompt_sistema: agente.prompt_sistema, personalidad: agente.personalidad || 'profesional', temperatura: agente.temperatura, modelo: agente.modelo, whatsapp_numero: agente.whatsapp_numero || '', telegram_bot: agente.telegram_bot || '' })
    setShowModal(true)
  }

  const resetForm = () => { setEditingAgent(null); setFormData({ nombre: '', descripcion: '', prompt_sistema: '', personalidad: 'profesional', temperatura: 0.7, modelo: 'llama-3.3-70b-versatile', whatsapp_numero: '', telegram_bot: '' }) }

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <main className="ml-64">
        <Header title="Agentes IA" subtitle={`${agentes.length} agente(s)`} actions={<Button onClick={() => { resetForm(); setShowModal(true) }}>+ Nuevo Agente</Button>} />
        <div className="p-6">
          {agentes.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agentes.map((agente) => (
                <div key={agente.id} className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6 hover:border-green-500/50 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"><span className="text-2xl">🤖</span></div>
                      <div><h3 className="font-semibold text-[var(--text-primary)]">{agente.nombre}</h3><p className="text-sm text-[var(--text-muted)]">{agente.modelo.split('-')[0]}</p></div>
                    </div>
                    <button onClick={() => toggleActivo(agente)} className={`px-3 py-1 rounded-full text-xs font-medium ${agente.activo ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{agente.activo ? 'Activo' : 'Inactivo'}</button>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">{agente.descripcion || agente.prompt_sistema.substring(0, 100) + '...'}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {agente.whatsapp_numero && <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs rounded-lg">📱 WhatsApp</span>}
                    {agente.telegram_bot && <span className="px-2 py-1 bg-blue-500/10 text-blue-500 text-xs rounded-lg">✈️ Telegram</span>}
                    <span className="px-2 py-1 bg-purple-500/10 text-purple-500 text-xs rounded-lg">🌡️ {agente.temperatura}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => editAgent(agente)} className="flex-1">Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/agentes/${agente.id}/probar`)}>Probar</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-state-icon"><span className="text-3xl">🤖</span></div><h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No hay agentes</h3><p className="text-[var(--text-muted)] mb-4">Crea tu primer agente IA</p><Button onClick={() => setShowModal(true)}>Crear Agente</Button></div>
          )}
        </div>
      </main>
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm() }} title={editingAgent ? 'Editar Agente' : 'Nuevo Agente IA'} size="lg" footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button><Button onClick={handleSubmit} loading={saving}>{editingAgent ? 'Guardar' : 'Crear'}</Button></>}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4"><Input label="Nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required /><Select label="Modelo IA" value={formData.modelo} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} options={MODELOS} /></div>
          <Textarea label="Prompt del Sistema" value={formData.prompt_sistema} onChange={(e) => setFormData({ ...formData, prompt_sistema: e.target.value })} rows={6} required hint="Define el comportamiento del agente" />
          <div className="grid md:grid-cols-2 gap-4"><Select label="Personalidad" value={formData.personalidad} onChange={(e) => setFormData({ ...formData, personalidad: e.target.value })} options={PERSONALIDADES} /><div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Temperatura: {formData.temperatura}</label><input type="range" min="0" max="1" step="0.1" value={formData.temperatura} onChange={(e) => setFormData({ ...formData, temperatura: parseFloat(e.target.value) })} className="w-full" /></div></div>
          <div className="border-t border-[var(--border-color)] pt-4"><h4 className="text-sm font-medium mb-3">Canales</h4><div className="grid md:grid-cols-2 gap-4"><Input label="WhatsApp" value={formData.whatsapp_numero} onChange={(e) => setFormData({ ...formData, whatsapp_numero: e.target.value })} placeholder="+593..." /><Input label="Telegram Bot" value={formData.telegram_bot} onChange={(e) => setFormData({ ...formData, telegram_bot: e.target.value })} placeholder="@bot" /></div></div>
        </form>
      </Modal>
    </div>
  )
}
