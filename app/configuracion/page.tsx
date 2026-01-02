'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function ConfiguracionPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('perfil')
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  
  // Perfil
  const [perfil, setPerfil] = useState({ nombre: '', email: '', telefono: '' })
  const [savingPerfil, setSavingPerfil] = useState(false)
  
  // Password
  const [passwords, setPasswords] = useState({ actual: '', nueva: '', confirmar: '' })
  const [savingPassword, setSavingPassword] = useState(false)
  
  // Email SMTP
  const [emailConfig, setEmailConfig] = useState({
    proveedor: 'custom',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: 'NipponFlex',
    reply_to: ''
  })
  const [emailStatus, setEmailStatus] = useState({
    configurado: false,
    test_exitoso: false,
    error_mensaje: null as string | null
  })
  const [savingEmail, setSavingEmail] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState('')

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      setUser(data)
      setPerfil({ nombre: data.nombre || '', email: data.email || '', telefono: data.telefono || '' })
      setTestEmailTo(data.email || '')
      loadEmailConfig()
    } catch { router.push('/login') }
    setLoading(false)
  }

  const loadEmailConfig = async () => {
    try {
      const res = await fetch('/api/admin/email')
      if (res.ok) {
        const data = await res.json()
        setEmailStatus({
          configurado: data.configurado,
          test_exitoso: data.test_exitoso,
          error_mensaje: data.error_mensaje
        })
        if (data.config) {
          let proveedor = 'custom'
          if (data.config.smtp_host?.includes('gmail')) proveedor = 'gmail'
          else if (data.config.smtp_host?.includes('outlook') || data.config.smtp_host?.includes('office365')) proveedor = 'outlook'
          
          setEmailConfig(prev => ({
            ...prev,
            proveedor,
            smtp_host: data.config.smtp_host || '',
            smtp_port: data.config.smtp_port || 587,
            smtp_secure: data.config.smtp_secure || false,
            smtp_user: data.config.smtp_user || '',
            from_email: data.config.from_email || '',
            from_name: data.config.from_name || 'NipponFlex',
            reply_to: data.config.reply_to || ''
          }))
        }
      }
    } catch (e) { console.error(e) }
  }

  const savePerfil = async () => {
    setSavingPerfil(true)
    setMessage(null)
    try {
      const res = await fetch('/api/auth/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perfil)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Perfil actualizado correctamente' })
      } else {
        setMessage({ type: 'error', text: 'Error al guardar perfil' })
      }
    } catch { setMessage({ type: 'error', text: 'Error de conexion' }) }
    setSavingPerfil(false)
  }

  const changePassword = async () => {
    if (passwords.nueva !== passwords.confirmar) {
      setMessage({ type: 'error', text: 'Las contrasenas no coinciden' })
      return
    }
    if (passwords.nueva.length < 6) {
      setMessage({ type: 'error', text: 'La contrasena debe tener al menos 6 caracteres' })
      return
    }
    
    setSavingPassword(true)
    setMessage(null)
    try {
      const res = await fetch('/api/auth/cambiar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual: passwords.actual, nueva: passwords.nueva })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: 'Contrasena actualizada correctamente' })
        setPasswords({ actual: '', nueva: '', confirmar: '' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al cambiar contrasena' })
      }
    } catch { setMessage({ type: 'error', text: 'Error de conexion' }) }
    setSavingPassword(false)
  }

  const changeEmailProvider = (proveedor: string) => {
    let config = { ...emailConfig, proveedor }
    switch (proveedor) {
      case 'gmail':
        config.smtp_host = 'smtp.gmail.com'
        config.smtp_port = 587
        config.smtp_secure = false
        break
      case 'outlook':
        config.smtp_host = 'smtp.office365.com'
        config.smtp_port = 587
        config.smtp_secure = false
        break
      case 'custom':
        config.smtp_host = ''
        config.smtp_port = 587
        config.smtp_secure = false
        break
    }
    setEmailConfig(config)
  }

  const saveEmailConfig = async () => {
    if (!emailConfig.smtp_host || !emailConfig.smtp_user) {
      setMessage({ type: 'error', text: 'Host y usuario SMTP son requeridos' })
      return
    }
    setSavingEmail(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailConfig)
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Configuracion de email guardada' })
        loadEmailConfig()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch { setMessage({ type: 'error', text: 'Error de conexion' }) }
    setSavingEmail(false)
  }

  const testEmail = async () => {
    if (!emailConfig.smtp_host || !emailConfig.smtp_user) {
      setMessage({ type: 'error', text: 'Primero configura el servidor SMTP' })
      return
    }
    setTestingEmail(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...emailConfig, action: 'test', test_email: testEmailTo || emailConfig.smtp_user })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: data.mensaje })
        loadEmailConfig()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error en el test' })
      }
    } catch { setMessage({ type: 'error', text: 'Error de conexion' }) }
    setTestingEmail(false)
  }

  const tabs = [
    { id: 'perfil', nombre: 'Mi Perfil', icon: '👤' },
    { id: 'seguridad', nombre: 'Seguridad', icon: '🔒' },
    { id: 'email', nombre: 'Email Saliente', icon: '📧' },
    { id: 'notificaciones', nombre: 'Notificaciones', icon: '🔔' },
  ]

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
          <h1 className="text-xl font-bold text-[var(--text-primary)]">⚙️ Configuracion</h1>
          <p className="text-sm text-[var(--text-secondary)]">Personaliza tu cuenta y preferencias</p>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
            <div className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMessage(null); }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                    activeTab === tab.id ? 'bg-emerald-600 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <span>{tab.icon}</span> {tab.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-2xl">
              {message && (
                <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {message.text}
                </div>
              )}

              {activeTab === 'perfil' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">👤 Mi Perfil</h2>
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] space-y-4">
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre completo</label>
                      <input type="text" value={perfil.nombre} onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Email</label>
                      <input type="email" value={perfil.email} disabled className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-tertiary)] cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Telefono</label>
                      <input type="tel" value={perfil.telefono} onChange={(e) => setPerfil({ ...perfil, telefono: e.target.value })} placeholder="+593..." className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <button onClick={savePerfil} disabled={savingPerfil} className="px-6 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-700">
                      {savingPerfil ? 'Guardando...' : '💾 Guardar cambios'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'seguridad' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">🔒 Seguridad</h2>
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] space-y-4">
                    <h3 className="font-medium text-[var(--text-primary)]">Cambiar contrasena</h3>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Contrasena actual</label>
                      <input type="password" value={passwords.actual} onChange={(e) => setPasswords({ ...passwords, actual: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Nueva contrasena</label>
                      <input type="password" value={passwords.nueva} onChange={(e) => setPasswords({ ...passwords, nueva: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">Confirmar contrasena</label>
                      <input type="password" value={passwords.confirmar} onChange={(e) => setPasswords({ ...passwords, confirmar: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <button onClick={changePassword} disabled={savingPassword || !passwords.actual || !passwords.nueva} className="px-6 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-700">
                      {savingPassword ? 'Cambiando...' : '🔐 Cambiar contrasena'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'email' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">📧 Email Saliente (SMTP)</h2>
                  <p className="text-sm text-[var(--text-secondary)]">Configura el servidor de correo para enviar notificaciones e invitaciones</p>
                  
                  <div className={`p-4 rounded-xl border ${emailStatus.test_exitoso ? 'bg-emerald-500/10 border-emerald-500/30' : emailStatus.configurado ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${emailStatus.test_exitoso ? 'bg-emerald-500' : emailStatus.configurado ? 'bg-yellow-500' : 'bg-gray-500'}`}></div>
                      <span className="text-[var(--text-primary)]">
                        {emailStatus.test_exitoso ? '✅ Email configurado y funcionando' : emailStatus.configurado ? '⚠️ Configurado pero no probado' : '⚪ No configurado'}
                      </span>
                    </div>
                    {emailStatus.error_mensaje && <p className="text-xs text-red-400 mt-2">Error: {emailStatus.error_mensaje}</p>}
                  </div>

                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)]">
                    <h3 className="font-medium text-[var(--text-primary)] mb-3">📬 Selecciona tu proveedor</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => changeEmailProvider('gmail')} className={`p-4 rounded-lg border-2 transition-all ${emailConfig.proveedor === 'gmail' ? 'border-red-500 bg-red-500/10' : 'border-[var(--border-color)] hover:border-red-500/50'}`}>
                        <div className="text-2xl mb-1">📧</div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">Gmail</div>
                        <div className="text-xs text-[var(--text-tertiary)]">Google</div>
                      </button>
                      <button onClick={() => changeEmailProvider('outlook')} className={`p-4 rounded-lg border-2 transition-all ${emailConfig.proveedor === 'outlook' ? 'border-blue-500 bg-blue-500/10' : 'border-[var(--border-color)] hover:border-blue-500/50'}`}>
                        <div className="text-2xl mb-1">📨</div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">Outlook</div>
                        <div className="text-xs text-[var(--text-tertiary)]">Hotmail</div>
                      </button>
                      <button onClick={() => changeEmailProvider('custom')} className={`p-4 rounded-lg border-2 transition-all ${emailConfig.proveedor === 'custom' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[var(--border-color)] hover:border-emerald-500/50'}`}>
                        <div className="text-2xl mb-1">🔧</div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">SMTP</div>
                        <div className="text-xs text-[var(--text-tertiary)]">Hosting</div>
                      </button>
                    </div>
                  </div>

                  {emailConfig.proveedor === 'gmail' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
                      <h3 className="font-medium text-red-400 mb-2">📌 Como configurar Gmail</h3>
                      <ol className="text-sm text-[var(--text-secondary)] space-y-2">
                        <li>1. Ve a <strong>myaccount.google.com/security</strong></li>
                        <li>2. Activa la <strong>Verificacion en 2 pasos</strong></li>
                        <li>3. Busca <strong>Contrasenas de aplicacion</strong></li>
                        <li>4. Crea una nueva para "Correo"</li>
                        <li>5. Copia la contrasena de 16 caracteres</li>
                      </ol>
                    </div>
                  )}

                  {emailConfig.proveedor === 'outlook' && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
                      <h3 className="font-medium text-blue-400 mb-2">📌 Como configurar Outlook/Hotmail</h3>
                      <ol className="text-sm text-[var(--text-secondary)] space-y-2">
                        <li>1. Ve a <strong>account.microsoft.com/security</strong></li>
                        <li>2. Activa la <strong>Verificacion en 2 pasos</strong></li>
                        <li>3. Busca <strong>Contrasenas de aplicacion</strong></li>
                        <li>4. Crea una nueva contrasena</li>
                        <li>5. Usa esa contrasena aqui</li>
                      </ol>
                    </div>
                  )}

                  {emailConfig.proveedor === 'custom' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
                      <h3 className="font-medium text-emerald-400 mb-2">📌 SMTP de tu Hosting</h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Usa los datos SMTP de tu proveedor de hosting (cPanel, Hostinger, etc.).<br/>
                        El host suele ser: <strong>mail.tudominio.com</strong>
                      </p>
                    </div>
                  )}

                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] space-y-4">
                    <h3 className="font-medium text-[var(--text-primary)]">🔧 Datos SMTP</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-1">Servidor SMTP</label>
                        <input type="text" value={emailConfig.smtp_host} onChange={(e) => setEmailConfig({ ...emailConfig, smtp_host: e.target.value })} placeholder="smtp.tudominio.com" disabled={emailConfig.proveedor !== 'custom'} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] disabled:opacity-60" />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-sm text-[var(--text-secondary)] mb-1">Puerto</label>
                          <input type="number" value={emailConfig.smtp_port} onChange={(e) => setEmailConfig({ ...emailConfig, smtp_port: Number(e.target.value) })} disabled={emailConfig.proveedor !== 'custom'} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] disabled:opacity-60" />
                        </div>
                        <div className="flex items-end pb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={emailConfig.smtp_secure} onChange={(e) => setEmailConfig({ ...emailConfig, smtp_secure: e.target.checked })} disabled={emailConfig.proveedor !== 'custom'} className="w-4 h-4 rounded" />
                            <span className="text-sm text-[var(--text-secondary)]">SSL</span>
                          </label>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">
                        {emailConfig.proveedor === 'gmail' ? 'Tu correo Gmail' : emailConfig.proveedor === 'outlook' ? 'Tu correo Outlook/Hotmail' : 'Usuario/Email SMTP'}
                      </label>
                      <input type="email" value={emailConfig.smtp_user} onChange={(e) => setEmailConfig({ ...emailConfig, smtp_user: e.target.value })} placeholder={emailConfig.proveedor === 'gmail' ? 'tucorreo@gmail.com' : emailConfig.proveedor === 'outlook' ? 'tucorreo@hotmail.com' : 'noreply@tudominio.com'} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-secondary)] mb-1">
                        {emailConfig.proveedor !== 'custom' ? 'Contrasena de aplicacion (16 caracteres)' : 'Contrasena SMTP'}
                      </label>
                      <input type="password" value={emailConfig.smtp_password} onChange={(e) => setEmailConfig({ ...emailConfig, smtp_password: e.target.value })} placeholder={emailStatus.configurado ? '••••••••••••••••' : 'Tu contrasena'} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                      {emailConfig.proveedor !== 'custom' && <p className="text-xs text-yellow-500 mt-1">⚠️ Usa la contrasena de aplicacion, NO tu contrasena normal de email</p>}
                    </div>
                  </div>

                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] space-y-4">
                    <h3 className="font-medium text-[var(--text-primary)]">✉️ Datos del remitente</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre que aparece</label>
                        <input type="text" value={emailConfig.from_name} onChange={(e) => setEmailConfig({ ...emailConfig, from_name: e.target.value })} placeholder="NipponFlex" className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                      </div>
                      <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-1">Email remitente (opcional)</label>
                        <input type="email" value={emailConfig.from_email} onChange={(e) => setEmailConfig({ ...emailConfig, from_email: e.target.value })} placeholder="Igual que usuario SMTP" className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)]">
                    <h3 className="font-medium text-[var(--text-primary)] mb-3">🧪 Probar configuracion</h3>
                    <div className="flex gap-3">
                      <input type="email" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} placeholder="Email donde recibir prueba" className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" />
                      <button onClick={testEmail} disabled={testingEmail || !emailConfig.smtp_host || !emailConfig.smtp_user} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700">
                        {testingEmail ? '⏳ Enviando...' : '📤 Enviar prueba'}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={saveEmailConfig} disabled={savingEmail || !emailConfig.smtp_host || !emailConfig.smtp_user} className="px-6 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-700">
                      {savingEmail ? '⏳ Guardando...' : '💾 Guardar configuracion'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'notificaciones' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">🔔 Notificaciones</h2>
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-[var(--bg-tertiary)]">
                      <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
                      <div>
                        <div className="text-[var(--text-primary)]">Notificar nuevos leads</div>
                        <div className="text-xs text-[var(--text-tertiary)]">Recibir email cuando llegue un nuevo contacto</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-[var(--bg-tertiary)]">
                      <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
                      <div>
                        <div className="text-[var(--text-primary)]">Notificar citas agendadas</div>
                        <div className="text-xs text-[var(--text-tertiary)]">Recibir email cuando se agende una cita</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-[var(--bg-tertiary)]">
                      <input type="checkbox" className="w-5 h-5 rounded" />
                      <div>
                        <div className="text-[var(--text-primary)]">Resumen diario</div>
                        <div className="text-xs text-[var(--text-tertiary)]">Recibir resumen de actividad cada dia</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
