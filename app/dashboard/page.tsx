
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import StatsCard from '@/components/StatsCard'
import { LoadingPage } from '@/components/Loading'

interface Stats {
  totalLeads: number
  leadsHoy: number
  leadsNuevos: number
  mensajesHoy: number
  citasPendientes: number
  conversionRate: number
  leadsPorEtapa: { etapa: string; color: string; total: number }[]
}

const quickActions = [
  { href: '/crm?nuevo=1', icon: '➕', label: 'Nuevo Lead', color: 'green' },
  { href: '/conversaciones', icon: '💬', label: 'Ver Chats', color: 'blue' },
  { href: '/calendario?nueva=1', icon: '📅', label: 'Nueva Cita', color: 'purple' },
  { href: '/campanas/nueva', icon: '📣', label: 'Nueva Campaña', color: 'orange' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    leadsHoy: 0,
    leadsNuevos: 0,
    mensajesHoy: 0,
    citasPendientes: 0,
    conversionRate: 0,
    leadsPorEtapa: [],
  })
  const [recentLeads, setRecentLeads] = useState<any[]>([])
  const [recentChats, setRecentChats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        const userData = await res.json()
        setUser(userData)
        loadDashboardData()
      } else {
        router.push('/login')
      }
    } catch (e) {
      router.push('/login')
    }
  }

  const loadDashboardData = async () => {
    try {
      const [leadsRes, citasRes, conversacionesRes] = await Promise.all([
        fetch('/api/crm/leads'),
        fetch('/api/citas'),
        fetch('/api/conversaciones'),
      ])

      if (leadsRes.ok) {
        const leads = await leadsRes.json()
        const hoy = new Date().toDateString()
        const leadsHoy = leads.filter((l: any) => new Date(l.created_at).toDateString() === hoy)
        
        // Agrupar por etapa
        const porEtapa = leads.reduce((acc: any, lead: any) => {
          const key = lead.etapa_nombre || 'Sin etapa'
          if (!acc[key]) {
            acc[key] = { etapa: key, color: lead.etapa_color || '#6366f1', total: 0 }
          }
          acc[key].total++
          return acc
        }, {})

        setStats(prev => ({
          ...prev,
          totalLeads: leads.length,
          leadsHoy: leadsHoy.length,
          leadsNuevos: leads.filter((l: any) => l.etapa_nombre === 'Nuevo').length,
          leadsPorEtapa: Object.values(porEtapa),
        }))

        setRecentLeads(leads.slice(0, 5))
      }

      if (citasRes.ok) {
        const citas = await citasRes.json()
        setStats(prev => ({
          ...prev,
          citasPendientes: citas.filter((c: any) => c.estado === 'pendiente').length,
        }))
      }

      if (conversacionesRes.ok) {
        const conversaciones = await conversacionesRes.json()
        setRecentChats(conversaciones.slice(0, 5))
        
        const hoy = new Date().toDateString()
        const mensajesHoy = conversaciones.filter((c: any) => 
          new Date(c.fecha_ultimo).toDateString() === hoy
        ).reduce((acc: number, c: any) => acc + (c.sin_leer || 0), 0)
        
        setStats(prev => ({ ...prev, mensajesHoy }))
      }
    } catch (e) {
      console.error('Error loading dashboard:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <main className="ml-64 p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            ¡Hola, {user.nombre.split(' ')[0]}! 👋
          </h1>
          <p className="text-[var(--text-muted)]">
            Aquí está el resumen de tu negocio hoy
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="Total Leads"
            value={stats.totalLeads}
            icon="👥"
            color="blue"
            onClick={() => router.push('/crm')}
          />
          <StatsCard
            title="Leads Hoy"
            value={stats.leadsHoy}
            icon="📈"
            color="green"
            trend={{ value: 12, label: 'vs ayer' }}
          />
          <StatsCard
            title="Mensajes Hoy"
            value={stats.mensajesHoy}
            icon="💬"
            color="purple"
            onClick={() => router.push('/conversaciones')}
          />
          <StatsCard
            title="Citas Pendientes"
            value={stats.citasPendientes}
            icon="📅"
            color="orange"
            onClick={() => router.push('/calendario')}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Pipeline Overview */}
          <div className="lg:col-span-2 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pipeline de Ventas</h2>
              <button
                onClick={() => router.push('/crm')}
                className="text-sm text-green-500 hover:text-green-400"
              >
                Ver todo →
              </button>
            </div>
            
            {stats.leadsPorEtapa.length > 0 ? (
              <div className="space-y-4">
                {stats.leadsPorEtapa.map((etapa, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: etapa.color }}
                    />
                    <span className="text-sm text-[var(--text-secondary)] flex-1">{etapa.etapa}</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{etapa.total}</span>
                    <div className="w-24 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: etapa.color,
                          width: `${(etapa.total / stats.totalLeads) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-[var(--text-muted)]">No hay leads aún</p>
                <button
                  onClick={() => router.push('/crm?nuevo=1')}
                  className="mt-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                >
                  Crear primer lead
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Acciones Rápidas</h2>
            <div className="space-y-3">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => router.push(action.href)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors text-left"
                >
                  <span className="text-xl">{action.icon}</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          {/* Recent Leads */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Leads Recientes</h2>
              <button
                onClick={() => router.push('/crm')}
                className="text-sm text-green-500 hover:text-green-400"
              >
                Ver todos →
              </button>
            </div>
            <div className="space-y-3">
              {recentLeads.length > 0 ? (
                recentLeads.map((lead, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                    onClick={() => router.push(`/crm/${lead.id}`)}
                  >
                    <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-sm font-medium text-[var(--text-primary)]">
                      {lead.nombre?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{lead.nombre}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{lead.telefono}</p>
                    </div>
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${lead.etapa_color}20`,
                        color: lead.etapa_color,
                      }}
                    >
                      {lead.etapa_nombre}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-[var(--text-muted)] py-4">No hay leads recientes</p>
              )}
            </div>
          </div>

          {/* Recent Chats */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Chats Recientes</h2>
              <button
                onClick={() => router.push('/conversaciones')}
                className="text-sm text-green-500 hover:text-green-400"
              >
                Ver todos →
              </button>
            </div>
            <div className="space-y-3">
              {recentChats.length > 0 ? (
                recentChats.map((chat, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                    onClick={() => router.push(`/conversaciones?numero=${chat.numero_whatsapp}`)}
                  >
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <span className="text-green-500">💬</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{chat.nombre || chat.numero_whatsapp}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{chat.ultimo_mensaje}</p>
                    </div>
                    {chat.sin_leer > 0 && (
                      <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-xs text-white">
                        {chat.sin_leer}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-[var(--text-muted)] py-4">No hay conversaciones recientes</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
