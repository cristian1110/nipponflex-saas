'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Proveedor {
  id: number
  nombre: string
  tipo: string
  icono: string
  descripcion: string
  configurado: boolean
  activo: boolean
}

interface OdooConfig {
  configurado: boolean
  activo: boolean
  ultimo_test: string
  test_exitoso: boolean
  config: {
    url: string
    database: string
    username: string
    hasApiKey: boolean
  }
}

interface OdooModulo {
  id: number
  name: string
  shortdesc: string
}

export default function IntegracionesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'todas' | 'odoo'>('todas')
  
  // Odoo
  const [odooConfig, setOdooConfig] = useState<OdooConfig | null>(null)
  const [odooForm, setOdooForm] = useState({ url: '', database: '', username: '', api_key: '' })
  const [odooModulos, setOdooModulos] = useState<OdooModulo[]>([])
  const [testingOdoo, setTestingOdoo] = useState(false)
  const [savingOdoo, setSavingOdoo] = useState(false)
  const [syncingOdoo, setSyncingOdoo] = useState(false)
  const [odooData, setOdooData] = useState<any>(null)
  const [selectedOdooTab, setSelectedOdooTab] = useState<string>('config')

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
      loadOdooConfig()
    } catch { router.push('/login') }
    setLoading(false)
  }

  const loadOdooConfig = async () => {
    try {
      const res = await fetch('/api/integraciones/odoo')
      if (res.ok) {
        const data = await res.json()
        setOdooConfig(data)
        if (data.config) {
          setOdooForm({
            url: data.config.url || '',
            database: data.config.database || '',
            username: data.config.username || '',
            api_key: ''
          })
        }
      }
    } catch (e) { console.error(e) }
  }

  const testOdooConnection = async () => {
    setTestingOdoo(true)
    try {
      const res = await fetch('/api/integraciones/odoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formatOdooForm(), action: 'test' })
      })
      const data = await res.json()
      if (data.success) {
        alert(`✅ Conexión exitosa! ${data.modulos_instalados} módulos encontrados`)
        loadOdooConfig()
        loadOdooModules()
      } else {
        alert('❌ ' + (data.error || 'Error de conexión'))
      }
    } catch (e) { alert('Error de conexión') }
    setTestingOdoo(false)
  }

  const saveOdooConfig = async () => {
    setSavingOdoo(true)
    try {
      const res = await fetch('/api/integraciones/odoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formatOdooForm())
      })
      const data = await res.json()
      if (data.success) {
        alert(data.mensaje)
        loadOdooConfig()
        if (data.conexion) loadOdooModules()
      } else {
        alert('Error: ' + (data.error || 'No se pudo guardar'))
      }
    } catch (e) { alert('Error al guardar') }
    setSavingOdoo(false)
  }

  const formatOdooForm = () => ({
    odoo_url: odooForm.url.replace(/\/$/, ''),
    database: odooForm.database,
    username: odooForm.username,
    api_key: odooForm.api_key
  })

  const loadOdooModules = async () => {
    try {
      const res = await fetch('/api/integraciones/odoo/data?tipo=modules')
      if (res.ok) {
        const data = await res.json()
        if (data.success) setOdooModulos(data.data || [])
      }
    } catch (e) { console.error(e) }
  }

  const loadOdooData = async (tipo: string) => {
    try {
      const res = await fetch(`/api/integraciones/odoo/data?tipo=${tipo}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setOdooData({ tipo, data: data.success ? data.data : [] })
      }
    } catch (e) { console.error(e) }
  }

  const syncOdoo = async (action: string, direction: string) => {
    setSyncingOdoo(true)
    try {
      const res = await fetch('/api/integraciones/odoo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, direction })
      })
      const data = await res.json()
      alert(data.mensaje || (data.success ? 'Sincronización completada' : 'Error'))
    } catch (e) { alert('Error en sincronización') }
    setSyncingOdoo(false)
  }

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">🔗 Integraciones</h1>
          <p className="text-sm text-[var(--text-secondary)]">Conecta NipponFlex con tus herramientas favoritas</p>
          
          <div className="flex gap-2 mt-4">
            <button onClick={() => setActiveTab('todas')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'todas' ? 'bg-emerald-600 text-white' : 'text-[var(--text-secondary)]'}`}>
              📋 Todas
            </button>
            <button onClick={() => setActiveTab('odoo')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'odoo' ? 'bg-emerald-600 text-white' : 'text-[var(--text-secondary)]'}`}>
              🟣 Odoo
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Tab Todas */}
          {activeTab === 'todas' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Odoo Card */}
              <div onClick={() => setActiveTab('odoo')} className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] cursor-pointer hover:border-emerald-500">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🟣</span>
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)]">Odoo</h3>
                    <p className="text-xs text-[var(--text-secondary)]">ERP/CRM</p>
                  </div>
                  <span className={`ml-auto px-2 py-1 rounded text-xs ${odooConfig?.test_exitoso ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {odooConfig?.test_exitoso ? '● Conectado' : '○ No conectado'}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">Sincroniza contactos, leads, facturas, inventario y más</p>
              </div>

              {/* Otras integraciones (próximamente) */}
              {[
                { icono: '📱', nombre: 'Twilio', desc: 'WhatsApp API oficial', prox: true },
                { icono: '☁️', nombre: 'Meta Cloud', desc: 'WhatsApp Business API', prox: true },
                { icono: '✈️', nombre: 'Telegram', desc: 'Bot API', prox: true },
                { icono: '📧', nombre: 'Gmail', desc: 'Email API', prox: true },
                { icono: '📅', nombre: 'Google Calendar', desc: 'Sincronizar citas', prox: true },
              ].map((int, i) => (
                <div key={i} className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] opacity-60">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{int.icono}</span>
                    <div>
                      <h3 className="font-bold text-[var(--text-primary)]">{int.nombre}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{int.desc}</p>
                    </div>
                    <span className="ml-auto px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">Próximamente</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab Odoo */}
          {activeTab === 'odoo' && (
            <div className="max-w-4xl">
              <div className="flex gap-2 mb-6">
                {['config', 'modulos', 'datos', 'sync'].map(tab => (
                  <button key={tab} onClick={() => setSelectedOdooTab(tab)} className={`px-4 py-2 rounded-lg text-sm capitalize ${selectedOdooTab === tab ? 'bg-purple-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
                    {tab === 'config' ? '⚙️ Configuración' : tab === 'modulos' ? '📦 Módulos' : tab === 'datos' ? '📊 Datos' : '🔄 Sincronizar'}
                  </button>
                ))}
              </div>

              {/* Config */}
              {selectedOdooTab === 'config' && (
                <div className="bg-[var(--bg-secondary)] rounded-xl p-6">
                  <h3 className="font-bold text-[var(--text-primary)] mb-4">Configuración de Odoo</h3>
                  
                  {odooConfig?.test_exitoso && (
                    <div className="mb-4 p-3 bg-emerald-500/20 rounded-lg text-emerald-400 text-sm">
                      ✅ Conectado correctamente • Último test: {new Date(odooConfig.ultimo_test).toLocaleString()}
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">URL de Odoo *</label>
                      <input type="url" value={odooForm.url} onChange={(e) => setOdooForm({ ...odooForm, url: e.target.value })} placeholder="https://tu-empresa.odoo.com" className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Base de datos *</label>
                      <input type="text" value={odooForm.database} onChange={(e) => setOdooForm({ ...odooForm, database: e.target.value })} placeholder="nombre_base_datos" className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Usuario (email) *</label>
                      <input type="email" value={odooForm.username} onChange={(e) => setOdooForm({ ...odooForm, username: e.target.value })} placeholder="admin@empresa.com" className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">API Key / Contraseña *</label>
                      <input type="password" value={odooForm.api_key} onChange={(e) => setOdooForm({ ...odooForm, api_key: e.target.value })} placeholder={odooConfig?.config?.hasApiKey ? '••••••••' : 'Tu API key o contraseña'} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">En Odoo 14+: Configuración → Usuarios → tu usuario → API Keys</p>
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <button onClick={testOdooConnection} disabled={testingOdoo || !odooForm.url || !odooForm.database || !odooForm.username} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                        {testingOdoo ? 'Probando...' : '🔍 Probar Conexión'}
                      </button>
                      <button onClick={saveOdooConfig} disabled={savingOdoo || !odooForm.url} className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                        {savingOdoo ? 'Guardando...' : '💾 Guardar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Módulos */}
              {selectedOdooTab === 'modulos' && (
                <div className="bg-[var(--bg-secondary)] rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[var(--text-primary)]">Módulos Instalados en Odoo</h3>
                    <button onClick={loadOdooModules} className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm">🔄 Actualizar</button>
                  </div>
                  
                  {odooModulos.length === 0 ? (
                    <p className="text-[var(--text-secondary)]">Conecta Odoo primero para ver los módulos</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {odooModulos.slice(0, 30).map(mod => (
                        <div key={mod.id} className="p-2 bg-[var(--bg-primary)] rounded text-sm">
                          <span className="text-[var(--text-primary)]">{mod.shortdesc || mod.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Datos */}
              {selectedOdooTab === 'datos' && (
                <div className="bg-[var(--bg-secondary)] rounded-xl p-6">
                  <h3 className="font-bold text-[var(--text-primary)] mb-4">Explorar Datos de Odoo</h3>
                  
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {['contacts', 'leads', 'orders', 'invoices', 'products', 'tickets'].map(tipo => (
                      <button key={tipo} onClick={() => loadOdooData(tipo)} className={`px-3 py-1 rounded-lg text-sm capitalize ${odooData?.tipo === tipo ? 'bg-purple-600 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`}>
                        {tipo}
                      </button>
                    ))}
                  </div>
                  
                  {odooData && (
                    <div className="mt-4">
                      <p className="text-sm text-[var(--text-secondary)] mb-2">{odooData.data?.length || 0} registros encontrados</p>
                      <div className="max-h-96 overflow-auto">
                        <pre className="text-xs bg-[var(--bg-primary)] p-3 rounded-lg text-[var(--text-primary)] overflow-x-auto">
                          {JSON.stringify(odooData.data?.slice(0, 5), null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sync */}
              {selectedOdooTab === 'sync' && (
                <div className="bg-[var(--bg-secondary)] rounded-xl p-6">
                  <h3 className="font-bold text-[var(--text-primary)] mb-4">Sincronización</h3>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
                      <h4 className="font-medium text-[var(--text-primary)] mb-2">👥 Contactos</h4>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">Sincroniza contactos entre NipponFlex y Odoo</p>
                      <div className="flex gap-2">
                        <button onClick={() => syncOdoo('contacts', 'to_odoo')} disabled={syncingOdoo} className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                          → Enviar a Odoo
                        </button>
                        <button onClick={() => syncOdoo('contacts', 'from_odoo')} disabled={syncingOdoo} className="px-3 py-1 bg-purple-600 text-white rounded text-sm disabled:opacity-50">
                          ← Traer de Odoo
                        </button>
                        <button onClick={() => syncOdoo('contacts', 'bidirectional')} disabled={syncingOdoo} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm disabled:opacity-50">
                          ↔ Bidireccional
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
                      <h4 className="font-medium text-[var(--text-primary)] mb-2">🎯 Leads</h4>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">Sincroniza leads del CRM</p>
                      <div className="flex gap-2">
                        <button onClick={() => syncOdoo('leads', 'to_odoo')} disabled={syncingOdoo} className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                          → Enviar a Odoo
                        </button>
                        <button onClick={() => syncOdoo('leads', 'from_odoo')} disabled={syncingOdoo} className="px-3 py-1 bg-purple-600 text-white rounded text-sm disabled:opacity-50">
                          ← Traer de Odoo
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {syncingOdoo && (
                    <div className="mt-4 p-3 bg-blue-500/20 rounded-lg text-blue-400 text-sm flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                      Sincronizando...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
