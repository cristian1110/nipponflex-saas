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
  const [showEditCita, setShowEditCita] = useState(false)
  const [showCitaDetail, setShowCitaDetail] = useState<Cita | null>(null)
  const [editingCita, setEditingCita] = useState<Cita | null>(null)
  const [saving, setSaving] = useState(false)
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false)
  const [showGoogleConnect, setShowGoogleConnect] = useState(false)
  
  const [newCita, setNewCita] = useState({
    titulo: '',
    descripcion: '',
    fecha: '',
    hora: '09:00',
    duracion: 30,
    lead_telefono: '',
    recordatorio_minutos: 120,
    recordatorio_canal: 'whatsapp'
  })

  const opcionesRecordatorio = [
    { valor: 0, texto: 'Sin recordatorio' },
    { valor: 15, texto: '15 minutos antes' },
    { valor: 30, texto: '30 minutos antes' },
    { valor: 60, texto: '1 hora antes' },
    { valor: 120, texto: '2 horas antes' },
    { valor: 1440, texto: '1 día antes' },
    { valor: 2880, texto: '2 días antes' },
  ]

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
      loadCitas()
      checkGoogleCalendar()
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

  const checkGoogleCalendar = async () => {
    try {
      const res = await fetch('/api/integraciones/google-calendar/status')
      if (res.ok) {
        const data = await res.json()
        setGoogleCalendarConnected(data.connected || false)
      }
    } catch (e) { 
      setGoogleCalendarConnected(false)
    }
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
      titulo: '',
      descripcion: '',
      fecha: fecha.toISOString().split('T')[0],
      hora: '09:00',
      duracion: 30,
      lead_telefono: ''
    })
    setShowNewCita(true)
  }

  const crearCita = async () => {
    if (!newCita.titulo || !newCita.fecha) return
    setSaving(true)
    try {
      const res = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCita)
      })
      if (res.ok) {
        setShowNewCita(false)
        setNewCita({ titulo: '', descripcion: '', fecha: '', hora: '09:00', duracion: 30, lead_telefono: '' })
        loadCitas()
      } else {
        const data = await res.json()
        alert('Error: ' + (data.error || 'No se pudo crear'))
      }
    } catch (e) { 
      console.error(e)
      alert('Error al crear cita')
    }
    setSaving(false)
  }

  const openEditCita = (cita: Cita) => {
    setEditingCita({ ...cita })
    setShowCitaDetail(null)
    setShowEditCita(true)
  }

  const updateCita = async () => {
    if (!editingCita) return
    setSaving(true)
    try {
      const res = await fetch('/api/citas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCita.id,
          titulo: editingCita.titulo,
          descripcion: editingCita.descripcion,
          fecha: editingCita.fecha,
          hora: editingCita.hora,
          duracion: editingCita.duracion,
          estado: editingCita.estado
        })
      })
      if (res.ok) {
        setShowEditCita(false)
        setEditingCita(null)
        loadCitas()
      } else {
        alert('Error al actualizar')
      }
    } catch (e) {
      alert('Error al actualizar')
    }
    setSaving(false)
  }

  const deleteCita = async (id: number) => {
    if (!confirm('¿Eliminar esta cita?')) return
    try {
      const res = await fetch(`/api/citas?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setShowCitaDetail(null)
        setShowEditCita(false)
        loadCitas()
      } else {
        alert('Error al eliminar')
      }
    } catch (e) {
      alert('Error al eliminar')
    }
  }

  const cambiarEstado = async (cita: Cita, nuevoEstado: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/citas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cita.id, estado: nuevoEstado })
      })
      if (res.ok) {
        setShowCitaDetail(null)
        loadCitas()
      } else {
        alert('Error al cambiar estado')
      }
    } catch (e) {
      alert('Error al cambiar estado')
    }
    setSaving(false)
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

  const hoy = new Date()
  const en7Dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000)
  const proximasCitas = citas
    .filter(c => {
      const fechaCita = new Date(c.fecha)
      return fechaCita >= hoy && fechaCita <= en7Dias && c.estado !== 'cancelada' && c.estado !== 'completada'
    })
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    .slice(0, 5)

  if (loading) return <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-secondary)]">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">📅 Calendario</h1>
            <p className="text-xs text-[var(--text-secondary)]">{citas.length} citas programadas</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowGoogleConnect(true)}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                googleCalendarConnected 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
              }`}
            >
              <span>📅</span>
              {googleCalendarConnected ? 'Sincronizado' : 'Google Calendar'}
            </button>
            <button onClick={() => handleNewCita()} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm flex items-center gap-1">
              + Nueva Cita
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-4 overflow-auto">
            <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
              <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
                <button onClick={prevMonth} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-primary)]">←</button>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">{meses[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                  <button onClick={goToToday} className="text-xs text-emerald-500 hover:underline mt-1">Ir a hoy</button>
                </div>
                <button onClick={nextMonth} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-primary)]">→</button>
              </div>

              <div className="grid grid-cols-7 border-b border-[var(--border-color)]">
                {diasSemana.map(dia => (
                  <div key={dia} className="p-2 text-center text-xs font-medium text-[var(--text-secondary)]">{dia}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {Array.from({ length: startingDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2 min-h-[80px] border-b border-r border-[var(--border-color)] bg-[var(--bg-primary)]/30"></div>
                ))}

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
                      <div className={`text-sm font-medium mb-1 ${today ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>{day}</div>
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
                          <div className="text-[10px] text-[var(--text-tertiary)]">+{citasDay.length - 2} más</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="w-80 border-l border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)]">
              <h3 className="font-bold text-[var(--text-primary)] text-sm mb-3">⏰ Próximas citas</h3>
              {proximasCitas.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">No hay citas próximas</p>
              ) : (
                <div className="space-y-2">
                  {proximasCitas.map(cita => (
                    <div key={cita.id} onClick={() => setShowCitaDetail(cita)} className="p-2 bg-[var(--bg-primary)] rounded-lg cursor-pointer hover:ring-1 hover:ring-emerald-500">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getEstadoColor(cita.estado)}`}></div>
                        <span className="text-xs text-[var(--text-tertiary)]">{cita.fecha} {cita.hora}</span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] truncate">{cita.titulo}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              <div className="p-4 border-b border-[var(--border-color)]">
                <h3 className="font-bold text-[var(--text-primary)]">
                  {selectedDate ? `${selectedDate.getDate()} de ${meses[selectedDate.getMonth()]}` : 'Selecciona un día'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">{citasDelDia.length} citas</p>
              </div>

              <div className="p-3 space-y-2">
                {selectedDate && citasDelDia.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-2">📅</div>
                    <p className="text-sm text-[var(--text-secondary)]">Sin citas este día</p>
                    <button onClick={() => handleNewCita()} className="mt-3 text-xs text-emerald-500 hover:underline">+ Agregar cita</button>
                  </div>
                )}

                {citasDelDia.map(cita => (
                  <div key={cita.id} onClick={() => setShowCitaDetail(cita)} className="p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer hover:ring-1 hover:ring-emerald-500">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${getEstadoColor(cita.estado)}`}></div>
                      <span className="text-xs text-[var(--text-secondary)]">{cita.hora}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">({cita.duracion} min)</span>
                    </div>
                    <p className="font-medium text-sm text-[var(--text-primary)]">{cita.titulo}</p>
                    {cita.lead_nombre && <p className="text-xs text-[var(--text-secondary)] mt-1">👤 {cita.lead_nombre}</p>}
                  </div>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div className="p-3 border-t border-[var(--border-color)]">
                <button onClick={() => handleNewCita()} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">+ Nueva Cita</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNewCita && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Nueva Cita</h3>
              <button onClick={() => setShowNewCita(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Título *</label>
                <input type="text" placeholder="Ej: Llamada de seguimiento" value={newCita.titulo} onChange={(e) => setNewCita({ ...newCita, titulo: e.target.value })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Fecha *</label>
                  <input type="date" value={newCita.fecha} onChange={(e) => setNewCita({ ...newCita, fecha: e.target.value })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Hora *</label>
                  <input type="time" value={newCita.hora} onChange={(e) => setNewCita({ ...newCita, hora: e.target.value })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Duración</label>
                <select value={newCita.duracion} onChange={(e) => setNewCita({ ...newCita, duracion: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1.5 horas</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Teléfono contacto (para recordatorio)</label>
                <input type="tel" placeholder="+593..." value={newCita.lead_telefono} onChange={(e) => setNewCita({ ...newCita, lead_telefono: e.target.value })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Recordatorio</label>
                  <select value={newCita.recordatorio_minutos} onChange={(e) => setNewCita({ ...newCita, recordatorio_minutos: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
                    {opcionesRecordatorio.map(op => (
                      <option key={op.valor} value={op.valor}>{op.texto}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Canal</label>
                  <select value={newCita.recordatorio_canal} onChange={(e) => setNewCita({ ...newCita, recordatorio_canal: e.target.value })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Descripción</label>
                <textarea placeholder="Notas adicionales..." value={newCita.descripcion} onChange={(e) => setNewCita({ ...newCita, descripcion: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewCita(false)} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cancelar</button>
              <button onClick={crearCita} disabled={!newCita.titulo || !newCita.fecha || saving} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'Creando...' : 'Crear Cita'}</button>
            </div>
          </div>
        </div>
      )}

      {showCitaDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">{showCitaDetail.titulo}</h3>
              <button onClick={() => setShowCitaDetail(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
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
            </div>

            {showCitaDetail.estado !== 'completada' && showCitaDetail.estado !== 'cancelada' && (
              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-secondary)] mb-2">Cambiar estado:</p>
                <div className="flex gap-2">
                  {showCitaDetail.estado === 'pendiente' && (
                    <button onClick={() => cambiarEstado(showCitaDetail, 'confirmada')} disabled={saving} className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">✓ Confirmar</button>
                  )}
                  <button onClick={() => cambiarEstado(showCitaDetail, 'completada')} disabled={saving} className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">✅ Completar</button>
                  <button onClick={() => cambiarEstado(showCitaDetail, 'cancelada')} disabled={saving} className="flex-1 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm disabled:opacity-50">❌ Cancelar</button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border-color)]">
              <button onClick={() => openEditCita(showCitaDetail)} className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-sm">✏️ Editar</button>
              <button onClick={() => deleteCita(showCitaDetail.id)} className="flex-1 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {showEditCita && editingCita && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Editar Cita</h3>
              <button onClick={() => { setShowEditCita(false); setEditingCita(null) }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Título *</label>
                <input type="text" value={editingCita.titulo} onChange={(e) => setEditingCita({ ...editingCita, titulo: e.target.value })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Fecha *</label>
                  <input type="date" value={editingCita.fecha} onChange={(e) => setEditingCita({ ...editingCita, fecha: e.target.value })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Hora *</label>
                  <input type="time" value={editingCita.hora} onChange={(e) => setEditingCita({ ...editingCita, hora: e.target.value })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Duración</label>
                <select value={editingCita.duracion} onChange={(e) => setEditingCita({ ...editingCita, duracion: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1.5 horas</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Estado</label>
                <select value={editingCita.estado} onChange={(e) => setEditingCita({ ...editingCita, estado: e.target.value as any })} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
                  <option value="pendiente">⏳ Pendiente</option>
                  <option value="confirmada">✓ Confirmada</option>
                  <option value="completada">✅ Completada</option>
                  <option value="cancelada">❌ Cancelada</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Descripción</label>
                <textarea value={editingCita.descripcion || ''} onChange={(e) => setEditingCita({ ...editingCita, descripcion: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => deleteCita(editingCita.id)} className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">🗑️</button>
              <button onClick={() => { setShowEditCita(false); setEditingCita(null) }} className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">Cancelar</button>
              <button onClick={updateCita} disabled={!editingCita.titulo || !editingCita.fecha || saving} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {showGoogleConnect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-5 w-full max-w-md">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">📅 Google Calendar</h3>
              <button onClick={() => setShowGoogleConnect(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            
            {googleCalendarConnected ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-[var(--text-primary)] font-medium">Conectado a Google Calendar</p>
                <p className="text-sm text-[var(--text-secondary)] mt-2">Las citas se sincronizarán automáticamente</p>
                <button className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">Desconectar</button>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-[var(--text-primary)] font-medium">Sincroniza tus citas</p>
                <p className="text-sm text-[var(--text-secondary)] mt-2 mb-4">Conecta tu cuenta de Google para sincronizar las citas automáticamente.</p>
                
                <div className="bg-[var(--bg-primary)] rounded-lg p-4 mb-4 text-left">
                  <p className="text-xs text-[var(--text-tertiary)] mb-3">Para configurar:</p>
                  <ol className="text-sm text-[var(--text-secondary)] space-y-2">
                    <li>1. Ve a <strong>Integraciones</strong></li>
                    <li>2. Selecciona <strong>Google Calendar</strong></li>
                    <li>3. Inicia sesión con tu cuenta de Google</li>
                  </ol>
                </div>
                
                <button onClick={() => { setShowGoogleConnect(false); router.push('/integraciones') }} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center justify-center gap-2">
                  <span>🔗</span> Ir a Integraciones
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
