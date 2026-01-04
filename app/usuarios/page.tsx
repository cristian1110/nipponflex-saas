'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Usuario {
  id: number
  nombre: string
  email: string
  telefono?: string
  rol: string
  nivel: number
  estado: string
  debe_cambiar_password?: boolean
  ultimo_login?: string
  created_at: string
  cliente_nombre?: string
}

interface Rol {
  id: number
  nombre: string
  nivel: number
}

interface CredencialesCreadas {
  email: string
  password: string
  telefono?: string
}

export default function UsuariosPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])

  const [showCrear, setShowCrear] = useState(false)
  const [creando, setCreando] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  // Credenciales generadas al crear usuario
  const [credencialesCreadas, setCredencialesCreadas] = useState<CredencialesCreadas | null>(null)
  const [enviandoCredenciales, setEnviandoCredenciales] = useState(false)

  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: '',
    email: '',
    telefono: '',
    rol_id: '',
    cliente_id: ''
  })

  // Clientes (solo para super admin)
  const [clientes, setClientes] = useState<{ id: number; nombre_empresa: string }[]>([])

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      setUser(data)
      loadData()
      loadRoles()
      if (data.nivel >= 100) {
        loadClientes()
      }
    } catch { router.push('/login') }
  }

  const loadClientes = async () => {
    try {
      const res = await fetch('/api/admin/clientes')
      if (res.ok) {
        const data = await res.json()
        setClientes(Array.isArray(data) ? data : [])
      }
    } catch (e) { console.error(e) }
  }

  const loadData = async () => {
    try {
      const res = await fetch('/api/usuarios')
      if (res.ok) {
        const data = await res.json()
        setUsuarios(Array.isArray(data) ? data : [])
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const loadRoles = async () => {
    try {
      const res = await fetch('/api/roles')
      if (res.ok) {
        const data = await res.json()
        setRoles(Array.isArray(data) ? data : [])
      }
    } catch (e) { console.error(e) }
  }

  const crearUsuario = async () => {
    if (!nuevoUsuario.nombre || !nuevoUsuario.email) {
      setMessage({ type: 'error', text: 'Nombre y email son requeridos' })
      return
    }

    setCreando(true)
    setMessage(null)

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nuevoUsuario,
          rol_id: nuevoUsuario.rol_id ? Number(nuevoUsuario.rol_id) : null,
          cliente_id: nuevoUsuario.cliente_id ? Number(nuevoUsuario.cliente_id) : null
        })
      })
      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Usuario creado exitosamente' })
        setCredencialesCreadas({
          email: data.credenciales.email,
          password: data.credenciales.password,
          telefono: nuevoUsuario.telefono
        })
        loadData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al crear usuario' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexion' })
    }
    setCreando(false)
  }

  const enviarCredenciales = async (metodo: 'email' | 'whatsapp') => {
    if (!credencialesCreadas) return

    setEnviandoCredenciales(true)
    try {
      const res = await fetch('/api/usuarios/enviar-credenciales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credencialesCreadas.email,
          password: credencialesCreadas.password,
          telefono: credencialesCreadas.telefono,
          metodo
        })
      })
      const data = await res.json()
      setMessage({
        type: data.success ? 'success' : 'error',
        text: data.mensaje || data.error
      })
    } catch (e) {
      setMessage({ type: 'error', text: 'Error al enviar credenciales' })
    }
    setEnviandoCredenciales(false)
  }

  const copiarCredenciales = () => {
    if (!credencialesCreadas) return
    const texto = `Email: ${credencialesCreadas.email}\nContrasena: ${credencialesCreadas.password}`
    navigator.clipboard.writeText(texto)
    setMessage({ type: 'success', text: 'Credenciales copiadas al portapapeles' })
  }

  const cerrarModal = () => {
    setShowCrear(false)
    setCredencialesCreadas(null)
    setMessage(null)
    setNuevoUsuario({ nombre: '', email: '', telefono: '', rol_id: '', cliente_id: '' })
  }

  const toggleEstado = async (id: number, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo'
    try {
      const res = await fetch('/api/usuarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: nuevoEstado })
      })
      if (res.ok) loadData()
    } catch (e) { console.error(e) }
  }

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
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Usuarios</h1>
            <p className="text-sm text-[var(--text-secondary)]">Gestiona los usuarios de tu cuenta</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCrear(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <span>+</span> Nuevo Usuario
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {usuarios.length === 0 ? (
            <div className="text-center py-12 bg-[var(--bg-secondary)] rounded-xl">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-[var(--text-secondary)]">No hay usuarios registrados</p>
              {isAdmin && (
                <button onClick={() => setShowCrear(true)} className="mt-4 text-emerald-500 hover:underline">
                  + Crear primer usuario
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
                    {isSuperAdmin && <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Cliente</th>}
                    <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Rol</th>
                    <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Estado</th>
                    <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Ultimo Login</th>
                    {isAdmin && <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Acciones</th>}
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
                          <div>
                            <span className="text-[var(--text-primary)]">{u.nombre}</span>
                            {u.debe_cambiar_password && (
                              <span className="ml-2 text-xs text-yellow-500" title="Debe cambiar contrasena">*</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{u.email}</td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{u.cliente_nombre || '-'}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          u.nivel >= 100 ? 'bg-purple-500/20 text-purple-400' :
                          u.nivel >= 50 ? 'bg-blue-500/20 text-blue-400' :
                          u.nivel >= 30 ? 'bg-cyan-500/20 text-cyan-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {u.rol || 'Sin rol'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${u.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {u.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-tertiary)] text-sm">
                        {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString() : 'Nunca'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {u.id !== user?.id && (
                            <button
                              onClick={() => toggleEstado(u.id, u.estado)}
                              className={`px-3 py-1 rounded text-xs ${
                                u.estado === 'activo'
                                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              }`}
                            >
                              {u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Usuario */}
      {showCrear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {credencialesCreadas ? 'Usuario Creado' : 'Nuevo Usuario'}
              </h3>
              <button onClick={cerrarModal} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl">&times;</button>
            </div>

            {message && (
              <div className={`p-3 rounded-lg mb-4 text-sm ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {message.text}
              </div>
            )}

            {credencialesCreadas ? (
              // Mostrar credenciales y opciones de envio
              <div className="space-y-4">
                <div className="p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
                  <p className="text-sm text-[var(--text-secondary)] mb-2">Credenciales de acceso:</p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-[var(--text-tertiary)]">Email:</span>
                      <p className="text-[var(--text-primary)] font-mono">{credencialesCreadas.email}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--text-tertiary)]">Contrasena:</span>
                      <p className="text-emerald-400 font-mono font-bold">{credencialesCreadas.password}</p>
                    </div>
                  </div>
                  <p className="text-xs text-yellow-500 mt-3">* El usuario debera cambiar su contrasena en el primer inicio de sesion</p>
                </div>

                <p className="text-sm text-[var(--text-secondary)]">Enviar credenciales al usuario:</p>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => enviarCredenciales('email')}
                    disabled={enviandoCredenciales}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    📧 Enviar por Email
                  </button>

                  {credencialesCreadas.telefono && (
                    <button
                      onClick={() => enviarCredenciales('whatsapp')}
                      disabled={enviandoCredenciales}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      💬 Enviar por WhatsApp
                    </button>
                  )}

                  <button
                    onClick={copiarCredenciales}
                    className="w-full px-4 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-primary)] flex items-center justify-center gap-2"
                  >
                    📋 Copiar Credenciales
                  </button>
                </div>

                <button
                  onClick={cerrarModal}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 mt-4"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              // Formulario de creacion
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre completo *</label>
                  <input
                    type="text"
                    value={nuevoUsuario.nombre}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
                    placeholder="Juan Perez"
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Email *</label>
                  <input
                    type="email"
                    value={nuevoUsuario.email}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
                    placeholder="juan@empresa.com"
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Telefono (para WhatsApp)</label>
                  <input
                    type="tel"
                    value={nuevoUsuario.telefono}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, telefono: e.target.value })}
                    placeholder="593999999999"
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">Codigo de pais sin + (ej: 593 para Ecuador)</p>
                </div>

                {/* Selector de cliente - Solo para super admin */}
                {isSuperAdmin && (
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">Cliente/Empresa *</label>
                    <select
                      value={nuevoUsuario.cliente_id}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, cliente_id: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    >
                      <option value="">Seleccionar cliente...</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre_empresa}</option>
                      ))}
                    </select>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">El usuario pertenecera a este cliente</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Rol</label>
                  <select
                    value={nuevoUsuario.rol_id}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  >
                    <option value="">Seleccionar rol...</option>
                    {roles
                      .filter(r => isSuperAdmin ? true : r.nivel < user?.nivel) // Super admin puede crear todos los roles
                      .map(r => (
                        <option key={r.id} value={r.id}>{r.nombre} {r.nivel >= 100 ? '(Super Admin)' : ''}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-400">
                    Se generara una contrasena temporal automaticamente. Podras enviarla por email, WhatsApp o copiarla.
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={cerrarModal}
                    className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-primary)]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={crearUsuario}
                    disabled={creando || !nuevoUsuario.nombre || !nuevoUsuario.email}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-700"
                  >
                    {creando ? 'Creando...' : 'Crear Usuario'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
