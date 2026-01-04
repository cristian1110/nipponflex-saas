'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Cliente {
  id: number
  nombre_empresa: string
  email: string
  telefono?: string
  plan: string
  plan_nombre?: string
  estado: string
  tipo_cliente: string
  total_usuarios: number
  whatsapps_conectados: number
  created_at: string
}

interface Configuracion {
  id: number
  clave: string
  valor: string
  descripcion: string
  tipo: string
  hasValue: boolean
  source?: 'database' | 'env' | 'none'
}

interface Plan {
  id: number
  nombre: string
  precio: number
}

export default function SistemaAdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'clientes' | 'config' | 'usuarios'>('clientes')

  // Clientes
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [showCrearCliente, setShowCrearCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({ nombre_empresa: '', email: '', telefono: '', plan_id: '1', tipo_cliente: 'normal' })
  const [creandoCliente, setCreandoCliente] = useState(false)

  // Configuraciones
  const [configs, setConfigs] = useState<Configuracion[]>([])
  const [editingConfig, setEditingConfig] = useState<string | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [savingConfig, setSavingConfig] = useState(false)

  // Planes
  const [planes, setPlanes] = useState<Plan[]>([])

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      if (data.nivel < 100) { router.push('/dashboard'); return }
      setUser(data)
      loadData()
    } catch { router.push('/login') }
  }

  const loadData = async () => {
    setLoading(true)
    await Promise.all([loadClientes(), loadConfigs(), loadPlanes()])
    setLoading(false)
  }

  const loadClientes = async () => {
    try {
      const res = await fetch('/api/admin/clientes')
      if (res.ok) setClientes(await res.json())
    } catch (e) { console.error(e) }
  }

  const loadConfigs = async () => {
    try {
      const res = await fetch('/api/admin/configuracion')
      if (res.ok) {
        const data = await res.json()
        setConfigs(data)
        const values: Record<string, string> = {}
        data.forEach((c: Configuracion) => { values[c.clave] = c.valor })
        setConfigValues(values)
      }
    } catch (e) { console.error(e) }
  }

  const loadPlanes = async () => {
    try {
      const res = await fetch('/api/planes')
      if (res.ok) setPlanes(await res.json())
    } catch (e) { console.error(e) }
  }

  const crearCliente = async () => {
    if (!nuevoCliente.nombre_empresa || !nuevoCliente.email) {
      setMessage({ type: 'error', text: 'Nombre y email son requeridos' })
      return
    }
    setCreandoCliente(true)
    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoCliente)
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Cliente creado exitosamente' })
        setShowCrearCliente(false)
        setNuevoCliente({ nombre_empresa: '', email: '', telefono: '', plan_id: '1', tipo_cliente: 'normal' })
        loadClientes()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexion' })
    }
    setCreandoCliente(false)
  }

  const guardarConfig = async (clave: string) => {
    setSavingConfig(true)
    try {
      const res = await fetch('/api/admin/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave, valor: configValues[clave] })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Configuracion guardada' })
        setEditingConfig(null)
        loadConfigs()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexion' })
    }
    setSavingConfig(false)
  }

  const toggleClienteEstado = async (id: number, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo'
    try {
      await fetch('/api/admin/clientes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: nuevoEstado })
      })
      loadClientes()
    } catch (e) { console.error(e) }
  }

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
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Administracion del Sistema</h1>
          <p className="text-sm text-[var(--text-secondary)]">Configuracion global - Solo Super Admin</p>
        </div>

        {/* Tabs */}
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('clientes')}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'clientes'
                  ? 'border-emerald-500 text-emerald-500'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Clientes/Empresas
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'config'
                  ? 'border-emerald-500 text-emerald-500'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Integraciones Globales
            </button>
          </div>
        </div>

        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="float-right">&times;</button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {/* TAB: CLIENTES */}
          {activeTab === 'clientes' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Clientes Registrados</h2>
                <button
                  onClick={() => setShowCrearCliente(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                >
                  + Nuevo Cliente
                </button>
              </div>

              <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[var(--bg-tertiary)]">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Empresa</th>
                      <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Email</th>
                      <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Plan</th>
                      <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Tipo</th>
                      <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Usuarios</th>
                      <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">WhatsApp</th>
                      <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Estado</th>
                      <th className="text-left px-4 py-3 text-sm text-[var(--text-secondary)]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map(c => (
                      <tr key={c.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]">
                        <td className="px-4 py-3 text-[var(--text-primary)]">{c.nombre_empresa}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{c.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                            {c.plan_nombre || c.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            c.tipo_cliente === 'superadmin' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {c.tipo_cliente}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-primary)]">{c.total_usuarios}</td>
                        <td className="px-4 py-3">
                          <span className={`w-3 h-3 rounded-full inline-block ${c.whatsapps_conectados > 0 ? 'bg-emerald-400' : 'bg-gray-400'}`}></span>
                          <span className="ml-2 text-sm text-[var(--text-secondary)]">{c.whatsapps_conectados}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${c.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {c.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleClienteEstado(c.id, c.estado)}
                            className={`px-3 py-1 rounded text-xs ${
                              c.estado === 'activo'
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            }`}
                          >
                            {c.estado === 'activo' ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: CONFIGURACION GLOBAL */}
          {activeTab === 'config' && (
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Integraciones y API Keys</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Configura las credenciales globales del sistema. Estas claves se usan cuando un cliente no tiene su propia configuracion.
              </p>

              <div className="space-y-4">
                {/* Agrupar por categoria */}
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
                  <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span>Inteligencia Artificial</span>
                  </h3>
                  <div className="space-y-3">
                    {configs.filter(c => ['GROQ_API_KEY', 'JINA_API_KEY'].includes(c.clave)).map(config => (
                      <div key={config.clave} className="flex items-center gap-4 p-3 bg-[var(--bg-primary)] rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-[var(--text-primary)]">{config.clave}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{config.descripcion}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingConfig === config.clave ? (
                            <>
                              <input
                                type={config.tipo === 'password' ? 'password' : 'text'}
                                value={configValues[config.clave] || ''}
                                onChange={(e) => setConfigValues({ ...configValues, [config.clave]: e.target.value })}
                                className="px-3 py-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] w-64"
                                placeholder="Ingresa el valor..."
                              />
                              <button
                                onClick={() => guardarConfig(config.clave)}
                                disabled={savingConfig}
                                className="px-3 py-1 bg-emerald-600 text-white rounded text-sm"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => setEditingConfig(null)}
                                className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <span className={`px-3 py-1 rounded text-sm ${config.hasValue ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {config.hasValue ? (config.source === 'env' ? 'ENV' : 'Configurado') : 'No configurado'}
                              </span>
                              <button
                                onClick={() => setEditingConfig(config.clave)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                              >
                                Editar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
                  <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span>Voz y Audio (ElevenLabs)</span>
                  </h3>
                  <div className="space-y-3">
                    {configs.filter(c => c.clave === 'ELEVENLABS_API_KEY').map(config => (
                      <div key={config.clave} className="flex items-center gap-4 p-3 bg-[var(--bg-primary)] rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-[var(--text-primary)]">{config.clave}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{config.descripcion}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingConfig === config.clave ? (
                            <>
                              <input
                                type="password"
                                value={configValues[config.clave] || ''}
                                onChange={(e) => setConfigValues({ ...configValues, [config.clave]: e.target.value })}
                                className="px-3 py-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] w-64"
                              />
                              <button onClick={() => guardarConfig(config.clave)} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">Guardar</button>
                              <button onClick={() => setEditingConfig(null)} className="px-3 py-1 bg-gray-600 text-white rounded text-sm">Cancelar</button>
                            </>
                          ) : (
                            <>
                              <span className={`px-3 py-1 rounded text-sm ${config.hasValue ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {config.hasValue ? (config.source === 'env' ? 'ENV' : 'Configurado') : 'No configurado'}
                              </span>
                              <button onClick={() => setEditingConfig(config.clave)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Editar</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
                  <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span>WhatsApp (Evolution API)</span>
                  </h3>
                  <div className="space-y-3">
                    {configs.filter(c => ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY'].includes(c.clave)).map(config => (
                      <div key={config.clave} className="flex items-center gap-4 p-3 bg-[var(--bg-primary)] rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-[var(--text-primary)]">{config.clave}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{config.descripcion}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingConfig === config.clave ? (
                            <>
                              <input
                                type={config.tipo === 'password' ? 'password' : 'text'}
                                value={configValues[config.clave] || ''}
                                onChange={(e) => setConfigValues({ ...configValues, [config.clave]: e.target.value })}
                                className="px-3 py-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] w-64"
                              />
                              <button onClick={() => guardarConfig(config.clave)} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">Guardar</button>
                              <button onClick={() => setEditingConfig(null)} className="px-3 py-1 bg-gray-600 text-white rounded text-sm">Cancelar</button>
                            </>
                          ) : (
                            <>
                              <span className={`px-3 py-1 rounded text-sm ${config.hasValue ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {config.hasValue ? (config.source === 'env' ? 'ENV' : 'Configurado') : 'No configurado'}
                              </span>
                              <button onClick={() => setEditingConfig(config.clave)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Editar</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
                  <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span>Base de Datos Vectorial (Qdrant)</span>
                  </h3>
                  <div className="space-y-3">
                    {configs.filter(c => c.clave === 'QDRANT_URL').map(config => (
                      <div key={config.clave} className="flex items-center gap-4 p-3 bg-[var(--bg-primary)] rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-[var(--text-primary)]">{config.clave}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{config.descripcion}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingConfig === config.clave ? (
                            <>
                              <input
                                type="text"
                                value={configValues[config.clave] || ''}
                                onChange={(e) => setConfigValues({ ...configValues, [config.clave]: e.target.value })}
                                className="px-3 py-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] w-64"
                              />
                              <button onClick={() => guardarConfig(config.clave)} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">Guardar</button>
                              <button onClick={() => setEditingConfig(null)} className="px-3 py-1 bg-gray-600 text-white rounded text-sm">Cancelar</button>
                            </>
                          ) : (
                            <>
                              <span className={`px-3 py-1 rounded text-sm ${config.hasValue ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {config.hasValue ? (config.source === 'env' ? 'ENV' : 'Configurado') : 'No configurado'}
                              </span>
                              <button onClick={() => setEditingConfig(config.clave)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Editar</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
                  <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span>Email (SMTP)</span>
                  </h3>
                  <div className="space-y-3">
                    {configs.filter(c => c.clave.startsWith('SMTP_')).map(config => (
                      <div key={config.clave} className="flex items-center gap-4 p-3 bg-[var(--bg-primary)] rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-[var(--text-primary)]">{config.clave}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{config.descripcion}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingConfig === config.clave ? (
                            <>
                              <input
                                type={config.tipo === 'password' ? 'password' : 'text'}
                                value={configValues[config.clave] || ''}
                                onChange={(e) => setConfigValues({ ...configValues, [config.clave]: e.target.value })}
                                className="px-3 py-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] w-64"
                              />
                              <button onClick={() => guardarConfig(config.clave)} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">Guardar</button>
                              <button onClick={() => setEditingConfig(null)} className="px-3 py-1 bg-gray-600 text-white rounded text-sm">Cancelar</button>
                            </>
                          ) : (
                            <>
                              <span className={`px-3 py-1 rounded text-sm ${config.hasValue ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {config.hasValue ? (config.source === 'env' ? 'ENV' : 'Configurado') : 'No configurado'}
                              </span>
                              <button onClick={() => setEditingConfig(config.clave)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Editar</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Cliente */}
      {showCrearCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Nuevo Cliente</h3>
              <button onClick={() => setShowCrearCliente(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre de la empresa *</label>
                <input
                  type="text"
                  value={nuevoCliente.nombre_empresa}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre_empresa: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Email *</label>
                <input
                  type="email"
                  value={nuevoCliente.email}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Telefono</label>
                <input
                  type="tel"
                  value={nuevoCliente.telefono}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Plan</label>
                <select
                  value={nuevoCliente.plan_id}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, plan_id: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                >
                  {planes.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Tipo de cliente</label>
                <select
                  value={nuevoCliente.tipo_cliente}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, tipo_cliente: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                >
                  <option value="normal">Normal</option>
                  <option value="superadmin">Super Admin (sin limites)</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCrearCliente(false)}
                  className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={crearCliente}
                  disabled={creandoCliente}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                >
                  {creandoCliente ? 'Creando...' : 'Crear Cliente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
