'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ leads: 0, leadsHoy: 0, mensajes: 0, citas: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
      loadStats()
    } catch { router.push('/login') }
  }

  const loadStats = async () => {
    try {
      const res = await fetch('/api/reportes')
      if (res.ok) setStats(await res.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">¡Hola, {user?.nombre}! 👋</h1>
            <p className="text-[var(--text-secondary)]">Aquí está el resumen de tu negocio hoy</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[var(--text-secondary)] text-sm">Total Leads</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.leads}</p>
                </div>
                <div className="text-2xl">👥</div>
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[var(--text-secondary)] text-sm">Leads Hoy</p>
                  <p className="text-2xl font-bold text-emerald-500">{stats.leadsHoy}</p>
                </div>
                <div className="text-2xl">📈</div>
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[var(--text-secondary)] text-sm">Mensajes Hoy</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.mensajes}</p>
                </div>
                <div className="text-2xl">💬</div>
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[var(--text-secondary)] text-sm">Citas Pendientes</p>
                  <p className="text-2xl font-bold text-purple-500">{stats.citas}</p>
                </div>
                <div className="text-2xl">📅</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <h3 className="font-bold text-[var(--text-primary)] mb-4">Acciones Rápidas</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => router.push('/crm')} className="p-3 bg-[var(--bg-primary)] rounded-lg text-left hover:bg-[var(--bg-tertiary)]">
                  <div className="text-xl mb-1">👥</div>
                  <div className="text-sm text-[var(--text-primary)]">Ver CRM</div>
                </button>
                <button onClick={() => router.push('/conversaciones')} className="p-3 bg-[var(--bg-primary)] rounded-lg text-left hover:bg-[var(--bg-tertiary)]">
                  <div className="text-xl mb-1">💬</div>
                  <div className="text-sm text-[var(--text-primary)]">Conversaciones</div>
                </button>
                <button onClick={() => router.push('/agentes')} className="p-3 bg-[var(--bg-primary)] rounded-lg text-left hover:bg-[var(--bg-tertiary)]">
                  <div className="text-xl mb-1">🤖</div>
                  <div className="text-sm text-[var(--text-primary)]">Agentes IA</div>
                </button>
                <button onClick={() => router.push('/integraciones')} className="p-3 bg-[var(--bg-primary)] rounded-lg text-left hover:bg-[var(--bg-tertiary)]">
                  <div className="text-xl mb-1">🔗</div>
                  <div className="text-sm text-[var(--text-primary)]">Integraciones</div>
                </button>
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <h3 className="font-bold text-[var(--text-primary)] mb-4">Estado del Sistema</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">WhatsApp</span>
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Conectado</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Agente IA</span>
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Activo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Base de datos</span>
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
