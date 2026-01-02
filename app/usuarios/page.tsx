'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Usuario {
  id: number
  nombre: string
  email: string
  rol: string
  nivel: number
  estado: string
  created_at: string
}

interface Invitacion {
  id: number
  nombre: string
  email: string
  tipo: string
  estado: string
  plan_nombre?: string
  token?: string
  expira_at: string
  created_at: string
}

interface Plan {
  id: number
  nombre: string
  descripcion: string
}

export default function UsuariosPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'usuarios' | 'invitaciones'>('usuarios')
  
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [planes, setPlanes] = useState<Plan[]>([])
  
  const [showInvitar, setShowInvitar] = useState(false)
  const [invitando, setInvitando] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const [linkGenerado, setLinkGenerado] = useState<string | null>(null)
  
  const [newInvite, setNewInvite] = useState({
    nombre: '',
    email: '',
    tipo: 'cliente',
    plan_id: '',
    limite_contactos: 500,
    limite_mensajes: 1000
  })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      console.log('Usuario actual:', data) // Debug
      setUser(data)
      loadData()
      loadPlanes()
    } catch { router.push('/login') }
  }

  const loadData = async () => {
    try {
      const resUsuarios = await fetch('/api/usuarios')
      if (resUsuarios.ok) {
        const data = await resUsuarios.json()
        setUsuarios(Array.isArray(data) ? data : [])
      }
      
      const resInvitaciones = await fetch('/api/admin/invitaciones')
      if (resInvitaciones.ok) {
        const data = await resInvitaciones.json()
        setInvitaciones(Array.isArray(data) ? data : [])
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const loadPlanes = async () => {
    try {
      const res = await fetch('/api/planes')
      if (res.ok) {
        const data = await res.json()
        setPlanes(Array.isArray(data) ? data : [])
      }
    } catch (e) { console.error(e) }
  }

  const enviarInvitacion = async () => {
    if (!newInvite.nombre || !newInvite.email) {
      setMessage({ type: 'error', text: 'Nombre y email son requeridos' })
      return
    }

    setInvitando(true)
    setMessage(null)
    setLinkGenerado(null)

    try {
      const res = await fetch('/api/admin/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newInvite,
          plan_id: newInvite.plan_id ? Number(newInvite.plan_id) : null
        })
      })
      const data = await res.json()

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: data.email_enviado 
            ? `Invitacion enviada a ${newInvite.email}` 
            : `Invitacion creada (configura email SMTP para enviar automaticamente)`
        })
        setLinkGenerado(data.link)
        loadData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al crear invitacion' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexion' })
    }
    setInvitando(false)
  }

  const cancelarInvitacion = async (id: number) => {
    if (!confirm('Cancelar esta invitacion?')) return
    try {
      await fetch(`/api/admin/invitaciones?id=${id}`, { method: 'DELETE' })
      loadData()
    } catch (e) { console.error(e) }
  }

  const copiarLink = (text: string) => {
    navigator.clipboard.writeText(text)
    setMessage({ type: 'success', text: 'Link copiado al portapapeles' })
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-500/20 text-yellow-400'
      case 'aceptada': return 'bg-emerald-500/20 text-emerald-400'
      case 'expirada': return 'bg-gray-500/20 text-gray-400'
      case 'cancelada': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  // Verificar permisos - nivel >= 50 es admin o superadmin
  const isAdmin = user?.nivel >= 50
  const isSuperAdmin = user?.nivel >= 100

  if (loading) {
    return (
      <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">👥 Usuarios</h1>
            <p className="text-sm text-[var(--text-secondary)]">Gestiona usuarios e invitaciones</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setShowInvitar(true); setMessage(null); setLinkGenerado(null); setNewInvite({ nombre: '', email: '', tipo: 'cliente', plan_id: '', limite_contactos: 500, limite_mensajes: 1000 }); }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <span>+</span> Invitar Usuario
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`py-3 px-1 border-b-2 transition-colors ${
                activeTab === 'usuarios' 
                  ? 'border-emerald-500 text-emerald-500' 
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              👤 Usuarios Activos ({usuarios.length})
            </button>
            <button
              onClick={() => setActiveTab('invitaciones')}
              className={`py-3 px-1 border-b-2 transition-colors ${
                activeTab === 'invitaciones' 
                  ? 'border-emerald-500 text-emerald-500' 
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              📧 Invitaciones ({invitaciones.filter(i => i.estado === 'pendiente').length} pendientes)
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Tab Usuarios */}
          {activeTab === 'usuarios' && (
            <div className="space-y-4">
              {usuarios.length === 0 ? (
                <div className="text-center py-12 bg-[var(--bg-secondary)] rounded-xl">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-[var(--text-secondary)]">No hay usuarios registrados</p>
                  {isAdmin && (
                    <button onClick={() => setShowInvitar(true)} className="mt-4 text-emerald-500 hover:underline">
                      + Invitar primer usuario
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[var(--bg-tertiary)]">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Usuario</th>
                        <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Email</th>
                        <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Rol</th>
                        <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Estado</th>
                        <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map(u => (
                        <tr key={u.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-medium">
                                {u.nombre?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <span className="text-[var(--text-primary)]">{u.nombre}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              u.nivel >= 100 ? 'bg-purple-500/20 text-purple-400' :
                              u.nivel >= 50 ? 'bg-blue-500/20 text-blue-400' :
                              u.nivel >= 30 ? 'bg-cyan-500/20 text-cyan-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {u.rol}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${u.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {u.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-tertiary)] text-sm">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab Invitaciones */}
          {activeTab === 'invitaciones' && (
            <div className="space-y-4">
              {invitaciones.length === 0 ? (
                <div className="text-center py-12 bg-[var(--bg-secondary)] rounded-xl">
                  <div className="text-4xl mb-3">📧</div>
                  <p className="text-[var(--text-secondary)]">No hay invitaciones</p>
                  {isAdmin && (
                    <button onClick={() => setShowInvitar(true)} className="mt-4 text-emerald-500 hover:underline">
                      + Crear primera invitacion
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {invitaciones.map(inv => (
                    <div key={inv.id} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                            {inv.nombre?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">{inv.nombre}</p>
                            <p className="text-sm text-[var(--text-secondary)]">{inv.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            inv.tipo === 'cliente' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {inv.tipo === 'cliente' ? 'Cliente' : 'Sub-usuario'}
                          </span>
                          {inv.plan_nombre && (
                            <span className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
                              {inv.plan_nombre}
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs ${getEstadoColor(inv.estado)}`}>
                            {inv.estado}
                          </span>
                        </div>
                      </div>
                      
                      {inv.estado === 'pendiente' && inv.token && (
                        <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                          <p className="text-xs text-[var(--text-tertiary)]">
                            Expira: {new Date(inv.expira_at).toLocaleString()}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => copiarLink(`${window.location.origin}/activar/${inv.token}`)}
                              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                            >
                              📋 Copiar link
                            </button>
                            <button
                              onClick={() => cancelarInvitacion(inv.id)}
                              className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Invitar */}
      {showInvitar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">➕ Invitar Usuario</h3>
              <button onClick={() => setShowInvitar(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl">&times;</button>
            </div>

            {message && (
              <div className={`p-3 rounded-lg mb-4 text-sm ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {message.text}
              </div>
            )}

            {linkGenerado && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
                <p className="text-xs text-blue-400 mb-2">📎 Link de activacion (comparte con el usuario):</p>
                <div className="flex gap-2">
                  <input type="text" value={linkGenerado} readOnly className="flex-1 px-2 py-1 bg-[var(--bg-primary)] rounded text-xs text-[var(--text-primary)] border border-[var(--border-color)]" />
                  <button onClick={() => copiarLink(linkGenerado)} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Copiar</button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Tipo de usuario</label>
                  <select
                    value={newInvite.tipo}
                    onChange={(e) => setNewInvite({ ...newInvite, tipo: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  >
                    <option value="cliente">🏢 Nuevo Cliente (cuenta independiente)</option>
                    <option value="sub_usuario">👤 Sub-usuario (dentro de mi cuenta)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={newInvite.nombre}
                  onChange={(e) => setNewInvite({ ...newInvite, nombre: e.target.value })}
                  placeholder="Juan Perez"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Email *</label>
                <input
                  type="email"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                  placeholder="juan@empresa.com"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              {newInvite.tipo === 'cliente' && isSuperAdmin && planes.length > 0 && (
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Plan</label>
                  <select
                    value={newInvite.plan_id}
                    onChange={(e) => setNewInvite({ ...newInvite, plan_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  >
                    <option value="">Seleccionar plan...</option>
                    {planes.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} - {p.descripcion}</option>
                    ))}
                  </select>
                </div>
              )}

              {newInvite.tipo === 'sub_usuario' && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <p className="text-sm text-purple-400 mb-2">Limites para este sub-usuario:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--text-tertiary)] mb-1">Contactos</label>
                      <input
                        type="number"
                        value={newInvite.limite_contactos}
                        onChange={(e) => setNewInvite({ ...newInvite, limite_contactos: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-tertiary)] mb-1">Mensajes/mes</label>
                      <input
                        type="number"
                        value={newInvite.limite_mensajes}
                        onChange={(e) => setNewInvite({ ...newInvite, limite_mensajes: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInvitar(false)}
                className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-primary)]"
              >
                Cancelar
              </button>
              <button
                onClick={enviarInvitacion}
                disabled={invitando || !newInvite.nombre || !newInvite.email}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-700"
              >
                {invitando ? 'Enviando...' : '📧 Enviar Invitacion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
