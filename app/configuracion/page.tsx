'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function ConfiguracionPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
    } catch { router.push('/login') }
    setLoading(false)
  }

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)]">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Configuración</h1>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-2xl space-y-4">
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <h3 className="font-bold text-[var(--text-primary)] mb-3">Perfil</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-[var(--text-secondary)]">Nombre</label>
                  <input type="text" value={user?.nombre || ''} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" readOnly />
                </div>
                <div>
                  <label className="text-sm text-[var(--text-secondary)]">Email</label>
                  <input type="email" value={user?.email || ''} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]" readOnly />
                </div>
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <h3 className="font-bold text-[var(--text-primary)] mb-3">Notificaciones</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-[var(--text-primary)]">Notificar nuevos leads</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-[var(--text-primary)]">Notificar mensajes</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
