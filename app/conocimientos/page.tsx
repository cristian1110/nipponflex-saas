
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

interface BaseConocimiento {
  id: number
  nombre: string
  tipo: 'documento' | 'url' | 'texto' | 'faq'
  contenido?: string
  archivo_url?: string
  vectorizado: boolean
  total_chunks: number
  created_at: string
}

const TIPOS = [
  { value: 'texto', label: '📝 Texto Directo' },
  { value: 'documento', label: '📄 Documento (PDF/DOC)' },
  { value: 'url', label: '🔗 URL / Sitio Web' },
  { value: 'faq', label: '❓ Preguntas Frecuentes' },
]

export default function ConocimientosPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [bases, setBases] = useState<BaseConocimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ nombre: '', tipo: 'texto', contenido: '', url: '' })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) { setUser(await res.json()); loadBases() }
      else router.push('/login')
    } catch { router.push('/login') }
  }

  const loadBases = async () => {
    try {
      const res = await fetch('/api/conocimientos')
      if (res.ok) setBases(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await fetch('/api/conocimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) { setShowModal(false); setFormData({ nombre: '', tipo: 'texto', contenido: '', url: '' }); loadBases() }
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const vectorizar = async (id: number) => {
    try {
      await fetch(`/api/conocimientos/${id}/vectorizar`, { method: 'POST' })
      loadBases()
    } catch (e) { console.error(e) }
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta base de conocimiento?')) return
    try {
      await fetch(`/api/conocimientos/${id}`, { method: 'DELETE' })
      loadBases()
    } catch (e) { console.error(e) }
  }

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <main className="ml-64">
        <Header title="Base de Conocimientos" subtitle="Entrena a tus agentes con información de tu negocio" actions={<Button onClick={() => setShowModal(true)}>+ Agregar Conocimiento</Button>} />
        <div className="p-6">
          {bases.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bases.map((base) => (
                <div key={base.id} className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${base.tipo === 'documento' ? 'bg-red-500/20' : base.tipo === 'url' ? 'bg-blue-500/20' : base.tipo === 'faq' ? 'bg-yellow-500/20' : 'bg-green-500/20'}`}>
                        <span className="text-2xl">{base.tipo === 'documento' ? '📄' : base.tipo === 'url' ? '🔗' : base.tipo === 'faq' ? '❓' : '📝'}</span>
                      </div>
                      <div><h3 className="font-semibold text-[var(--text-primary)]">{base.nombre}</h3><p className="text-sm text-[var(--text-muted)]">{base.tipo}</p></div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${base.vectorizado ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>{base.vectorizado ? '✓ Listo' : 'Pendiente'}</span>
                  </div>
                  <div className="text-sm text-[var(--text-muted)] mb-4">
                    <p>{base.total_chunks} fragmentos</p>
                    <p>Creado {formatRelativeTime(base.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    {!base.vectorizado && <Button variant="primary" size="sm" onClick={() => vectorizar(base.id)} className="flex-1">Procesar</Button>}
                    <Button variant="ghost" size="sm" onClick={() => eliminar(base.id)}>🗑️</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-state-icon"><span className="text-3xl">📚</span></div><h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Sin bases de conocimiento</h3><p className="text-[var(--text-muted)] mb-4">Agrega información para entrenar tus agentes</p><Button onClick={() => setShowModal(true)}>Agregar Conocimiento</Button></div>
          )}
        </div>
      </main>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Agregar Conocimiento" size="lg" footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button><Button onClick={handleSubmit} loading={saving}>Guardar</Button></>}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej: Manual de productos" required />
          <Select label="Tipo" value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} options={TIPOS} />
          {formData.tipo === 'url' ? (
            <Input label="URL" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} placeholder="https://..." />
          ) : formData.tipo === 'documento' ? (
            <div className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-8 text-center">
              <span className="text-4xl block mb-2">📁</span>
              <p className="text-[var(--text-muted)]">Arrastra un archivo o haz clic para seleccionar</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">PDF, DOC, DOCX, TXT (máx 10MB)</p>
            </div>
          ) : (
            <Textarea label="Contenido" value={formData.contenido} onChange={(e) => setFormData({ ...formData, contenido: e.target.value })} rows={10} placeholder={formData.tipo === 'faq' ? 'P: ¿Cuál es el horario?\nR: Lunes a Viernes de 9am a 6pm' : 'Escribe o pega el contenido aquí...'} />
          )}
        </form>
      </Modal>
    </div>
  )
}
