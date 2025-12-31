
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Button from '@/components/Button'
import Input, { Textarea, Select } from '@/components/Input'
import { LoadingPage } from '@/components/Loading'

export default function ConfiguracionPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('perfil')
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })
  
  const [perfil, setPerfil] = useState({ nombre: '', email: '', telefono: '' })
  const [password, setPassword] = useState({ actual: '', nueva: '', confirmar: '' })
  const [empresa, setEmpresa] = useState({ nombre: '', direccion: '', telefono: '', email: '', logo: '' })
  const [notificaciones, setNotificaciones] = useState({ email_nuevos_leads: true, email_mensajes: false, push_enabled: true })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const userData = await res.json()
        setUser(userData)
        setPerfil({ nombre: userData.nombre, email: userData.email, telefono: userData.telefono || '' })
        setLoading(false)
      } else router.push('/login')
    } catch { router.push('/login') }
  }

  const savePerfil = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/usuarios/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(perfil) })
      if (res.ok) setMensaje({ tipo: 'success', texto: 'Perfil actualizado correctamente' })
      else setMensaje({ tipo: 'error', texto: 'Error al actualizar perfil' })
    } catch { setMensaje({ tipo: 'error', texto: 'Error de conexión' }) }
    finally { setSaving(false); setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000) }
  }

  const changePassword = async () => {
    if (password.nueva !== password.confirmar) { setMensaje({ tipo: 'error', texto: 'Las contraseñas no coinciden' }); return }
    if (password.nueva.length < 8) { setMensaje({ tipo: 'error', texto: 'La contraseña debe tener al menos 8 caracteres' }); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password_actual: password.actual, password_nueva: password.nueva }) })
      if (res.ok) { setMensaje({ tipo: 'success', texto: 'Contraseña actualizada' }); setPassword({ actual: '', nueva: '', confirmar: '' }) }
      else { const data = await res.json(); setMensaje({ tipo: 'error', texto: data.error || 'Error al cambiar contraseña' }) }
    } catch { setMensaje({ tipo: 'error', texto: 'Error de conexión' }) }
    finally { setSaving(false); setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000) }
  }

  const tabs = [
    { id: 'perfil', label: '👤 Mi Perfil', minLevel: 1 },
    { id: 'seguridad', label: '🔒 Seguridad', minLevel: 1 },
    { id: 'empresa', label: '🏢 Empresa', minLevel: 4 },
    { id: 'notificaciones', label: '🔔 Notificaciones', minLevel: 1 },
    { id: 'facturacion', label: '💳 Facturación', minLevel: 4 },
  ].filter(t => user?.nivel >= t.minLevel)

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <main className="ml-64">
        <Header title="Configuración" subtitle="Administra tu cuenta y preferencias" />
        <div className="p-6">
          {mensaje.texto && (
            <div className={`mb-6 p-4 rounded-lg ${mensaje.tipo === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{mensaje.texto}</div>
          )}
          <div className="flex gap-6">
            {/* Tabs */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full px-4 py-3 text-left text-sm transition-colors ${activeTab === tab.id ? 'bg-green-500/10 text-green-500 border-l-2 border-green-500' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>{tab.label}</button>
                ))}
              </div>
            </div>
            {/* Content */}
            <div className="flex-1">
              <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
                {activeTab === 'perfil' && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Información Personal</h2>
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold">{perfil.nombre.charAt(0)}</div>
                      <div><p className="font-medium text-[var(--text-primary)]">{perfil.nombre}</p><p className="text-sm text-[var(--text-muted)]">{user.rol} • Nivel {user.nivel}</p></div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Input label="Nombre Completo" value={perfil.nombre} onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })} />
                      <Input label="Teléfono" value={perfil.telefono} onChange={(e) => setPerfil({ ...perfil, telefono: e.target.value })} />
                    </div>
                    <Input label="Email" type="email" value={perfil.email} onChange={(e) => setPerfil({ ...perfil, email: e.target.value })} disabled hint="El email no puede ser modificado" />
                    <Button onClick={savePerfil} loading={saving}>Guardar Cambios</Button>
                  </div>
                )}
                {activeTab === 'seguridad' && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cambiar Contraseña</h2>
                    <Input label="Contraseña Actual" type="password" value={password.actual} onChange={(e) => setPassword({ ...password, actual: e.target.value })} />
                    <Input label="Nueva Contraseña" type="password" value={password.nueva} onChange={(e) => setPassword({ ...password, nueva: e.target.value })} hint="Mínimo 8 caracteres" />
                    <Input label="Confirmar Contraseña" type="password" value={password.confirmar} onChange={(e) => setPassword({ ...password, confirmar: e.target.value })} />
                    <Button onClick={changePassword} loading={saving}>Cambiar Contraseña</Button>
                    <div className="border-t border-[var(--border-color)] pt-6 mt-6">
                      <h3 className="font-medium text-[var(--text-primary)] mb-4">Sesiones Activas</h3>
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-4"><div className="flex items-center gap-3"><span className="text-2xl">💻</span><div><p className="text-sm font-medium text-[var(--text-primary)]">Este dispositivo</p><p className="text-xs text-[var(--text-muted)]">Activo ahora</p></div></div></div>
                    </div>
                  </div>
                )}
                {activeTab === 'empresa' && user.nivel >= 4 && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Datos de la Empresa</h2>
                    <Input label="Nombre de la Empresa" value={empresa.nombre} onChange={(e) => setEmpresa({ ...empresa, nombre: e.target.value })} />
                    <Input label="Dirección" value={empresa.direccion} onChange={(e) => setEmpresa({ ...empresa, direccion: e.target.value })} />
                    <div className="grid md:grid-cols-2 gap-4">
                      <Input label="Teléfono" value={empresa.telefono} onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })} />
                      <Input label="Email de Contacto" type="email" value={empresa.email} onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })} />
                    </div>
                    <Button onClick={() => {}} loading={saving}>Guardar Empresa</Button>
                  </div>
                )}
                {activeTab === 'notificaciones' && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Preferencias de Notificaciones</h2>
                    {[
                      { key: 'email_nuevos_leads', label: 'Nuevos leads', desc: 'Recibir email cuando llegue un nuevo lead' },
                      { key: 'email_mensajes', label: 'Mensajes nuevos', desc: 'Recibir email por cada mensaje de WhatsApp' },
                      { key: 'push_enabled', label: 'Notificaciones push', desc: 'Recibir notificaciones en el navegador' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg">
                        <div><p className="font-medium text-[var(--text-primary)]">{item.label}</p><p className="text-sm text-[var(--text-muted)]">{item.desc}</p></div>
                        <button onClick={() => setNotificaciones({ ...notificaciones, [item.key]: !notificaciones[item.key as keyof typeof notificaciones] })} className={`w-12 h-6 rounded-full transition-colors ${notificaciones[item.key as keyof typeof notificaciones] ? 'bg-green-500' : 'bg-[var(--border-color)]'}`}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${notificaciones[item.key as keyof typeof notificaciones] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'facturacion' && user.nivel >= 4 && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Facturación y Plan</h2>
                    <div className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20">
                      <div className="flex items-center justify-between mb-4"><span className="text-2xl">🌟</span><span className="px-3 py-1 bg-green-500 text-white text-sm rounded-full">Plan Pro</span></div>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">$199/mes</p>
                      <p className="text-sm text-[var(--text-muted)]">Facturación mensual • Próximo cobro: 15 Feb 2025</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg"><p className="text-sm text-[var(--text-muted)]">Agentes</p><p className="text-xl font-bold text-[var(--text-primary)]">2/3</p></div>
                      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg"><p className="text-sm text-[var(--text-muted)]">Usuarios</p><p className="text-xl font-bold text-[var(--text-primary)]">4/5</p></div>
                      <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg"><p className="text-sm text-[var(--text-muted)]">Mensajes</p><p className="text-xl font-bold text-[var(--text-primary)]">1,234/2,000</p></div>
                    </div>
                    <Button variant="secondary">Cambiar Plan</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
