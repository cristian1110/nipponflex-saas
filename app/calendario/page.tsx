
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import Input, { Textarea, Select } from '@/components/Input'
import { LoadingPage } from '@/components/Loading'

interface Cita {
  id: number
  titulo: string
  descripcion?: string
  fecha_inicio: string
  fecha_fin: string
  tipo: string
  estado: string
  lead_nombre?: string
}

const TIPOS_CITA = [
  { value: 'llamada', label: '📞 Llamada' },
  { value: 'reunion', label: '🤝 Reunión' },
  { value: 'visita', label: '🚗 Visita' },
  { value: 'otro', label: '📌 Otro' },
]

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function CalendarioPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    fecha_inicio: '',
    hora_inicio: '09:00',
    fecha_fin: '',
    hora_fin: '10:00',
    tipo: 'reunion',
    ubicacion: '',
  })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) loadCitas()
  }, [currentDate, user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) setUser(await res.json())
      else router.push('/login')
    } catch {
      router.push('/login')
    }
  }

  const loadCitas = async () => {
    const primerDia = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const ultimoDia = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    try {
      const res = await fetch(`/api/citas?desde=${primerDia.toISOString()}&hasta=${ultimoDia.toISOString()}`)
      if (res.ok) setCitas(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fechaInicio = new Date(`${formData.fecha_inicio}T${formData.hora_inicio}`)
      const fechaFin = new Date(`${formData.fecha_fin || formData.fecha_inicio}T${formData.hora_fin}`)
      const res = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          fecha_inicio: fechaInicio.toISOString(),
          fecha_fin: fechaFin.toISOString(),
          tipo: formData.tipo,
          ubicacion: formData.ubicacion,
        }),
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ titulo: '', descripcion: '', fecha_inicio: '', hora_inicio: '09:00', fecha_fin: '', hora_fin: '10:00', tipo: 'reunion', ubicacion: '' })
        loadCitas()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const openModalForDate = (date: Date) => {
    setFormData(prev => ({
      ...prev,
      fecha_inicio: date.toISOString().split('T')[0],
      fecha_fin: date.toISOString().split('T')[0],
    }))
    setShowModal(true)
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    const days: (Date | null)[] = []
    for (let i = 0; i < startingDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i))
    return days
  }

  const getCitasForDate = (date: Date) => citas.filter(cita => new Date(cita.fecha_inicio).toDateString() === date.toDateString())
  const isToday = (date: Date) => date.toDateString() === new Date().toDateString()

  if (loading || !user) return <LoadingPage />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar user={user} />
      <main className="ml-64">
        <Header title="Calendario" subtitle="Gestiona tus citas y eventos" actions={<Button onClick={() => setShowModal(true)}>+ Nueva Cita</Button>} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">←</button>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">{MESES[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">→</button>
          </div>
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] overflow-hidden">
            <div className="grid grid-cols-7 border-b border-[var(--border-color)]">
              {DIAS.map((dia) => (<div key={dia} className="p-3 text-center text-sm font-medium text-[var(--text-muted)] bg-[var(--bg-tertiary)]">{dia}</div>))}
            </div>
            <div className="grid grid-cols-7">
              {getDaysInMonth().map((date, i) => {
                const citasDelDia = date ? getCitasForDate(date) : []
                return (
                  <div key={i} onClick={() => date && openModalForDate(date)} className={`min-h-[120px] p-2 border-b border-r border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors ${!date ? 'bg-[var(--bg-tertiary)]/50' : ''} ${date && isToday(date) ? 'bg-green-500/10' : ''}`}>
                    {date && (
                      <>
                        <div className={`text-sm font-medium mb-1 ${isToday(date) ? 'text-green-500' : 'text-[var(--text-primary)]'}`}>{date.getDate()}</div>
                        <div className="space-y-1">
                          {citasDelDia.slice(0, 3).map((cita) => (
                            <div key={cita.id} className={`text-xs p-1 rounded truncate ${cita.tipo === 'llamada' ? 'bg-blue-500/20 text-blue-400' : cita.tipo === 'visita' ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-400'}`}>
                              {new Date(cita.fecha_inicio).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })} {cita.titulo}
                            </div>
                          ))}
                          {citasDelDia.length > 3 && <div className="text-xs text-[var(--text-muted)]">+{citasDelDia.length - 3} más</div>}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Cita" footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button><Button onClick={handleSubmit} loading={saving}>Crear Cita</Button></>}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Título" value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} required />
          <Select label="Tipo" value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} options={TIPOS_CITA} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha" type="date" value={formData.fecha_inicio} onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })} required />
            <Input label="Hora" type="time" value={formData.hora_inicio} onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })} required />
          </div>
          <Input label="Ubicación" value={formData.ubicacion} onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })} />
          <Textarea label="Descripción" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} rows={3} />
        </form>
      </Modal>
    </div>
  )
}
