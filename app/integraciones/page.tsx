
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { LoadingPage } from '@/components/Loading'

interface Integracion {
  id: string
  nombre: string
  descripcion: string
  icono: string
  categoria: string
  activo: boolean
  configurado: boolean
}

const INTEGRACIONES_DISPONIBLES: Integracion[] = [
  { id: 'whatsapp', nombre: 'WhatsApp Business', descripcion: 'Conecta tu WhatsApp Business con Evolution API', icono: '💬', categoria: 'Mensajería', activo: false, configurado: false },
  { id: 'telegram', nombre: 'Telegram Bot', descripcion: 'Integra un bot de Telegram para atención', icono: '✈️', categoria: 'Mensajería', activo: false, configurado: false },
  { id: 'email', nombre: 'Email SMTP', descripcion: 'Envía correos y notificaciones', icono: '📧', categoria: 'Mensajería', activo: false, configurado: false },
  { id: 'instagram', nombre: 'Instagram DM', descripcion: 'Responde mensajes de Instagram', icono: '📸', categoria: 'Mensajería', activo: false, configurado: false },
  { id: 'odoo', nombre: 'Odoo ERP', descripcion: 'Sincroniza contactos, productos y pedidos', icono: '🏢', categoria: 'ERP/CRM', activo: false, configurado: false },
  { id: 'google_calendar', nombre: 'Google Calendar', descripcion: 'Sincroniza citas y eventos', icono: '📅', categoria: 'Productividad', activo: false, configurado: false },
  { id: 'n8n', nombre: 'n8n Workflows', descripcion: 'Automatizaciones avanzadas con n8n', icono: '⚡', categoria: 'Automatización', activo: false, configurado: false },
  { id: 'qdrant', nombre: 'Qdrant Vector DB', descripcion: 'Base de datos vectorial para RAG', icono: '🧠', categoria: 'IA', activo: false, configurado: false },
  { id: 'groq', nombre: 'Groq AI', descripcion: 'Modelos LLM ultra rápidos', icono: '🚀', categoria: 'IA', activo: false, configurado: false },
  { id: 'openai', nombre: 'OpenAI', descripcion: 'GPT-4 y otros modelos', icono: '🤖', categoria: 'IA', activo: false, configurado: false },
  { id: 'stripe', nombre: 'Stripe', descripcion: 'Pagos y suscripciones', icono: '💳', categoria: 'Pagos', activo: false, configurado: false },
  { id: 'webhook', nombre: 'Webhooks', descripcion: 'Endpoints personalizados', icono: '🔗', categoria: 'Desarrollo', activo: false, configurado: false },
]

