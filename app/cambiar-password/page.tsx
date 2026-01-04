'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [passwordNuevo, setPasswordNuevo] = useState('')
  const [passwordConfirmar, setPasswordConfirmar] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setUser(data)

      // Si no necesita cambiar password, ir al dashboard
      if (!data.debe_cambiar_password) {
        router.push('/dashboard')
      }
    } catch {
      router.push('/login')
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (passwordNuevo.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres')
      return
    }

    if (passwordNuevo !== passwordConfirmar) {
      setError('Las contrasenas no coinciden')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/auth/cambiar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password_nuevo: passwordNuevo,
          forzado: true
        })
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Contrasena actualizada correctamente. Redirigiendo...')
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      } else {
        setError(data.error || 'Error al cambiar contrasena')
      }
    } catch {
      setError('Error de conexion')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-8 border border-[var(--border-color)]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">N</span>
              </div>
              <span className="text-xl font-bold text-[var(--text-primary)]">NipponFlex</span>
            </div>
            <ThemeToggle />
          </div>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Cambiar Contrasena</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Por seguridad, debes cambiar tu contrasena temporal antes de continuar.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Nueva contrasena
              </label>
              <input
                type="password"
                value={passwordNuevo}
                onChange={(e) => setPasswordNuevo(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                placeholder="Minimo 6 caracteres"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Confirmar contrasena
              </label>
              <input
                type="password"
                value={passwordConfirmar}
                onChange={(e) => setPasswordConfirmar(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                placeholder="Repite la contrasena"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving || !passwordNuevo || !passwordConfirmar}
              className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              {saving ? 'Guardando...' : 'Cambiar Contrasena'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">
              Hola {user?.nombre}, tu email es {user?.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
