'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

export default function RegistroPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({ empresa: '', nombre: '', email: '', telefono: '', password: '', confirmar: '', plan: 'pro' })

  const planes = [
    { id: 'starter', nombre: 'Starter', precio: 99, agentes: 1, usuarios: 2, mensajes: '500', features: ['1 Agente IA', '2 Usuarios', '500 mensajes/mes', 'WhatsApp'] },
    { id: 'pro', nombre: 'Pro', precio: 199, agentes: 3, usuarios: 5, mensajes: '2,000', features: ['3 Agentes IA', '5 Usuarios', '2,000 mensajes/mes', 'WhatsApp + Telegram', 'Campañas'], popular: true },
    { id: 'business', nombre: 'Business', precio: 349, agentes: 10, usuarios: 15, mensajes: '10,000', features: ['10 Agentes IA', '15 Usuarios', '10,000 mensajes/mes', 'Todos los canales', 'Odoo', 'API Access'] },
  ]

  const handleSubmit = async () => {
    if (formData.password !== formData.confirmar) { setError('Las contraseñas no coinciden'); return }
    if (formData.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) router.push('/login?registrado=1')
      else { const data = await res.json(); setError(data.error || 'Error al registrar') }
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center"><span className="text-white font-bold text-lg">N</span></div>
            <span className="text-xl font-bold text-[var(--text-primary)]">NipponFlex AI</span>
          </div>
          <ThemeToggle />
        </div>
        {/* Progress */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (<div key={s} className="flex items-center"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s ? 'bg-green-500 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>{s}</div>{s < 3 && <div className={`w-12 h-1 mx-2 ${step > s ? 'bg-green-500' : 'bg-[var(--bg-tertiary)]'}`} />}</div>))}
        </div>
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-8">
          {error && <div className="mb-6 p-4 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Elige tu plan</h2>
              <p className="text-[var(--text-muted)] mb-6">Todos los planes incluyen 14 días de prueba gratis</p>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {planes.map((plan) => (
                  <button key={plan.id} onClick={() => setFormData({ ...formData, plan: plan.id })} className={`p-6 rounded-xl border-2 text-left transition-colors ${formData.plan === plan.id ? 'border-green-500 bg-green-500/5' : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'}`}>
                    {plan.popular && <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full mb-2 inline-block">Popular</span>}
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">{plan.nombre}</h3>
                    <p className="text-3xl font-bold text-[var(--text-primary)] my-2">${plan.precio}<span className="text-sm text-[var(--text-muted)] font-normal">/mes</span></p>
                    <ul className="space-y-2 mt-4">{plan.features.map((f, i) => (<li key={i} className="text-sm text-[var(--text-secondary)] flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>))}</ul>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold">Continuar →</button>
            </div>
          )}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Datos de tu empresa</h2>
              <p className="text-[var(--text-muted)] mb-6">Cuéntanos sobre tu negocio</p>
              <div className="space-y-4 mb-6">
                <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Nombre de la Empresa *</label><input type="text" value={formData.empresa} onChange={(e) => setFormData({ ...formData, empresa: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50" required /></div>
                <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tu Nombre Completo *</label><input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50" required /></div>
                <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Teléfono</label><input type="tel" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="+593 99 999 9999" className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50" /></div>
              </div>
              <div className="flex gap-4"><button onClick={() => setStep(1)} className="flex-1 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg font-medium">← Atrás</button><button onClick={() => setStep(3)} disabled={!formData.empresa || !formData.nombre} className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-semibold">Continuar →</button></div>
            </div>
          )}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Crea tu cuenta</h2>
              <p className="text-[var(--text-muted)] mb-6">Define tus credenciales de acceso</p>
              <div className="space-y-4 mb-6">
                <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Email *</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50" required /></div>
                <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Contraseña *</label><input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50" required /><p className="text-xs text-[var(--text-muted)] mt-1">Mínimo 8 caracteres</p></div>
                <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Confirmar Contraseña *</label><input type="password" value={formData.confirmar} onChange={(e) => setFormData({ ...formData, confirmar: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50" required /></div>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg mb-6"><p className="text-sm text-[var(--text-secondary)]">Al registrarte aceptas los <a href="#" className="text-green-500">Términos de Servicio</a> y la <a href="#" className="text-green-500">Política de Privacidad</a>.</p></div>
              <div className="flex gap-4"><button onClick={() => setStep(2)} className="flex-1 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg font-medium">← Atrás</button><button onClick={handleSubmit} disabled={loading || !formData.email || !formData.password} className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center justify-center gap-2">{loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />}{loading ? 'Creando cuenta...' : 'Crear Cuenta'}</button></div>
            </div>
          )}
        </div>
        <p className="text-center text-sm text-[var(--text-muted)] mt-6">¿Ya tienes cuenta? <button onClick={() => router.push('/login')} className="text-green-500 hover:text-green-400 font-medium">Inicia sesión</button></p>
      </div>
    </div>
  )
}
