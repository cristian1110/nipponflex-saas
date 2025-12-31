
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
import { formatRelativeTime, ROLES } from '@/lib/utils'

interface Usuario {
  id: number
  email: string
  nombre: string
  telefono?: string
  rol: string
  nivel: number
  activo: boolean
  created_at: string
}

export default function UsuariosPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ nombre: '', email: '', telefono: '', rol: 'vendedor', password: '' })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const userData = await res.json()
        if (userData.nivel < 4) { router.push('/dashboard'); return }
        setUser(userData)
        loadUsuarios()
      } else router.push('/login')
    } catch { router.push('/login') }
  }

  const loadUsuarios = async () => {
    try {
      const res = await fetch('/api/usuarios')
      if (res.ok) setUsuarios(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) { setShowModal(false); setFormData({ nombre: '', email: '', telefono: '', rol: 'vendedor', password: '' }); loadUsuarios() }
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const toggleActivo = async (usuario: Usuario) => {
    if (usuario.id === user.id) return
    await fetch(`/api/usuarios/${usuario.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !usuario.activo }) })
    loadUsuarios()
  }

  const getRolColor = (rol: string) => {
    const colors: Record<string, string> = { superadmin: 'bg-red-500/20 text-red-400', admin: 'bg-purple-500/20 text-purple-400', distribuidor: 'bg-blue-500/20 text-blue-400', vendedor: 'bg-green-500/20 text-green-400' }
    return colors[rol] || colors.vendedor
  }

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <main className="ml-64">
        <Header title="Usuarios" subtitle={`${usuarios.length} usuario(s) en tu equipo`} actions={<Button onClick={() => setShowModal(true)}>+ Nuevo Usuario</Button>} />
        <div className="p-6">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-[var(--bg-tertiary)]"><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Usuario</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Email</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Rol</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Estado</th><th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--text-muted)]">Creado</th><th className="px-4 py-3"></th></tr></thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-sm font-medium text-[var(--text-primary)]">{usuario.nombre.charAt(0)}</div>
                        <div><p className="font-medium text-[var(--text-primary)]">{usuario.nombre}</p>{usuario.telefono && <p className="text-sm text-[var(--text-muted)]">{usuario.telefono}</p>}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[var(--text-secondary)]">{usuario.email}</td>
                    <td className="px-4 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getRolColor(usuario.rol)}`}>{usuario.rol}</span></td>
                    <td className="px-4 py-4">
                      <button onClick={() => toggleActivo(usuario)} disabled={usuario.id === user.id} className={`px-2 py-1 rounded-full text-xs font-medium ${usuario.activo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{usuario.activo ? 'Activo' : 'Inactivo'}</button>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--text-muted)]">{formatRelativeTime(usuario.created_at)}</td>
                    <td className="px-4 py-4"><Button variant="ghost" size="sm" onClick={() => router.push(`/usuarios/${usuario.id}`)}>Editar</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Usuario" footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button><Button onClick={handleSubmit} loading={saving}>Crear Usuario</Button></>}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre Completo" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
          <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
          <Input label="Teléfono" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} />
          <Select label="Rol" value={formData.rol} onChange={(e) => setFormData({ ...formData, rol: e.target.value })} options={[{ value: 'vendedor', label: 'Vendedor' }, { value: 'distribuidor', label: 'Distribuidor' }, { value: 'admin', label: 'Administrador' }]} />
          <Input label="Contraseña Temporal" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required hint="El usuario deberá cambiarla al iniciar sesión" />
        </form>
      </Modal>
    </div>
  )
}
