
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import StatsCard from '@/components/StatsCard'
import { LoadingPage } from '@/components/Loading'
import { formatCurrency } from '@/lib/utils'

interface Metricas {
  totalLeads: number
  leadsGanados: number
  leadsPerdidos: number
  valorTotal: number
  conversionRate: number
  tiempoPromedioRespuesta: number
  mensajesTotales: number
  citasCompletadas: number
}

export default function ReportesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes')
  const [metricas, setMetricas] = useState<Metricas>({ totalLeads: 0, leadsGanados: 0, leadsPerdidos: 0, valorTotal: 0, conversionRate: 0, tiempoPromedioRespuesta: 0, mensajesTotales: 0, citasCompletadas: 0 })
  const [leadsPorEtapa, setLeadsPorEtapa] = useState<{ etapa: string; total: number; color: string }[]>([])
  const [leadsPorOrigen, setLeadsPorOrigen] = useState<{ origen: string; total: number }[]>([])
  const [actividadDiaria, setActividadDiaria] = useState<{ fecha: string; leads: number; mensajes: number }[]>([])

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) { setUser(await res.json()); loadReportes() }
      else router.push('/login')
    } catch { router.push('/login') }
  }

  const loadReportes = async () => {
    try {
      const res = await fetch(`/api/reportes?periodo=${periodo}`)
      if (res.ok) {
        const data = await res.json()
        setMetricas(data.metricas || metricas)
        setLeadsPorEtapa(data.leadsPorEtapa || [])
        setLeadsPorOrigen(data.leadsPorOrigen || [])
        setActividadDiaria(data.actividadDiaria || [])
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (user) loadReportes() }, [periodo])

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <main className="ml-64">
        <Header title="Reportes y Estadísticas" subtitle="Analiza el rendimiento de tu negocio" actions={
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
            {['semana', 'mes', 'trimestre', 'año'].map((p) => (
              <button key={p} onClick={() => setPeriodo(p)} className={`px-3 py-1.5 rounded text-sm capitalize transition-colors ${periodo === p ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{p}</button>
            ))}
          </div>
        } />
        <div className="p-6">
          {/* KPIs principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatsCard title="Total Leads" value={metricas.totalLeads} icon="👥" color="blue" />
            <StatsCard title="Leads Ganados" value={metricas.leadsGanados} icon="🏆" color="green" />
            <StatsCard title="Valor Total" value={formatCurrency(metricas.valorTotal)} icon="💰" color="purple" />
            <StatsCard title="Tasa Conversión" value={`${metricas.conversionRate.toFixed(1)}%`} icon="📈" color="orange" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Pipeline Chart */}
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Leads por Etapa</h3>
              {leadsPorEtapa.length > 0 ? (
                <div className="space-y-4">
                  {leadsPorEtapa.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-[var(--text-secondary)] flex-1">{item.etapa}</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{item.total}</span>
                      <div className="w-24 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ backgroundColor: item.color, width: `${(item.total / metricas.totalLeads) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-[var(--text-muted)] text-center py-8">Sin datos</p>}
            </div>

            {/* Origen Chart */}
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Leads por Origen</h3>
              {leadsPorOrigen.length > 0 ? (
                <div className="space-y-3">
                  {leadsPorOrigen.map((item, i) => {
                    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-sm text-[var(--text-secondary)] w-24">{item.origen}</span>
                        <div className="flex-1 h-8 bg-[var(--bg-tertiary)] rounded-lg overflow-hidden">
                          <div className="h-full flex items-center px-3 text-white text-sm font-medium" style={{ backgroundColor: colors[i % colors.length], width: `${(item.total / metricas.totalLeads) * 100}%`, minWidth: '40px' }}>{item.total}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-[var(--text-muted)] text-center py-8">Sin datos</p>}
            </div>
          </div>

          {/* Actividad Diaria */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Actividad Diaria</h3>
            {actividadDiaria.length > 0 ? (
              <div className="flex items-end gap-2 h-48">
                {actividadDiaria.map((dia, i) => {
                  const maxLeads = Math.max(...actividadDiaria.map(d => d.leads))
                  const maxMensajes = Math.max(...actividadDiaria.map(d => d.mensajes))
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex gap-1 items-end" style={{ height: '140px' }}>
                        <div className="flex-1 bg-blue-500/50 rounded-t" style={{ height: `${maxLeads > 0 ? (dia.leads / maxLeads) * 100 : 0}%` }} title={`${dia.leads} leads`} />
                        <div className="flex-1 bg-green-500/50 rounded-t" style={{ height: `${maxMensajes > 0 ? (dia.mensajes / maxMensajes) * 100 : 0}%` }} title={`${dia.mensajes} mensajes`} />
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">{new Date(dia.fecha).toLocaleDateString('es-EC', { weekday: 'short' })}</span>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-[var(--text-muted)] text-center py-8">Sin datos de actividad</p>}
            <div className="flex gap-4 mt-4 justify-center">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500/50 rounded" /><span className="text-sm text-[var(--text-muted)]">Leads</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500/50 rounded" /><span className="text-sm text-[var(--text-muted)]">Mensajes</span></div>
            </div>
          </div>

          {/* Métricas adicionales */}
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
              <h4 className="text-sm text-[var(--text-muted)] mb-2">Tiempo Promedio Respuesta</h4>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{metricas.tiempoPromedioRespuesta || 0} <span className="text-lg text-[var(--text-muted)]">min</span></p>
            </div>
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
              <h4 className="text-sm text-[var(--text-muted)] mb-2">Mensajes Totales</h4>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{metricas.mensajesTotales.toLocaleString()}</p>
            </div>
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
              <h4 className="text-sm text-[var(--text-muted)] mb-2">Citas Completadas</h4>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{metricas.citasCompletadas}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
