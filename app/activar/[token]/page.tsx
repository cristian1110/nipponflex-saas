'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function ActivarCuentaPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invitacion, setInvitacion] = useState<any>(null)
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [activando, setActivando] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    verificarToken()
  }, [token])

  const verificarToken = async () => {
    try {
      const res = await fetch(`/api/auth/activar?token=${token}`)
      const data = await res.json()
      
      if (data.valido) {
        setInvitacion(data)
      } else {
        setError(data.error || 'Token invalido')
      }
    } catch (e) {
      setError('Error al verificar token')
    }
    setLoading(false)
  }

  const activarCuenta = async () => {
    if (password !== confirmar) {
      setError('Las contrasenas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres')
      return
    }

    setActivando(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/activar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(true)
        setTimeout(() => router.push('/login'), 3000)
      } else {
        setError(data.error || 'Error al activar cuenta')
      }
    } catch (e) {
      setError('Error de conexion')
    }
    setActivando(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">Cuenta Activada</h1>
          <p className="text-gray-400 mb-4">Tu cuenta ha sido creada exitosamente</p>
          <p className="text-emerald-400">Redirigiendo al login...</p>
        </div>
      </div>
    )
  }

  if (error && !invitacion) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">Enlace Invalido</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => router.push('/login')} className="px-6 py-2 bg-emerald-600 text-white rounded-lg">
            Ir al Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤖</div>
          <h1 className="text-2xl font-bold text-white">NipponFlex</h1>
          <p className="text-gray-400">Activa tu cuenta</p>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
          <p className="text-gray-300"><strong>Nombre:</strong> {invitacion?.nombre}</p>
          <p className="text-gray-300"><strong>Email:</strong> {invitacion?.email}</p>
          {invitacion?.plan && <p className="text-emerald-400"><strong>Plan:</strong> {invitacion.plan}</p>}
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Crear contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 6 caracteres"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirmar contrasena</label>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Repite tu contrasena"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <button
            onClick={activarCuenta}
            disabled={activando || !password || !confirmar}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-emerald-700 transition-colors"
          >
            {activando ? 'Activando...' : 'Activar mi cuenta'}
          </button>
        </div>
      </div>
    </div>
  )
}
