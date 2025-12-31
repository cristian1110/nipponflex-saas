'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Cliente {
  id: number
  nombre_empresa: string
  email: string
  telefono?: string
  plan?: string
  activo: boolean
  created_at: string
  limite_agentes: number
  limite_mensajes: number
  mensajes_usados: number
}

export default function ClientesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newCliente, setNewCliente] = useState({ nombre_empresa: '', email: '', telefono: '', plan: 'basico' })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      if (data.nivel < 5) { router.push('/dashboard'); return }
      setUser(data)
      loadClientes()
    } catch { router.push('/login') }
  }

  const loadClientes = async () => {
    try {
      const res = await fetch('/api/clientes')
      const data = await res.json()
      setClientes(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const crearCliente = async () => {
    try {
      await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCliente)
      })
      setShowNew(false)
      setNewCliente({ nombre_empresa: '', email: '', telefono: '', plan: 'basico' })
      loadClientes()
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Clientes</h1>
            <p className="text-xs text-[var(--text-secondary)]">{clientes.length} clientes registrados</p>
          </div>
          <button onClick={() => setShowNew(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">+ Nuevo Cliente</button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-4">
            {clientes.map(cliente => (
              <div key={cliente.id} className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)]">{cliente.nombre_empresa}</h3>
                    <p className="text-sm text-[var(--text-secondary)]">{cliente.email}</p>
                    {cliente.telefono && <p className="text-xs text-[var(--text-tertiary)]">{cliente.telefono}</p>}
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${cliente.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {cliente.activo ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-xs">
                  <div><span className="text-[var(--text-tertiary)]">Plan:</span> <span className="text-[var(--text-primary)]">{cliente.plan || 'Básico'}</span></div>
                  <div><span className="text-[var(--text-tertiary)]">Mensajes:</span> <span className="text-[var(--text-primary)]">{cliente.mensajes_usados || 0}/{cliente.limite_mensajes || 1000}</span></div>
                  <div><span className="text-[var(--text-tertiary)]">Agentes:</span> <span className="text-[var(--text-primary)]">{cliente.limite_agentes || 1}</span></div>
                </div>
              </div>
            ))}
            {clientes.length === 0 && (
              <div className="text-center py-12 text-[var(--text-secondary)]">
                <div className="text-4xl mb-3">🏢</div>
                <p>No hay clientes registrados</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">Nuevo Cliente</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre empresa" value={newCliente.nombre_empresa} onChange={(e) => setNewCliente({ ...newCliente, nombre_empresa: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <input type="email" placeholder="Email" value={newCliente.email} onChange={(e) => setNewCliente({ ...newCliente, email: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              <input type="tel" placeholder="Teléfono" value={newCliente.telefono} onChange={(e) => setNewCliente({ ...newCliente, telefono: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNew(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cancelar</button>
              <button onClick={crearCliente} disabled={!newCliente.nombre_empresa || !newCliente.email} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
