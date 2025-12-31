'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (res.ok) {
        if (data.debe_cambiar_password) {
          router.push('/cambiar-password')
        } else {
          router.push('/dashboard')
        }
      } else {
        setError(data.error || 'Credenciales inválidas')
      }
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-500 to-emerald-600 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-2xl">N</span>
          </div>
          <span className="text-2xl font-bold text-white">NipponFlex AI</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Automatiza tu negocio con IA
          </h1>
          <p className="text-white/80 text-lg">
            Agentes inteligentes que responden 24/7, CRM visual, campañas masivas y más.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-white/90">
            <span className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">✓</span>
            <span>WhatsApp Business API integrado</span>
          </div>
          <div className="flex items-center gap-3 text-white/90">
            <span className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">✓</span>
            <span>Integración nativa con Odoo ERP</span>
          </div>
          <div className="flex items-center gap-3 text-white/90">
            <span className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">✓</span>
            <span>Precios accesibles para LATAM</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex justify-between items-center mb-8">
            <div className="lg:hidden flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">N</span>
              </div>
              <span className="text-xl font-bold text-[var(--text-primary)]">NipponFlex AI</span>
            </div>
            <ThemeToggle />
          </div>

          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Bienvenido de vuelta
          </h2>
          <p className="text-[var(--text-muted)] mb-8">
            Ingresa tus credenciales para continuar
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                placeholder="tu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              ¿No tienes cuenta?{' '}
              <button
                onClick={() => router.push('/registro')}
                className="text-green-500 hover:text-green-400 font-medium"
              >
                Regístrate aquí
              </button>
            </p>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              ← Volver al inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
