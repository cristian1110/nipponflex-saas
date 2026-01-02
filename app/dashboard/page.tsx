'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import {
  ChartContainer,
  MensajesChart,
  LeadsChart,
  LeadsPorOrigenChart,
  LeadsPorEtapaChart,
  UsoPlanCard,
  CampaniasTable,
  RespuestasPorHoraChart
} from '@/components/charts/MetricasCharts'

interface Metricas {
  usoPlan: {
    mensajes: { usados: number; limite: number; porcentaje: number }
    campanas: { activas: number; limite: number; porcentaje: number }
    contactos: { total: number; limite: number; porcentaje: number }
    planNombre: string
  }
  mensajesPorDia: { fecha: string; enviados: number; recibidos: number }[]
  leadsPorDia: { fecha: string; leads: number }[]
  campanias: {
    id: number
    nombre: string
    estado: string
    totalContactos: number
    enviados: number
    respondidos: number
    tasaRespuesta: number
  }[]
  leadsPorOrigen: { nombre: string; valor: number }[]
  leadsPorEtapa: { nombre: string; color: string; valor: number }[]
  respuestasPorHora: { hora: string; respuestas: number }[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ leads: 0, leadsHoy: 0, mensajes: 0, citas: 0 })
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [periodo, setPeriodo] = useState('semana')
  const [loading, setLoading] = useState(true)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadMetricas() }, [periodo, user])

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
      if (res.ok) {
        const data = await res.json()
        setStats({
          leads: data.metricas?.totalLeads || 0,
          leadsHoy: data.actividadDiaria?.[data.actividadDiaria.length - 1]?.leads || 0,
          mensajes: data.metricas?.mensajesTotales || 0,
          citas: data.metricas?.citasCompletadas || 0
        })
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const loadMetricas = async () => {
    try {
      const res = await fetch(`/api/metricas/dashboard?periodo=${periodo}`)
      if (res.ok) setMetricas(await res.json())
    } catch (e) { console.error(e) }
  }

  if (loading) return (
    <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
              <p className="text-[var(--text-secondary)]">Resumen de tu negocio</p>
            </div>
            <div className="flex gap-2">
              {['dia', 'semana', 'mes'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    periodo === p
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  {p === 'dia' ? 'Hoy' : p === 'semana' ? '7 dias' : '30 dias'}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Cards */}
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
                  <p className="text-[var(--text-secondary)] text-sm">Mensajes</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.mensajes}</p>
                </div>
                <div className="text-2xl">💬</div>
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[var(--text-secondary)] text-sm">Citas Completadas</p>
                  <p className="text-2xl font-bold text-purple-500">{stats.citas}</p>
                </div>
                <div className="text-2xl">📅</div>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <ChartContainer title="Mensajes Enviados vs Recibidos" className="lg:col-span-2">
              {metricas?.mensajesPorDia ? (
                <MensajesChart data={metricas.mensajesPorDia} />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-[var(--text-secondary)]">Cargando...</div>
              )}
            </ChartContainer>
            <ChartContainer title="Uso del Plan">
              {metricas?.usoPlan ? (
                <UsoPlanCard data={metricas.usoPlan} />
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[var(--text-secondary)]">Cargando...</div>
              )}
            </ChartContainer>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <ChartContainer title="Leads Generados">
              {metricas?.leadsPorDia ? (
                <LeadsChart data={metricas.leadsPorDia} />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-[var(--text-secondary)]">Cargando...</div>
              )}
            </ChartContainer>
            <ChartContainer title="Rendimiento de Campanas">
              {metricas?.campanias ? (
                <CampaniasTable data={metricas.campanias} />
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[var(--text-secondary)]">Cargando...</div>
              )}
            </ChartContainer>
          </div>

          {/* Charts Row 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <ChartContainer title="Leads por Origen">
              {metricas?.leadsPorOrigen ? (
                <LeadsPorOrigenChart data={metricas.leadsPorOrigen} />
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[var(--text-secondary)]">Cargando...</div>
              )}
            </ChartContainer>
            <ChartContainer title="Leads por Etapa">
              {metricas?.leadsPorEtapa ? (
                <LeadsPorEtapaChart data={metricas.leadsPorEtapa} />
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[var(--text-secondary)]">Cargando...</div>
              )}
            </ChartContainer>
            <ChartContainer title="Actividad por Hora">
              {metricas?.respuestasPorHora ? (
                <RespuestasPorHoraChart data={metricas.respuestasPorHora} />
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[var(--text-secondary)]">Cargando...</div>
              )}
            </ChartContainer>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <h3 className="font-bold text-[var(--text-primary)] mb-4">Acciones Rapidas</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => router.push('/crm')} className="p-3 bg-[var(--bg-primary)] rounded-lg text-left hover:bg-[var(--bg-tertiary)] transition-colors">
                  <div className="text-xl mb-1">👥</div>
                  <div className="text-sm text-[var(--text-primary)]">Ver CRM</div>
                </button>
                <button onClick={() => router.push('/conversaciones')} className="p-3 bg-[var(--bg-primary)] rounded-lg text-left hover:bg-[var(--bg-tertiary)] transition-colors">
                  <div className="text-xl mb-1">💬</div>
                  <div className="text-sm text-[var(--text-primary)]">Conversaciones</div>
                </button>
                <button onClick={() => router.push('/campanias')} className="p-3 bg-[var(--bg-primary)] rounded-lg text-left hover:bg-[var(--bg-tertiary)] transition-colors">
                  <div className="text-xl mb-1">📣</div>
                  <div className="text-sm text-[var(--text-primary)]">Campanas</div>
                </button>
                <button onClick={() => router.push('/integraciones')} className="p-3 bg-[var(--bg-primary)] rounded-lg text-left hover:bg-[var(--bg-tertiary)] transition-colors">
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
                  <span className="text-[var(--text-secondary)]">Worker Cola</span>
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Ejecutando</span>
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
