
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
import { formatRelativeTime } from '@/lib/utils'

interface Campana {
  id: number
  nombre: string
  tipo: 'broadcast' | 'secuencia' | 'automatizada'
  estado: 'borrador' | 'programada' | 'enviando' | 'completada' | 'pausada'
  mensaje_template: string
  canal: string
  total_destinatarios: number
  enviados: number
  entregados: number
  leidos: number
  respondidos: number
  fecha_programada?: string
  created_at: string
}

const TIPOS = [
  { value: 'broadcast', label: '📢 Broadcast (Masivo)' },
  { value: 'secuencia', label: '📋 Secuencia' },
  { value: 'automatizada', label: '⚡ Automatizada' },
]

const CANALES = [
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'telegram', label: '✈️ Telegram' },
  { value: 'email', label: '📧 Email' },
]

export default function CampanasPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ nombre: '', tipo: 'broadcast', canal: 'whatsapp', mensaje_template: '', fecha_programada: '' })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) { setUser(await res.json()); loadCampanas() }
      else router.push('/login')
    } catch { router.push('/login') }
  }

  const loadCampanas = async () => {
    try {
      const res = await fetch('/api/campanas')
      if (res.ok) setCampanas(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await fetch('/api/campanas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) { setShowModal(false); setFormData({ nombre: '', tipo: 'broadcast', canal: 'whatsapp', mensaje_template: '', fecha_programada: '' }); loadCampanas() }
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const getStatusBadge = (estado: string) => {
    const classes: Record<string, string> = {
      borrador: 'bg-gray-500/20 text-gray-400',
      programada: 'bg-blue-500/20 text-blue-400',
      enviando: 'bg-yellow-500/20 text-yellow-400',
      completada: 'bg-green-500/20 text-green-400',
      pausada: 'bg-red-500/20 text-red-400',
    }
    return classes[estado] || classes.borrador
  }

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <main className="ml-64">
        <Header title="Campañas" subtitle="Envía mensajes masivos a tus contactos" actions={<Button onClick={() => setShowModal(true)}>+ Nueva Campaña</Button>} />
        <div className="p-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4"><p className="text-2xl font-bold text-[var(--text-primary)]">{campanas.length}</p><p className="text-sm text-[var(--text-muted)]">Total Campañas</p></div>
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4"><p className="text-2xl font-bold text-green-500">{campanas.filter(c => c.estado === 'completada').length}</p><p className="text-sm text-[var(--text-muted)]">Completadas</p></div>
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4"><p className="text-2xl font-bold text-blue-500">{campanas.reduce((acc, c) => acc + c.enviados, 0)}</p><p className="text-sm text-[var(--text-muted)]">Mensajes Enviados</p></div>
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4"><p className="text-2xl font-bold text-purple-500">{campanas.reduce((acc, c) => acc + c.respondidos, 0)}</p><p className="text-sm text-[var(--text-muted)]">Respuestas</p></div>
          </div>
          {campanas.length > 0 ? (
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] overflow-hidden">
              <table className="w-full">
                <thead><tr className="bg-[var(--bg-tertiary)]"><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Campaña</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Canal</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Estado</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Progreso</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Métricas</th><th className="px-4 py-3"></th></tr></thead>
                <tbody>
                  {campanas.map((campana) => (
                    <tr key={campana.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-hover)]">
                      <td className="px-4 py-4"><p className="font-medium text-[var(--text-primary)]">{campana.nombre}</p><p className="text-sm text-[var(--text-muted)]">{campana.tipo} • {formatRelativeTime(campana.created_at)}</p></td>
                      <td className="px-4 py-4"><span className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-sm">{campana.canal === 'whatsapp' ? '💬' : campana.canal === 'telegram' ? '✈️' : '📧'} {campana.canal}</span></td>
                      <td className="px-4 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(campana.estado)}`}>{campana.estado}</span></td>
                      <td className="px-4 py-4"><div className="w-32"><div className="flex justify-between text-xs text-[var(--text-muted)] mb-1"><span>{campana.enviados}/{campana.total_destinatarios}</span><span>{campana.total_destinatarios > 0 ? Math.round((campana.enviados / campana.total_destinatarios) * 100) : 0}%</span></div><div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${campana.total_destinatarios > 0 ? (campana.enviados / campana.total_destinatarios) * 100 : 0}%` }} /></div></div></td>
                      <td className="px-4 py-4"><div className="flex gap-4 text-sm"><span title="Entregados">📬 {campana.entregados}</span><span title="Leídos">👁️ {campana.leidos}</span><span title="Respuestas">💬 {campana.respondidos}</span></div></td>
                      <td className="px-4 py-4"><Button variant="ghost" size="sm" onClick={() => router.push(`/campanas/${campana.id}`)}>Ver</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><div className="empty-state-icon"><span className="text-3xl">📣</span></div><h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Sin campañas</h3><p className="text-[var(--text-muted)] mb-4">Crea tu primera campaña de mensajes</p><Button onClick={() => setShowModal(true)}>Nueva Campaña</Button></div>
          )}
        </div>
      </main>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Campaña" size="lg" footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button><Button onClick={handleSubmit} loading={saving}>Crear Campaña</Button></>}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre de la Campaña" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej: Promoción Black Friday" required />
          <div className="grid md:grid-cols-2 gap-4"><Select label="Tipo" value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} options={TIPOS} /><Select label="Canal" value={formData.canal} onChange={(e) => setFormData({ ...formData, canal: e.target.value })} options={CANALES} /></div>
          <Textarea label="Mensaje Template" value={formData.mensaje_template} onChange={(e) => setFormData({ ...formData, mensaje_template: e.target.value })} rows={5} placeholder="Hola {{nombre}}, tenemos una oferta especial para ti..." hint="Usa {{variable}} para personalizar" required />
          <Input label="Programar Envío" type="datetime-local" value={formData.fecha_programada} onChange={(e) => setFormData({ ...formData, fecha_programada: e.target.value })} hint="Dejar vacío para enviar manualmente" />
        </form>
      </Modal>
    </div>
  )
}
