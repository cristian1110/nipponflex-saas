'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Usuario {
  id: number
  nombre: string
  apellido?: string
  email: string
  rol: string
  nivel: number
  estado: boolean
  cliente_nombre?: string
  created_at: string
}

interface Rol {
  id: number
  nombre: string
  nivel: number
}

export default function UsuariosPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newUser, setNewUser] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol_id: 2
  })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      if (data.nivel < 4) { router.push('/dashboard'); return }
      setUser(data)
      loadData()
    } catch { router.push('/login') }
  }

  const loadData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/usuarios'),
        fetch('/api/roles')
      ])
      
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsuarios(Array.isArray(data) ? data : [])
      }
      
      if (rolesRes.ok) {
        const data = await rolesRes.json()
        setRoles(Array.isArray(data) ? data : [])
      } else {
        // Roles por defecto si no hay API
        setRoles([
          { id: 1, nombre: 'superadmin', nivel: 100 },
          { id: 2, nombre: 'admin', nivel: 50 },
          { id: 3, nombre: 'supervisor', nivel: 30 },
          { id: 4, nombre: 'operador', nivel: 20 },
          { id: 5, nombre: 'vendedor', nivel: 10 }
        ])
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const crearUsuario = async () => {
    if (!newUser.nombre || !newUser.email || !newUser.password) {
      setError('Completa todos los campos requeridos')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al crear usuario')
        setSaving(false)
        return
      }

      setShowNew(false)
      setNewUser({ nombre: '', apellido: '', email: '', password: '', rol_id: 2 })
      loadData()
    } catch (e) {
      setError('Error de conexión')
    }
    setSaving(false)
  }

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Usuarios</h1>
            <p className="text-xs text-[var(--text-secondary)]">{usuarios.length} usuarios registrados</p>
          </div>
          <button onClick={() => setShowNew(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
            + Nuevo Usuario
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-3">
            {usuarios.map((u) => (
              <div key={u.id} className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
                    {u.nombre[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{u.nombre} {u.apellido}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{u.email}</p>
                    {u.cliente_nombre && <p className="text-xs text-[var(--text-tertiary)]">{u.cliente_nombre}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${u.estado ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {u.estado ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs capitalize">
                    {u.rol}
                  </span>
                </div>
              </div>
            ))}
            
            {usuarios.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">👤</div>
                <p className="text-[var(--text-secondary)]">No hay usuarios registrados</p>
                <button onClick={() => setShowNew(true)} className="mt-3 text-emerald-500 hover:underline text-sm">
                  + Crear primer usuario
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nuevo Usuario */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Nuevo Usuario</h3>
              <button onClick={() => { setShowNew(false); setError('') }} className="text-[var(--text-secondary)]">✕</button>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Nombre *</label>
                <input 
                  type="text" 
                  placeholder="Nombre"
                  value={newUser.nombre} 
                  onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })} 
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" 
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Apellido</label>
                <input 
                  type="text" 
                  placeholder="Apellido"
                  value={newUser.apellido} 
                  onChange={(e) => setNewUser({ ...newUser, apellido: e.target.value })} 
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" 
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Email *</label>
                <input 
                  type="email" 
                  placeholder="correo@ejemplo.com"
                  value={newUser.email} 
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} 
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" 
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Contraseña *</label>
                <input 
                  type="password" 
                  placeholder="Mínimo 6 caracteres"
                  value={newUser.password} 
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} 
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" 
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Rol</label>
                <select 
                  value={newUser.rol_id} 
                  onChange={(e) => setNewUser({ ...newUser, rol_id: Number(e.target.value) })} 
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => { setShowNew(false); setError('') }} 
                className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
              >
                Cancelar
              </button>
              <button 
                onClick={crearUsuario} 
                disabled={saving || !newUser.nombre || !newUser.email || !newUser.password}
                className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Creando...
                  </>
                ) : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
