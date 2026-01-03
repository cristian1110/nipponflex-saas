'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Resumen {
  total_groq_requests: number
  total_groq_tokens: number
  total_groq_costo: number
  total_jina_requests: number
  total_jina_tokens: number
  total_jina_costo: number
  total_whisper_segundos: number
  total_whisper_costo: number
  total_vision_imagenes: number
  total_vision_costo: number
  total_elevenlabs_caracteres: number
  total_elevenlabs_costo: number
  total_twilio_sms: number
  total_twilio_minutos: number
  total_twilio_costo: number
  total_whatsapp_enviados: number
  total_whatsapp_recibidos: number
  costo_total: number
}

interface TopCliente {
  id: number
  nombre_empresa: string
  total_tokens: number
  total_costo: number
}

interface MetricaDiaria {
  fecha: string
  tokens: number
  costo: number
  mensajes: number
}

export default function MetricasAPIPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dias, setDias] = useState(30)

  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [topClientes, setTopClientes] = useState<TopCliente[]>([])
  const [metricasDiarias, setMetricasDiarias] = useState<MetricaDiaria[]>([])

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [dias, user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      if (data.nivel < 100) { router.push('/dashboard'); return }
      setUser(data)
    } catch { router.push('/login') }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Cargar resumen
      const resResumen = await fetch(`/api/metricas/api-usage?tipo=resumen&dias=${dias}`)
      if (resResumen.ok) {
        const data = await resResumen.json()
        setResumen(data.resumen)
        setTopClientes(data.topClientes || [])
      }

      // Cargar métricas diarias
      const resDiario = await fetch(`/api/metricas/api-usage?tipo=diario&dias=${dias}`)
      if (resDiario.ok) {
        const data = await resDiario.json()
        setMetricasDiarias(data.metricas || [])
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const formatNumber = (n: number | null) => {
    if (!n) return '0'
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toLocaleString()
  }

  const formatCosto = (n: number | null) => {
    if (!n) return '$0.00'
    return '$' + n.toFixed(4)
  }

  if (loading && !user) {
    return (
      <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">📊 Métricas de APIs</h1>
            <p className="text-sm text-[var(--text-secondary)]">Uso y costos de servicios de pago</p>
          </div>
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Costo Total Destacado */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-6 mb-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-emerald-100 text-sm">Costo Total ({dias} días)</p>
                <p className="text-4xl font-bold">${(resumen?.costo_total || 0).toFixed(4)}</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-100 text-sm">Tokens Totales</p>
                <p className="text-2xl font-bold">{formatNumber(resumen?.total_groq_tokens || 0)}</p>
              </div>
            </div>
          </div>

          {/* Grid de Servicios */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Groq LLM */}
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🤖</span>
                <h3 className="font-bold text-[var(--text-primary)]">Groq LLM</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Requests</span>
                  <span className="text-[var(--text-primary)]">{formatNumber(resumen?.total_groq_requests)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Tokens</span>
                  <span className="text-[var(--text-primary)]">{formatNumber(resumen?.total_groq_tokens)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2">
                  <span className="text-[var(--text-secondary)]">Costo</span>
                  <span className="text-emerald-400 font-medium">{formatCosto(resumen?.total_groq_costo)}</span>
                </div>
              </div>
            </div>

            {/* Jina Embeddings */}
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🔍</span>
                <h3 className="font-bold text-[var(--text-primary)]">Jina Embeddings</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Requests</span>
                  <span className="text-[var(--text-primary)]">{formatNumber(resumen?.total_jina_requests)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Tokens</span>
                  <span className="text-[var(--text-primary)]">{formatNumber(resumen?.total_jina_tokens)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2">
                  <span className="text-[var(--text-secondary)]">Costo</span>
                  <span className="text-emerald-400 font-medium">{formatCosto(resumen?.total_jina_costo)}</span>
                </div>
              </div>
            </div>

            {/* Whisper */}
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🎤</span>
                <h3 className="font-bold text-[var(--text-primary)]">Whisper (Audio)</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Segundos</span>
                  <span className="text-[var(--text-primary)]">{formatNumber(resumen?.total_whisper_segundos)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2">
                  <span className="text-[var(--text-secondary)]">Costo</span>
                  <span className="text-emerald-400 font-medium">{formatCosto(resumen?.total_whisper_costo)}</span>
                </div>
              </div>
            </div>

            {/* Vision */}
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">👁️</span>
                <h3 className="font-bold text-[var(--text-primary)]">Vision (Imágenes)</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Imágenes</span>
                  <span className="text-[var(--text-primary)]">{formatNumber(resumen?.total_vision_imagenes)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2">
                  <span className="text-[var(--text-secondary)]">Costo</span>
                  <span className="text-emerald-400 font-medium">{formatCosto(resumen?.total_vision_costo)}</span>
                </div>
              </div>
            </div>

            {/* ElevenLabs */}
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🗣️</span>
                <h3 className="font-bold text-[var(--text-primary)]">ElevenLabs (Voz)</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Caracteres</span>
                  <span className="text-[var(--text-primary)]">{formatNumber(resumen?.total_elevenlabs_caracteres)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2">
                  <span className="text-[var(--text-secondary)]">Costo</span>
                  <span className="text-emerald-400 font-medium">{formatCosto(resumen?.total_elevenlabs_costo)}</span>
                </div>
              </div>
            </div>

            {/* Twilio */}
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📞</span>
                <h3 className="font-bold text-[var(--text-primary)]">Twilio (SMS/Llamadas)</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">SMS</span>
                  <span className="text-[var(--text-primary)]">{formatNumber(resumen?.total_twilio_sms)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Minutos</span>
                  <span className="text-[var(--text-primary)]">{formatNumber(resumen?.total_twilio_minutos)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2">
                  <span className="text-[var(--text-secondary)]">Costo</span>
                  <span className="text-emerald-400 font-medium">{formatCosto(resumen?.total_twilio_costo)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp Stats */}
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">💬</span>
              <h3 className="font-bold text-[var(--text-primary)]">WhatsApp</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-[var(--bg-primary)] rounded-lg">
                <p className="text-2xl font-bold text-emerald-400">{formatNumber(resumen?.total_whatsapp_enviados)}</p>
                <p className="text-xs text-[var(--text-secondary)]">Mensajes Enviados</p>
              </div>
              <div className="text-center p-3 bg-[var(--bg-primary)] rounded-lg">
                <p className="text-2xl font-bold text-blue-400">{formatNumber(resumen?.total_whatsapp_recibidos)}</p>
                <p className="text-xs text-[var(--text-secondary)]">Mensajes Recibidos</p>
              </div>
            </div>
          </div>

          {/* Top Clientes */}
          {topClientes.length > 0 && (
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <h3 className="font-bold text-[var(--text-primary)] mb-4">🏆 Top Clientes por Uso</h3>
              <div className="space-y-2">
                {topClientes.map((cliente, i) => (
                  <div key={cliente.id} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-500 text-black' :
                        i === 1 ? 'bg-gray-400 text-black' :
                        i === 2 ? 'bg-amber-600 text-white' :
                        'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="text-[var(--text-primary)]">{cliente.nombre_empresa}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--text-primary)]">{formatNumber(cliente.total_tokens)} tokens</p>
                      <p className="text-xs text-emerald-400">{formatCosto(cliente.total_costo)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
