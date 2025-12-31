
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import Input, { Select } from '@/components/Input'
import { LoadingPage } from '@/components/Loading'
import { formatDate, formatCurrency, PLANES } from '@/lib/utils'

interface Cliente {
  id: number
  nombre: string
  email: string
  telefono?: string
  plan: string
  limite_agentes: number
  limite_usuarios: number
  limite_mensajes: number
  mensajes_usados: number
  activo: boolean
  fecha_inicio: string
  fecha_fin?: string
  total_usuarios?: number
  total_agentes?: number
}

export default function ClientesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ nombre: '', email: '', telefono: '', plan: 'starter' })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const userData = await res.json()
        if (userData.nivel < 5) { router.push('/dashboard'); return }
        setUser(userData)
        loadClientes()
      } else router.push('/login')
    } catch { router.push('/login') }
  }

  const loadClientes = async () => {
    try {
      const res = await fetch('/api/clientes')
      if (res.ok) setClientes(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const planConfig = PLANES[formData.plan as keyof typeof PLANES]
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, limite_agentes: planConfig.agentes, limite_usuarios: planConfig.usuarios, limite_mensajes: planConfig.mensajes })
      })
      if (res.ok) { setShowModal(false); setFormData({ nombre: '', email: '', telefono: '', plan: 'starter' }); loadClientes() }
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const toggleActivo = async (cliente: Cliente) => {
    await fetch(`/api/clientes/${cliente.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !cliente.activo }) })
    loadClientes()
  }

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = { starter: 'bg-gray-500/20 text-gray-400', pro: 'bg-blue-500/20 text-blue-400', business: 'bg-purple-500/20 text-purple-400', enterprise: 'bg-yellow-500/20 text-yellow-400' }
    return colors[plan] || colors.starter
  }

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <main className="ml-64">
        <Header title="Clientes" subtitle={`${clientes.length} cliente(s) activos`} actions={<Button onClick={() => setShowModal(true)}>+ Nuevo Cliente</Button>} />
        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4"><p className="text-2xl font-bold text-[var(--text-primary)]">{clientes.length}</p><p className="text-sm text-[var(--text-muted)]">Total Clientes</p></div>
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4"><p className="text-2xl font-bold text-green-500">{clientes.filter(c => c.activo).length}</p><p className="text-sm text-[var(--text-muted)]">Activos</p></div>
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4"><p className="text-2xl font-bold text-blue-500">{clientes.reduce((acc, c) => acc + (c.total_usuarios || 0), 0)}</p><p className="text-sm text-[var(--text-muted)]">Total Usuarios</p></div>
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4"><p className="text-2xl font-bold text-purple-500">{formatCurrency(clientes.reduce((acc, c) => acc + (PLANES[c.plan as keyof typeof PLANES]?.precio || 0), 0))}</p><p className="text-sm text-[var(--text-muted)]">MRR</p></div>
          </div>
          {/* Tabla */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-[var(--bg-tertiary)]"><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Cliente</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Plan</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Uso</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Estado</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Desde</th><th className="px-4 py-3"></th></tr></thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-4"><p className="font-medium text-[var(--text-primary)]">{cliente.nombre}</p><p className="text-sm text-[var(--text-muted)]">{cliente.email}</p></td>
                    <td className="px-4 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getPlanBadge(cliente.plan)}`}>{cliente.plan}</span></td>
                    <td className="px-4 py-4">
                      <div className="text-sm"><p>{cliente.total_usuarios || 0}/{cliente.limite_usuarios} usuarios</p><p>{cliente.total_agentes || 0}/{cliente.limite_agentes} agentes</p><p>{cliente.mensajes_usados.toLocaleString()}/{cliente.limite_mensajes.toLocaleString()} msgs</p></div>
                    </td>
                    <td className="px-4 py-4"><button onClick={() => toggleActivo(cliente)} className={`px-2 py-1 rounded-full text-xs font-medium ${cliente.activo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{cliente.activo ? 'Activo' : 'Inactivo'}</button></td>
                    <td className="px-4 py-4 text-sm text-[var(--text-muted)]">{formatDate(cliente.fecha_inicio)}</td>
                    <td className="px-4 py-4"><Button variant="ghost" size="sm" onClick={() => router.push(`/clientes/${cliente.id}`)}>Gestionar</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Cliente" footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button><Button onClick={handleSubmit} loading={saving}>Crear Cliente</Button></>}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre de la Empresa" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
          <Input label="Email de Contacto" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
          <Input label="Teléfono" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} />
          <Select label="Plan" value={formData.plan} onChange={(e) => setFormData({ ...formData, plan: e.target.value })} options={Object.entries(PLANES).map(([k, v]) => ({ value: k, label: `${v.nombre} - $${v.precio}/mes` }))} />
        </form>
      </Modal>
    </div>
  )
}
