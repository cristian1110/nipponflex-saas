'use client'

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899']

interface ChartContainerProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function ChartContainer({ title, children, className = '' }: ChartContainerProps) {
  return (
    <div className={`bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] ${className}`}>
      <h3 className="font-bold text-[var(--text-primary)] mb-4">{title}</h3>
      {children}
    </div>
  )
}

interface MensajesChartProps {
  data: { fecha: string; enviados: number; recibidos: number }[]
}

export function MensajesChart({ data }: MensajesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorEnviados" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorRecibidos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis dataKey="fecha" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)'
          }}
        />
        <Legend />
        <Area type="monotone" dataKey="enviados" stroke="#10b981" fillOpacity={1} fill="url(#colorEnviados)" name="Enviados" />
        <Area type="monotone" dataKey="recibidos" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRecibidos)" name="Recibidos" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface LeadsChartProps {
  data: { fecha: string; leads: number }[]
}

export function LeadsChart({ data }: LeadsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis dataKey="fecha" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)'
          }}
        />
        <Bar dataKey="leads" fill="#10b981" radius={[4, 4, 0, 0]} name="Leads" />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface LeadsPorOrigenProps {
  data: { nombre: string; valor: number }[]
}

export function LeadsPorOrigenChart({ data }: LeadsPorOrigenProps) {
  if (!data || data.length === 0) {
    return <div className="h-[200px] flex items-center justify-center text-[var(--text-secondary)]">Sin datos</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={2}
          dataKey="valor"
          nameKey="nombre"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)'
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

interface LeadsPorEtapaProps {
  data: { nombre: string; color: string; valor: number }[]
}

export function LeadsPorEtapaChart({ data }: LeadsPorEtapaProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <YAxis dataKey="nombre" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={90} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)'
          }}
        />
        <Bar dataKey="valor" radius={[0, 4, 4, 0]} name="Leads">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

interface UsoPlanProps {
  data: {
    mensajes: { usados: number; limite: number; porcentaje: number }
    campanas: { activas: number; limite: number; porcentaje: number }
    contactos: { total: number; limite: number; porcentaje: number }
    planNombre: string
  }
}

export function UsoPlanCard({ data }: UsoPlanProps) {
  const items = [
    { label: 'Mensajes', ...data.mensajes, icon: '💬', color: '#10b981' },
    { label: 'Campanas', usados: data.campanas.activas, limite: data.campanas.limite, porcentaje: data.campanas.porcentaje, icon: '📣', color: '#3b82f6' },
    { label: 'Contactos', usados: data.contactos.total, limite: data.contactos.limite, porcentaje: data.contactos.porcentaje, icon: '👥', color: '#8b5cf6' }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[var(--text-secondary)] text-sm">Plan actual</span>
        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-sm font-medium">{data.planNombre}</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)] flex items-center gap-2">
              <span>{item.icon}</span> {item.label}
            </span>
            <span className="text-[var(--text-primary)]">{item.usados.toLocaleString()} / {item.limite.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${item.porcentaje}%`,
                backgroundColor: item.porcentaje > 80 ? '#ef4444' : item.color
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

interface CampaniasTableProps {
  data: {
    id: number
    nombre: string
    estado: string
    totalContactos: number
    enviados: number
    respondidos: number
    tasaRespuesta: number
  }[]
}

export function CampaniasTable({ data }: CampaniasTableProps) {
  const estadoColors: Record<string, string> = {
    activa: 'bg-emerald-500/20 text-emerald-400',
    pausada: 'bg-yellow-500/20 text-yellow-400',
    completada: 'bg-blue-500/20 text-blue-400',
    borrador: 'bg-gray-500/20 text-gray-400'
  }

  if (!data || data.length === 0) {
    return <div className="text-center text-[var(--text-secondary)] py-4">Sin campanas activas</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border-color)]">
            <th className="pb-2">Nombre</th>
            <th className="pb-2">Estado</th>
            <th className="pb-2 text-right">Enviados</th>
            <th className="pb-2 text-right">Respuestas</th>
            <th className="pb-2 text-right">Tasa</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c) => (
            <tr key={c.id} className="border-b border-[var(--border-color)]">
              <td className="py-2 text-[var(--text-primary)]">{c.nombre}</td>
              <td className="py-2">
                <span className={`px-2 py-1 rounded text-xs ${estadoColors[c.estado] || ''}`}>
                  {c.estado}
                </span>
              </td>
              <td className="py-2 text-right text-[var(--text-secondary)]">{c.enviados}/{c.totalContactos}</td>
              <td className="py-2 text-right text-[var(--text-secondary)]">{c.respondidos}</td>
              <td className="py-2 text-right">
                <span className={c.tasaRespuesta >= 20 ? 'text-emerald-400' : 'text-[var(--text-secondary)]'}>
                  {c.tasaRespuesta}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface RespuestasPorHoraProps {
  data: { hora: string; respuestas: number }[]
}

export function RespuestasPorHoraChart({ data }: RespuestasPorHoraProps) {
  const maxRespuestas = Math.max(...data.map(d => d.respuestas), 1)

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="w-full h-16 bg-[var(--bg-primary)] rounded relative overflow-hidden">
              <div
                className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-300"
                style={{ height: `${(d.respuestas / maxRespuestas) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--text-secondary)]">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
      <p className="text-xs text-[var(--text-secondary)] text-center mt-2">
        Mejores horas para enviar: destacadas en verde
      </p>
    </div>
  )
}