export default function IntegracionesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [integraciones, setIntegraciones] = useState<Integracion[]>(INTEGRACIONES_DISPONIBLES)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedIntegracion, setSelectedIntegracion] = useState<Integracion | null>(null)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<Record<string, string>>({})

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const userData = await res.json()
        if (userData.nivel < 4) { router.push('/dashboard'); return }
        setUser(userData)
        loadIntegraciones()
      } else router.push('/login')
    } catch { router.push('/login') }
  }

  const loadIntegraciones = async () => {
    try {
      const res = await fetch('/api/integraciones')
      if (res.ok) {
        const data = await res.json()
        setIntegraciones(INTEGRACIONES_DISPONIBLES.map(i => ({ ...i, ...(data.find((d: any) => d.tipo === i.id) || {}) })))
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const openConfig = (integracion: Integracion) => {
    setSelectedIntegracion(integracion)
    setConfig({})
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!selectedIntegracion) return
    setSaving(true)
    try {
      await fetch('/api/integraciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: selectedIntegracion.id, config }) })
      setShowModal(false)
      loadIntegraciones()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const toggleIntegracion = async (integracion: Integracion) => {
    await fetch(`/api/integraciones/${integracion.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !integracion.activo }) })
    loadIntegraciones()
  }

  const getConfigFields = (id: string) => {
    const fields: Record<string, { label: string; type: string; placeholder: string }[]> = {
      whatsapp: [{ label: 'Evolution API URL', type: 'url', placeholder: 'http://evolution-api:8080' }, { label: 'API Key', type: 'password', placeholder: 'Tu API Key' }, { label: 'Instancia', type: 'text', placeholder: 'Nombre de instancia' }],
      telegram: [{ label: 'Bot Token', type: 'password', placeholder: 'Token de @BotFather' }],
      email: [{ label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com' }, { label: 'Puerto', type: 'text', placeholder: '587' }, { label: 'Usuario', type: 'email', placeholder: 'tu@email.com' }, { label: 'Contraseña', type: 'password', placeholder: 'App password' }],
      odoo: [{ label: 'URL Odoo', type: 'url', placeholder: 'https://tu-odoo.com' }, { label: 'Base de Datos', type: 'text', placeholder: 'nombre_db' }, { label: 'Usuario', type: 'text', placeholder: 'admin' }, { label: 'API Key', type: 'password', placeholder: 'API Key de Odoo' }],
      groq: [{ label: 'API Key', type: 'password', placeholder: 'gsk_...' }],
      openai: [{ label: 'API Key', type: 'password', placeholder: 'sk-...' }],
      n8n: [{ label: 'URL n8n', type: 'url', placeholder: 'http://n8n:5678' }, { label: 'API Key', type: 'password', placeholder: 'API Key de n8n' }],
      qdrant: [{ label: 'URL Qdrant', type: 'url', placeholder: 'http://qdrant:6333' }, { label: 'API Key', type: 'password', placeholder: 'Opcional' }],
      google_calendar: [{ label: 'Client ID', type: 'text', placeholder: 'Google Client ID' }, { label: 'Client Secret', type: 'password', placeholder: 'Google Client Secret' }],
      stripe: [{ label: 'API Key', type: 'password', placeholder: 'sk_live_...' }, { label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...' }],
      webhook: [{ label: 'URL Webhook', type: 'url', placeholder: 'https://tu-servidor.com/webhook' }, { label: 'Secret', type: 'password', placeholder: 'Secret para validar' }],
    }
    return fields[id] || []
  }

  const categorias = [...new Set(integraciones.map(i => i.categoria))]

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <main className="ml-64">
        <Header title="Integraciones" subtitle="Conecta tus herramientas favoritas" />
        <div className="p-6">
          {categorias.map((categoria) => (
            <div key={categoria} className="mb-8">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{categoria}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integraciones.filter(i => i.categoria === categoria).map((integracion) => (
                  <div key={integracion.id} className={`bg-[var(--card-bg)] rounded-xl border p-6 transition-colors ${integracion.configurado ? 'border-green-500/50' : 'border-[var(--border-color)]'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center text-2xl">{integracion.icono}</div>
                        <div><h3 className="font-semibold text-[var(--text-primary)]">{integracion.nombre}</h3>{integracion.configurado && <span className="text-xs text-green-500">✓ Configurado</span>}</div>
                      </div>
                      {integracion.configurado && (
                        <button onClick={() => toggleIntegracion(integracion)} className={`w-12 h-6 rounded-full transition-colors ${integracion.activo ? 'bg-green-500' : 'bg-[var(--bg-tertiary)]'}`}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${integracion.activo ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mb-4">{integracion.descripcion}</p>
                    <Button variant={integracion.configurado ? 'secondary' : 'primary'} size="sm" onClick={() => openConfig(integracion)} className="w-full">{integracion.configurado ? 'Editar Configuración' : 'Configurar'}</Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={`Configurar ${selectedIntegracion?.nombre}`} footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button><Button onClick={handleSave} loading={saving}>Guardar</Button></>}>
        {selectedIntegracion && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-[var(--bg-tertiary)] rounded-lg">
              <span className="text-3xl">{selectedIntegracion.icono}</span>
              <div><h4 className="font-medium text-[var(--text-primary)]">{selectedIntegracion.nombre}</h4><p className="text-sm text-[var(--text-muted)]">{selectedIntegracion.descripcion}</p></div>
            </div>
            {getConfigFields(selectedIntegracion.id).map((field, i) => (
              <Input key={i} label={field.label} type={field.type} placeholder={field.placeholder} value={config[field.label.toLowerCase().replace(/ /g, '_')] || ''} onChange={(e) => setConfig({ ...config, [field.label.toLowerCase().replace(/ /g, '_')]: e.target.value })} />
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
