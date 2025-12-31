'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Cita {
  id: number
  titulo: string
  descripcion?: string
  fecha: string
  hora: string
  duracion: number
  lead_id?: number
  lead_nombre?: string
  lead_telefono?: string
  estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada'
  origen: string
  created_at: string
}

export default function CalendarioPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [citas, setCitas] = useState<Cita[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showNewCita, setShowNewCita] = useState(false)
  const [showCitaDetail, setShowCitaDetail] = useState<Cita | null>(null)
  const [newCita, setNewCita] = useState({
    titulo: '',
    descripcion: '',
    fecha: '',
    hora: '09:00',
    duracion: 30,
    lead_telefono: ''
  })

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
      loadCitas()
    } catch { router.push('/login') }
  }

  const loadCitas = async () => {
    try {
      const res = await fetch('/api/citas')
      if (res.ok) {
        const data = await res.json()
        setCitas(Array.isArray(data) ? data : [])
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    return { daysInMonth, startingDay }
  }

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate)

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  const getCitasForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return citas.filter(c => c.fecha === dateStr)
  }

  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear()
  }

  const isSelected = (day: number) => {
    if (!selectedDate) return false
    return day === selectedDate.getDate() && 
           currentDate.getMonth() === selectedDate.getMonth() && 
           currentDate.getFullYear() === selectedDate.getFullYear()
  }

  const handleDayClick = (day: number) => {
    const selected = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(selected)
  }

  const handleNewCita = (day?: number) => {
    const fecha = day 
      ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      : selectedDate || new Date()
    
    setNewCita({
      ...newCita,
      fecha: fecha.toISOString().split('T')[0]
    })
    setShowNewCita(true)
  }

  const crearCita = async () => {
    try {
      await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCita)
      })
      setShowNewCita(false)
      setNewCita({ titulo: '', descripcion: '', fecha: '', hora: '09:00', duracion: 30, lead_telefono: '' })
      loadCitas()
    } catch (e) { console.error(e) }
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'confirmada': return 'bg-emerald-500'
      case 'pendiente': return 'bg-yellow-500'
      case 'completada': return 'bg-blue-500'
      case 'cancelada': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const citasDelDia = selectedDate 
    ? citas.filter(c => c.fecha === selectedDate.toISOString().split('T')[0])
    : []

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Calendario</h1>
            <p className="text-xs text-[var(--text-secondary)]">{citas.length} citas programadas</p>
          </div>
          <button onClick={() => handleNewCita()} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm flex items-center gap-1">
            + Nueva Cita
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Calendario */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
              {/* Navegación del mes */}
              <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
                <button onClick={prevMonth} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-primary)]">
                  ←
                </button>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {meses[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <button onClick={goToToday} className="text-xs text-emerald-500 hover:underline mt-1">
                    Ir a hoy
                  </button>
                </div>
                <button onClick={nextMonth} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-primary)]">
                  →
                </button>
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-7 border-b border-[var(--border-color)]">
                {diasSemana.map(dia => (
                  <div key={dia} className="p-2 text-center text-xs font-medium text-[var(--text-secondary)]">
                    {dia}
                  </div>
                ))}
              </div>

              {/* Días del mes */}
              <div className="grid grid-cols-7">
                {/* Espacios vacíos antes del primer día */}
                {Array.from({ length: startingDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2 min-h-[80px] border-b border-r border-[var(--border-color)] bg-[var(--bg-primary)]/30"></div>
                ))}
                
                {/* Días del mes */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const citasDay = getCitasForDate(day)
                  const today = isToday(day)
                  const selected = isSelected(day)
                  
                  return (
                    <div
                      key={day}
                      onClick={() => handleDayClick(day)}
                      className={`p-2 min-h-[80px] border-b border-r border-[var(--border-color)] cursor-pointer transition-colors
                        ${today ? 'bg-emerald-500/10' : ''}
                        ${selected ? 'bg-emerald-500/20 ring-2 ring-emerald-500 ring-inset' : ''}
                        hover:bg-[var(--bg-tertiary)]
                      `}
                    >
                      <div className={`text-sm font-medium mb-1 ${today ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>
                        {day}
                      </div>
                      <div className="space-y-1">
                        {citasDay.slice(0, 2).map(cita => (
                          <div
                            key={cita.id}
                            onClick={(e) => { e.stopPropagation(); setShowCitaDetail(cita) }}
                            className={`text-[10px] p-1 rounded truncate text-white ${getEstadoColor(cita.estado)}`}
                          >
                            {cita.hora} {cita.titulo}
                          </div>
                        ))}
                        {citasDay.length > 2 && (
                          <div className="text-[10px] text-[var(--text-tertiary)]">
                            +{citasDay.length - 2} más
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Panel lateral - Citas del día */}
          <div className="w-72 border-l border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)]">
              <h3 className="font-bold text-[var(--text-primary)]">
                {selectedDate 
                  ? `${selectedDate.getDate()} de ${meses[selectedDate.getMonth()]}`
                  : 'Selecciona un día'
                }
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {citasDelDia.length} citas
              </p>
            </div>
            
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {selectedDate && citasDelDia.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">📅</div>
                  <p className="text-sm text-[var(--text-secondary)]">Sin citas este día</p>
                  <button 
                    onClick={() => handleNewCita()}
                    className="mt-3 text-xs text-emerald-500 hover:underline"
                  >
                    + Agregar cita
                  </button>
                </div>
              )}
              
              {citasDelDia.map(cita => (
                <div
                  key={cita.id}
                  onClick={() => setShowCitaDetail(cita)}
                  className="p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer hover:ring-1 hover:ring-emerald-500"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${getEstadoColor(cita.estado)}`}></div>
                    <span className="text-xs text-[var(--text-secondary)]">{cita.hora}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">({cita.duracion} min)</span>
                  </div>
                  <p className="font-medium text-sm text-[var(--text-primary)]">{cita.titulo}</p>
                  {cita.lead_nombre && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1">👤 {cita.lead_nombre}</p>
                  )}
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-1 flex items-center gap-1">
                    {cita.origen === 'whatsapp' && '💬'}
                    {cita.origen === 'manual' && '✏️'}
                    {cita.origen === 'n8n' && '⚡'}
                    {cita.origen}
                  </div>
                </div>
              ))}
            </div>

            {selectedDate && (
              <div className="p-3 border-t border-[var(--border-color)]">
                <button
                  onClick={() => handleNewCita()}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                >
                  + Nueva Cita
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nueva Cita */}
      {showNewCita && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Nueva Cita</h3>
              <button onClick={() => setShowNewCita(false)} className="text-[var(--text-secondary)]">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Título *</label>
                <input 
                  type="text" 
                  placeholder="Ej: Llamada de seguimiento"
                  value={newCita.titulo} 
                  onChange={(e) => setNewCita({ ...newCita, titulo: e.target.value })} 
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Fecha *</label>
                  <input 
                    type="date" 
                    value={newCita.fecha} 
                    onChange={(e) => setNewCita({ ...newCita, fecha: e.target.value })} 
                    className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" 
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Hora *</label>
                  <input 
                    type="time" 
                    value={newCita.hora} 
                    onChange={(e) => setNewCita({ ...newCita, hora: e.target.value })} 
                    className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" 
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Duración</label>
                <select 
                  value={newCita.duracion} 
                  onChange={(e) => setNewCita({ ...newCita, duracion: Number(e.target.value) })} 
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                >
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1.5 horas</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Teléfono contacto (opcional)</label>
                <input 
                  type="tel" 
                  placeholder="+593..."
                  value={newCita.lead_telefono} 
                  onChange={(e) => setNewCita({ ...newCita, lead_telefono: e.target.value })} 
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" 
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Descripción</label>
                <textarea 
                  placeholder="Notas adicionales..."
                  value={newCita.descripcion} 
                  onChange={(e) => setNewCita({ ...newCita, descripcion: e.target.value })} 
                  rows={2}
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] resize-none" 
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewCita(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cancelar</button>
              <button onClick={crearCita} disabled={!newCita.titulo || !newCita.fecha} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">Crear Cita</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Cita */}
      {showCitaDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">{showCitaDetail.titulo}</h3>
              <button onClick={() => setShowCitaDetail(null)} className="text-[var(--text-secondary)]">✕</button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getEstadoColor(showCitaDetail.estado)}`}></div>
                <span className="text-sm text-[var(--text-primary)] capitalize">{showCitaDetail.estado}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[var(--text-tertiary)]">Fecha:</span>
                  <p className="text-[var(--text-primary)]">{showCitaDetail.fecha}</p>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)]">Hora:</span>
                  <p className="text-[var(--text-primary)]">{showCitaDetail.hora} ({showCitaDetail.duracion} min)</p>
                </div>
              </div>
              {showCitaDetail.lead_nombre && (
                <div className="text-sm">
                  <span className="text-[var(--text-tertiary)]">Contacto:</span>
                  <p className="text-[var(--text-primary)]">{showCitaDetail.lead_nombre}</p>
                  {showCitaDetail.lead_telefono && <p className="text-[var(--text-secondary)]">{showCitaDetail.lead_telefono}</p>}
                </div>
              )}
              {showCitaDetail.descripcion && (
                <div className="text-sm">
                  <span className="text-[var(--text-tertiary)]">Descripción:</span>
                  <p className="text-[var(--text-primary)]">{showCitaDetail.descripcion}</p>
                </div>
              )}
              <div className="text-xs text-[var(--text-tertiary)]">
                Origen: {showCitaDetail.origen}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="flex-1 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">Cancelar Cita</button>
              <button className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">Completar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
