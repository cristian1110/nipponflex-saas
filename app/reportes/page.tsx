'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function ReportesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({})

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
        <div className="p-4 border-b border-[var(--border-color)]">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Reportes</h1>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <p className="text-[var(--text-secondary)] text-sm">Total Leads</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.leads || 0}</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <p className="text-[var(--text-secondary)] text-sm">Mensajes</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.mensajes || 0}</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <p className="text-[var(--text-secondary)] text-sm">Conversiones</p>
              <p className="text-2xl font-bold text-emerald-500">{stats.conversiones || 0}%</p>
            </div>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-color)] text-center">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-[var(--text-secondary)]">Gráficos y análisis detallados próximamente</p>
          </div>
        </div>
      </div>
    </div>
  )
}
