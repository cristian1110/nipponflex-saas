'use client'

import { useState, useEffect } from 'react'

interface Campania {
  id: number
  nombre: string
  descripcion: string
  mensaje_plantilla: string
  mensaje_seguimiento: string
  estado: string
  pipeline_id: number
  pipeline_nombre: string
  etapa_inicial_id: number
  etapa_nombre: string
  agente_id: number
  agente_nombre: string
  horario_inicio: string
  horario_fin: string
  dias_semana: string
  delay_min: number
  delay_max: number
  contactos_por_dia: number
  total_contactos: number
  contactos_count: number
  enviados_count: number
  respondidos_count: number
  created_at: string
}

interface Pipeline { id: number; nombre: string }
interface Etapa { id: number; nombre: string; color: string }
interface Agente { id: number; nombre_custom: string }
interface CampaniaContacto {
  id: number
  nombre: string
  numero_whatsapp: string
  email: string
  empresa: string
  estado: string
  etapa_nombre: string
  enviado_at: string
  respondido_at: string
}

// Plantillas organizadas
const PLANTILLAS_MENSAJE = [
  // ESTRATEGIA DE VALOR
  { id: 'valor_sabias_que_1', nombre: '💡 ¿Sabías que...? (Dato curioso)', categoria: '🎓 Valor/Educativo',
    mensaje: 'Hola [NOMBRE] 👋 ¿Sabías que [DATO_CURIOSO]? Muchas personas no lo saben y terminan [PROBLEMA_COMUN]. Si te interesa, te puedo contar cómo evitarlo.',
    seguimiento: 'Hola [NOMBRE], ¿viste el dato que te compartí? Si tienes dudas sobre el tema, con gusto te ayudo.' },
  { id: 'valor_tip_gratis', nombre: '🎁 Tip gratuito', categoria: '🎓 Valor/Educativo',
    mensaje: 'Hola [NOMBRE], te comparto un tip que me ha funcionado muy bien: [TIP_UTIL]. Espero te sirva. Si quieres más consejos así, me avisas 😊',
    seguimiento: 'Hola [NOMBRE], ¿pudiste probar el tip que te compartí? Me encantaría saber si te funcionó.' },
  { id: 'valor_error_comun', nombre: '⚠️ Error común que debes evitar', categoria: '🎓 Valor/Educativo',
    mensaje: 'Hola [NOMBRE], te cuento algo importante: el error más común que veo en [AREA] es [ERROR_COMUN]. La mayoría no se da cuenta hasta que es tarde. ¿Te ha pasado algo así?',
    seguimiento: 'Hola [NOMBRE], ¿tuviste chance de leer sobre el error común que te mencioné? Muchos me han dicho que les abrió los ojos.' },
  { id: 'valor_te_contaron', nombre: '🤔 ¿Te contaron que...?', categoria: '🎓 Valor/Educativo',
    mensaje: 'Hola [NOMBRE], ¿te contaron que [INFORMACION_VALIOSA]? Es algo que pocos saben pero puede hacer una gran diferencia en [BENEFICIO]. Si te interesa profundizar, me avisas.',
    seguimiento: 'Hola [NOMBRE], sobre lo que te comenté de [TEMA]... ¿te gustaría que te explique más a detalle?' },
  { id: 'valor_guia_gratis', nombre: '📚 Guía/Recurso gratis', categoria: '🎓 Valor/Educativo',
    mensaje: 'Hola [NOMBRE] 📚 Preparé una guía sobre [TEMA] que creo te puede servir. Es gratis y va directo al grano. ¿Te la comparto?',
    seguimiento: 'Hola [NOMBRE], ¿te interesa la guía de [TEMA]? Varios me han dicho que les ayudó mucho.' },
  { id: 'valor_pregunta', nombre: '❓ Pregunta que genera curiosidad', categoria: '🎓 Valor/Educativo',
    mensaje: 'Hola [NOMBRE], tengo una pregunta: ¿Alguna vez te has preguntado por qué [PREGUNTA_CURIOSA]? La respuesta me sorprendió cuando la descubrí. Te cuento si te interesa.',
    seguimiento: 'Hola [NOMBRE], ¿te quedó curiosidad sobre la pregunta que te hice? La respuesta es bastante interesante.' },
  { id: 'valor_caso_exito', nombre: '📈 Historia de éxito (sin vender)', categoria: '🎓 Valor/Educativo',
    mensaje: 'Hola [NOMBRE], te cuento algo que le pasó a un conocido: [HISTORIA_BREVE]. Lo interesante es cómo lo resolvió. ¿Te suena familiar esta situación?',
    seguimiento: 'Hola [NOMBRE], ¿te identificaste con la historia que te conté? Si estás en una situación similar, quizás te pueda orientar.' },
  // VENTAS SUAVES
  { id: 'venta_suave_ayuda', nombre: '🤝 Ofrezco ayuda (no producto)', categoria: '🛒 Ventas Suaves',
    mensaje: 'Hola [NOMBRE], soy [TU_NOMBRE]. Me dedico a ayudar a personas con [PROBLEMA]. No sé si es tu caso, pero si alguna vez necesitas orientación sobre el tema, cuenta conmigo.',
    seguimiento: 'Hola [NOMBRE], solo pasaba a saludarte. Recuerda que si tienes dudas sobre [TEMA], aquí estoy para ayudarte.' },
  { id: 'venta_suave_disponible', nombre: '📞 Estoy disponible', categoria: '🛒 Ventas Suaves',
    mensaje: 'Hola [NOMBRE], espero que estés bien. Quería avisarte que estoy disponible por si necesitas [SERVICIO/AYUDA]. Sin presión, solo para que lo tengas presente 😊',
    seguimiento: 'Hola [NOMBRE], ¿cómo vas? Solo quería saber si hay algo en lo que pueda ayudarte.' },
  // PROMOCIONES
  { id: 'promo_especial', nombre: '🎉 Promoción especial', categoria: '🏷️ Promociones',
    mensaje: 'Hola [NOMBRE] 🎉 Tenemos una promoción especial: [DESCRIPCION_OFERTA]. Es por tiempo limitado. Si te interesa, me avisas y te cuento los detalles.',
    seguimiento: 'Hola [NOMBRE], la promoción que te mencioné sigue vigente por [TIEMPO]. ¿Hay algo que te gustaría saber?' },
  { id: 'promo_lanzamiento', nombre: '🚀 Nuevo lanzamiento', categoria: '🏷️ Promociones',
    mensaje: 'Hola [NOMBRE] 🚀 Acabamos de lanzar [PRODUCTO_NUEVO]. Pensé en ti porque [RAZON]. Los primeros en probarlo tienen [BENEFICIO_ESPECIAL]. ¿Te interesa?',
    seguimiento: 'Hola [NOMBRE], el lanzamiento de [PRODUCTO] está teniendo muy buena respuesta. ¿Te gustaría conocerlo?' },
  // POR INDUSTRIA
  { id: 'inmob_info', nombre: '🏠 Inmobiliaria - Info de zona', categoria: '🏠 Inmobiliaria',
    mensaje: 'Hola [NOMBRE], ¿sabías que la zona de [ZONA] está teniendo mucho movimiento? Los precios [TENDENCIA]. Si estás pensando en invertir o mudarte, te puedo dar más info.',
    seguimiento: 'Hola [NOMBRE], ¿te interesa saber más sobre las oportunidades en [ZONA]?' },
  { id: 'salud_consejo', nombre: '💚 Salud - Consejo', categoria: '💚 Salud',
    mensaje: 'Hola [NOMBRE] 💚 Un consejo rápido: [CONSEJO_SALUD]. Es algo simple pero que hace mucha diferencia. ¿Lo has intentado?',
    seguimiento: 'Hola [NOMBRE], ¿qué tal te fue con el consejo que te compartí? Si necesitas más tips, aquí estoy.' },
  { id: 'edu_tip', nombre: '📚 Educación - Tip', categoria: '📚 Educación',
    mensaje: 'Hola [NOMBRE] 📚 ¿Sabías que la mejor forma de aprender [TEMA] es [METODO]? Es un tip que comparto en mis cursos. Si te interesa profundizar, me avisas.',
    seguimiento: 'Hola [NOMBRE], ¿te sirvió el tip de aprendizaje? Tengo más técnicas que podría compartirte.' },
  { id: 'tech_novedad', nombre: '💻 Tecnología - Novedad', categoria: '💻 Tecnología',
    mensaje: 'Hola [NOMBRE], ¿te enteraste de [NOVEDAD_TECH]? Esto va a cambiar la forma en que [IMPACTO]. Si quieres saber cómo aprovechar esto para tu negocio, platicamos.',
    seguimiento: 'Hola [NOMBRE], sobre [NOVEDAD_TECH]... ¿te gustaría saber cómo implementarlo?' },
  { id: 'belleza_tendencia', nombre: '💅 Belleza - Tendencia', categoria: '💅 Belleza',
    mensaje: 'Hola [NOMBRE] ✨ Te cuento que la tendencia en [AREA_BELLEZA] este mes es [TENDENCIA]. Muchas clientas me lo están pidiendo. ¿Te gustaría probarlo?',
    seguimiento: 'Hola [NOMBRE], ¿viste la tendencia que te mencioné? Tengo disponibilidad si te animas a probarla.' },
  { id: 'fitness_motivacion', nombre: '🏋️ Fitness - Motivación', categoria: '🏋️ Fitness',
    mensaje: 'Hola [NOMBRE] 💪 Un dato: el [PORCENTAJE]% de las personas que [ACCION_FITNESS] logran [RESULTADO] en solo [TIEMPO]. ¿Tú ya empezaste?',
    seguimiento: 'Hola [NOMBRE], ¿cómo va tu rutina? Recuerda que nunca es tarde para empezar o retomar.' },
  { id: 'restaurante_recomendacion', nombre: '🍽️ Restaurante - Especial', categoria: '🍽️ Restaurantes',
    mensaje: 'Hola [NOMBRE] 🍽️ Esta semana nuestro chef preparó algo especial: [PLATILLO]. Los que lo han probado no dejan de recomendarlo. ¿Te gustaría reservar?',
    seguimiento: 'Hola [NOMBRE], el [PLATILLO] sigue disponible este fin de semana. ¿Te aparto mesa?' }
]

const VARIABLES_AYUDA = [
  { variable: '[NOMBRE]', descripcion: 'Nombre del contacto (automático)', ejemplo: 'Hola Juan...' },
  { variable: '[TU_NOMBRE]', descripcion: 'Tu nombre o del vendedor', ejemplo: 'Soy Carlos...' },
  { variable: '[TU_EMPRESA]', descripcion: 'Nombre de tu negocio', ejemplo: 'NipponFlex' },
  { variable: '[DATO_CURIOSO]', descripcion: 'Dato interesante de tu industria', ejemplo: 'el 80% no sabe...' },
  { variable: '[TIP_UTIL]', descripcion: 'Consejo práctico', ejemplo: 'si haces X, logras Y' },
  { variable: '[PROBLEMA_COMUN]', descripcion: 'Problema típico', ejemplo: 'pagando de más' },
  { variable: '[PRODUCTO]', descripcion: 'Tu producto/servicio', ejemplo: 'Curso de Excel' },
  { variable: '[ZONA]', descripcion: 'Ubicación', ejemplo: 'Norte de Quito' },
  { variable: '[TEMA]', descripcion: 'El tema del mensaje', ejemplo: 'finanzas personales' },
]

const DIAS_SEMANA = [
  { id: '1', nombre: 'Lun', nombreCompleto: 'Lunes' },
  { id: '2', nombre: 'Mar', nombreCompleto: 'Martes' },
  { id: '3', nombre: 'Mié', nombreCompleto: 'Miércoles' },
  { id: '4', nombre: 'Jue', nombreCompleto: 'Jueves' },
  { id: '5', nombre: 'Vie', nombreCompleto: 'Viernes' },
  { id: '6', nombre: 'Sáb', nombreCompleto: 'Sábado' },
  { id: '0', nombre: 'Dom', nombreCompleto: 'Domingo' },
]

export default function CampaniasTab() {
  const [campanias, setCampanias] = useState<Campania[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showContactos, setShowContactos] = useState(false)
  const [showImportar, setShowImportar] = useState(false)
  const [showPlantillasMsg, setShowPlantillasMsg] = useState(false)
  const [showAyudaVariables, setShowAyudaVariables] = useState(false)
  const [selectedCampania, setSelectedCampania] = useState<Campania | null>(null)
  const [campaniaContactos, setCampaniaContactos] = useState<CampaniaContacto[]>([])
  const [mejorando, setMejorando] = useState(false)
  const [mejorandoSeguimiento, setMejorandoSeguimiento] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [agentes, setAgentes] = useState<Agente[]>([])
  
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    mensaje_plantilla: '',
    mensaje_seguimiento: '',
    pipeline_id: 0,
    etapa_inicial_id: 0,
    agente_id: 0,
    horario_inicio: '09:00',
    horario_fin: '18:00',
    dias_semana: ['1', '2', '3', '4', '5'], // Array de días seleccionados
    delay_min: 30,
    delay_max: 90,
    contactos_por_dia: 20,
    dias_sin_respuesta: 3,
    max_seguimientos: 2
  })

  const [importMode, setImportMode] = useState<'csv' | 'leads'>('leads')
  const [leadsDisponibles, setLeadsDisponibles] = useState<any[]>([])
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])
  const [csvData, setCsvData] = useState('')

  const categorias = ['todas', ...Array.from(new Set(PLANTILLAS_MENSAJE.map(p => p.categoria)))]

  useEffect(() => { loadCampanias(); loadPipelines(); loadAgentes() }, [])

  const loadCampanias = async () => {
    try {
      const res = await fetch('/api/campanias')
      const data = await res.json()
      setCampanias(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const loadPipelines = async () => {
    const res = await fetch('/api/pipelines')
    const data = await res.json()
    setPipelines(Array.isArray(data) ? data : [])
  }

  const loadEtapas = async (pipelineId: number) => {
    const res = await fetch(`/api/pipelines/etapas?pipeline_id=${pipelineId}`)
    const data = await res.json()
    setEtapas(Array.isArray(data) ? data : [])
    if (data.length > 0) setFormData(prev => ({ ...prev, etapa_inicial_id: data[0].id }))
  }

  const loadAgentes = async () => {
    const res = await fetch('/api/agentes')
    const data = await res.json()
    setAgentes(Array.isArray(data) ? data : [])
  }

  const loadLeadsDisponibles = async () => {
    try {
      const res = await fetch('/api/leads?limit=500')
      const data = await res.json()
      console.log('Leads response:', data)
      if (data.error) {
        console.error('Error cargando leads:', data.error)
        setLeadsDisponibles([])
        return
      }
      const leads = Array.isArray(data) ? data : (data.leads || [])
      setLeadsDisponibles(leads)
    } catch (e) {
      console.error('Error fetch leads:', e)
      setLeadsDisponibles([])
    }
  }

  const loadCampaniaContactos = async (campaniaId: number) => {
    const res = await fetch(`/api/campanias/contactos?campania_id=${campaniaId}`)
    const data = await res.json()
    setCampaniaContactos(Array.isArray(data) ? data : [])
  }

  const toggleDia = (diaId: string) => {
    setFormData(prev => {
      const dias = prev.dias_semana.includes(diaId)
        ? prev.dias_semana.filter(d => d !== diaId)
        : [...prev.dias_semana, diaId]
      return { ...prev, dias_semana: dias }
    })
  }

  const mejorarConIA = async (tipo: 'inicial' | 'seguimiento') => {
    const mensaje = tipo === 'inicial' ? formData.mensaje_plantilla : formData.mensaje_seguimiento
    if (!mensaje.trim()) { alert('Primero escribe un mensaje'); return }
    
    if (tipo === 'inicial') setMejorando(true)
    else setMejorandoSeguimiento(true)

    try {
      const res = await fetch('/api/campanias/mejorar-mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje, tipo })
      })
      if (res.ok) {
        const data = await res.json()
        if (tipo === 'inicial') setFormData(prev => ({ ...prev, mensaje_plantilla: data.mensaje_mejorado }))
        else setFormData(prev => ({ ...prev, mensaje_seguimiento: data.mensaje_mejorado }))
      }
    } catch (e) { console.error(e) }

    if (tipo === 'inicial') setMejorando(false)
    else setMejorandoSeguimiento(false)
  }

  const aplicarPlantilla = (plantilla: typeof PLANTILLAS_MENSAJE[0]) => {
    setFormData(prev => ({
      ...prev,
      mensaje_plantilla: plantilla.mensaje,
      mensaje_seguimiento: plantilla.seguimiento
    }))
    setShowPlantillasMsg(false)
  }

  const cambiarEstado = async (campaniaId: number, nuevoEstado: string) => {
    try {
      const res = await fetch('/api/campanias/estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campania_id: campaniaId, estado: nuevoEstado })
      })
      if (res.ok) loadCampanias()
      else { const error = await res.json(); alert(error.error) }
    } catch (e) { console.error(e) }
  }

  const eliminarCampania = async (id: number) => {
    if (!confirm('¿Eliminar esta campaña y todos sus contactos?')) return
    await fetch(`/api/campanias?id=${id}`, { method: 'DELETE' })
    loadCampanias()
  }

  const editarCampania = async (campania: Campania) => {
    setEditingId(campania.id)
    setFormData({
      nombre: campania.nombre || '',
      descripcion: campania.descripcion || '',
      mensaje_plantilla: campania.mensaje_plantilla || '',
      mensaje_seguimiento: campania.mensaje_seguimiento || '',
      pipeline_id: campania.pipeline_id || 0,
      etapa_inicial_id: campania.etapa_inicial_id || 0,
      agente_id: campania.agente_id || 0,
      horario_inicio: campania.horario_inicio || '09:00',
      horario_fin: campania.horario_fin || '18:00',
      dias_semana: campania.dias_semana ? campania.dias_semana.split(',') : ['1', '2', '3', '4', '5'],
      delay_min: campania.delay_min || 30,
      delay_max: campania.delay_max || 90,
      contactos_por_dia: campania.contactos_por_dia || 20,
      dias_sin_respuesta: 3,
      max_seguimientos: 2
    })
    if (campania.pipeline_id) {
      await loadEtapas(campania.pipeline_id)
    }
    setShowModal(true)
  }

  const guardarCampania = async () => {
    if (!formData.nombre || !formData.mensaje_plantilla || !formData.pipeline_id) {
      alert('Completa: Nombre, Mensaje y Pipeline')
      return
    }
    if (formData.dias_semana.length === 0) {
      alert('Selecciona al menos un día de la semana')
      return
    }
    try {
      const dataToSend = {
        ...formData,
        dias_semana: formData.dias_semana.join(','),
        ...(editingId && { id: editingId })
      }

      const res = await fetch('/api/campanias', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })
      if (res.ok) {
        setShowModal(false)
        setEditingId(null)
        resetForm()
        loadCampanias()
      } else {
        const error = await res.json()
        alert(error.error || 'Error al guardar')
      }
    } catch (e) { console.error(e) }
  }

  const importarLeads = async () => {
    if (!selectedCampania) return
    try {
      const res = await fetch('/api/campanias/importar-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campania_id: selectedCampania.id, lead_ids: selectedLeads })
      })
      const data = await res.json()
      alert(`✅ ${data.agregados} contactos importados`)
      setShowImportar(false); setSelectedLeads([]); loadCampanias()
    } catch (e) { console.error(e) }
  }

  const importarCSV = async () => {
    if (!selectedCampania || !csvData.trim()) return
    const lineas = csvData.trim().split('\n')
    const contactos = lineas.map(linea => {
      const [nombre, telefono, email, empresa] = linea.split(',').map(s => s.trim())
      return { nombre, telefono, email, empresa }
    }).filter(c => c.telefono)

    try {
      const res = await fetch('/api/campanias/contactos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campania_id: selectedCampania.id, contactos })
      })
      const data = await res.json()
      alert(`✅ ${data.agregados} contactos agregados`)
      setShowImportar(false); setCsvData(''); loadCampanias()
    } catch (e) { console.error(e) }
  }

  const resetForm = () => {
    setFormData({
      nombre: '', descripcion: '', mensaje_plantilla: '', mensaje_seguimiento: '',
      pipeline_id: 0, etapa_inicial_id: 0, agente_id: 0,
      horario_inicio: '09:00', horario_fin: '18:00', dias_semana: ['1', '2', '3', '4', '5'],
      delay_min: 30, delay_max: 90, contactos_por_dia: 20, dias_sin_respuesta: 3, max_seguimientos: 2
    })
    setEtapas([])
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'activa': return 'bg-emerald-500'
      case 'pausada': return 'bg-yellow-500'
      case 'completada': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getEstadoContactoColor = (estado: string) => {
    switch (estado) {
      case 'enviado': return 'text-blue-400'
      case 'respondido': return 'text-emerald-400'
      case 'convertido': return 'text-green-400'
      case 'no_interesado': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getDiasTexto = (diasStr: string) => {
    if (!diasStr) return 'Sin días'
    const dias = diasStr.split(',')
    if (dias.length === 7) return 'Todos los días'
    if (dias.length === 5 && !dias.includes('6') && !dias.includes('0')) return 'Lun-Vie'
    return dias.map(d => DIAS_SEMANA.find(ds => ds.id === d)?.nombre || d).join(', ')
  }

  const plantillasFiltradas = filtroCategoria === 'todas' 
    ? PLANTILLAS_MENSAJE 
    : PLANTILLAS_MENSAJE.filter(p => p.categoria === filtroCategoria)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">📣 Campañas de WhatsApp</h2>
          <p className="text-sm text-[var(--text-secondary)]">Envía mensajes a tus contactos de forma automatizada</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
          + Nueva Campaña
        </button>
      </div>

      {/* Info del flujo */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
        <p className="text-sm text-blue-300">
          <strong>¿Cómo funciona?</strong> Cada día, en el horario y días configurados, el sistema contacta automáticamente la cantidad de contactos que definas. 
          Cuando responden, la IA detecta su intención y los mueve a la etapa correspondiente del pipeline.
        </p>
      </div>

      {/* Lista de Campañas */}
      {campanias.length === 0 ? (
        <div className="text-center py-12 bg-[var(--bg-secondary)] rounded-xl">
          <div className="text-4xl mb-3">📣</div>
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No tienes campañas todavía</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-md mx-auto">
            Crea tu primera campaña para comenzar a contactar clientes de forma automatizada.
          </p>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">
            Crear mi primera campaña
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {campanias.map(c => (
            <div key={c.id} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[var(--text-primary)]">{c.nombre}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs text-white ${getEstadoColor(c.estado)}`}>
                      {c.estado === 'borrador' ? '📝 Borrador' : c.estado === 'activa' ? '▶️ Enviando' : c.estado === 'pausada' ? '⏸️ Pausada' : '✅ Completada'}
                    </span>
                  </div>
                  {c.descripcion && <p className="text-sm text-[var(--text-secondary)] mb-2">{c.descripcion}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-[var(--text-tertiary)]">
                    <span>📊 {c.pipeline_nombre || 'Sin pipeline'}</span>
                    <span>🤖 {c.agente_nombre || 'Manual'}</span>
                    <span>⏰ {c.horario_inicio}-{c.horario_fin}</span>
                    <span>📅 {getDiasTexto(c.dias_semana)}</span>
                    <span>👥 {c.contactos_por_dia} contactos/día</span>
                  </div>
                </div>
                
                <div className="flex gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-[var(--text-primary)]">{c.contactos_count || 0}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Total</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-400">{c.enviados_count || 0}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Contactados</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-400">{c.respondidos_count || 0}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Respondieron</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-color)]">
                {c.estado === 'borrador' && (
                  <>
                    <button onClick={() => { setSelectedCampania(c); setShowImportar(true); loadLeadsDisponibles() }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs">
                      📥 Importar Contactos
                    </button>
                    <button onClick={() => cambiarEstado(c.id, 'activa')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs disabled:opacity-50"
                      disabled={(c.contactos_count || 0) === 0}>
                      ▶️ Iniciar Campaña
                    </button>
                  </>
                )}
                {c.estado === 'activa' && (
                  <button onClick={() => cambiarEstado(c.id, 'pausada')}
                    className="px-3 py-1.5 bg-yellow-600 text-white rounded text-xs">
                    ⏸️ Pausar
                  </button>
                )}
                {c.estado === 'pausada' && (
                  <>
                    <button onClick={() => cambiarEstado(c.id, 'activa')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs">
                      ▶️ Reanudar
                    </button>
                    <button onClick={() => cambiarEstado(c.id, 'completada')}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs">
                      ✅ Finalizar
                    </button>
                  </>
                )}
                <button onClick={() => { setSelectedCampania(c); loadCampaniaContactos(c.id); setShowContactos(true) }}
                  className="px-3 py-1.5 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded text-xs border border-[var(--border-color)]">
                  👥 Ver Contactos
                </button>
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => editarCampania(c)}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30"
                    title="Editar campaña">
                    ✏️ Editar
                  </button>
                  <button onClick={() => eliminarCampania(c.id)}
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                    title="Eliminar campaña">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nueva/Editar Campaña */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-2xl my-4">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h3 className="font-bold text-[var(--text-primary)]">{editingId ? 'Editar Campaña' : 'Nueva Campaña'}</h3>
              <button onClick={() => { setShowModal(false); setEditingId(null); resetForm() }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl">✕</button>
            </div>
            
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre *</label>
                  <input type="text" value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                    placeholder="Ej: Promoción Enero" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Pipeline *</label>
                  <select value={formData.pipeline_id}
                    onChange={(e) => { const pId = Number(e.target.value); setFormData({ ...formData, pipeline_id: pId }); if (pId) loadEtapas(pId) }}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
                    <option value={0}>Selecciona...</option>
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Etapa inicial</label>
                  <select value={formData.etapa_inicial_id}
                    onChange={(e) => setFormData({ ...formData, etapa_inicial_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
                    <option value={0}>Primera etapa</option>
                    {etapas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Agente IA (respuestas)</label>
                  <select value={formData.agente_id}
                    onChange={(e) => setFormData({ ...formData, agente_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
                    <option value={0}>Respondo manual</option>
                    {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre_custom}</option>)}
                  </select>
                </div>
              </div>

              {/* Mensaje Inicial */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-[var(--text-secondary)]">Mensaje inicial *</label>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAyudaVariables(true)}
                      className="px-2 py-1 text-xs bg-gray-600/20 text-gray-400 rounded hover:bg-gray-600/30">
                      ❓ Ayuda
                    </button>
                    <button onClick={() => setShowPlantillasMsg(true)}
                      className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30">
                      📋 Plantillas
                    </button>
                    <button onClick={() => mejorarConIA('inicial')} disabled={mejorando || !formData.mensaje_plantilla.trim()}
                      className="px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded hover:bg-purple-600/30 disabled:opacity-50">
                      {mejorando ? '⏳...' : '✨ Mejorar con IA'}
                    </button>
                  </div>
                </div>
                <textarea value={formData.mensaje_plantilla}
                  onChange={(e) => setFormData({ ...formData, mensaje_plantilla: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] resize-none"
                  placeholder="Escribe tu mensaje o selecciona una plantilla..." />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  💡 Usa [NOMBRE] y se reemplazará automáticamente por el nombre de cada contacto
                </p>
              </div>

              {/* Mensaje de Seguimiento */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-[var(--text-secondary)]">
                    Mensaje de seguimiento <span className="text-xs">(si no responden en {formData.dias_sin_respuesta} días)</span>
                  </label>
                  <button onClick={() => mejorarConIA('seguimiento')} disabled={mejorandoSeguimiento || !formData.mensaje_seguimiento.trim()}
                    className="px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded hover:bg-purple-600/30 disabled:opacity-50">
                    {mejorandoSeguimiento ? '⏳...' : '✨ Mejorar'}
                  </button>
                </div>
                <textarea value={formData.mensaje_seguimiento}
                  onChange={(e) => setFormData({ ...formData, mensaje_seguimiento: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] resize-none"
                  placeholder="Mensaje si no responden..." />
              </div>

              {/* Configuración de envío */}
              <div className="bg-[var(--bg-primary)] rounded-lg p-4">
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">⚙️ Configuración de envío</h4>
                
                {/* Días de la semana */}
                <div className="mb-4">
                  <label className="block text-xs text-[var(--text-secondary)] mb-2">Días de envío</label>
                  <div className="flex gap-2 flex-wrap">
                    {DIAS_SEMANA.map(dia => (
                      <button
                        key={dia.id}
                        type="button"
                        onClick={() => toggleDia(dia.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          formData.dias_semana.includes(dia.id)
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                        title={dia.nombreCompleto}
                      >
                        {dia.nombre}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Selecciona los días en que se enviarán los mensajes
                  </p>
                </div>

                {/* Horarios y cantidad */}
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Hora inicio</label>
                    <input type="time" value={formData.horario_inicio}
                      onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
                      className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Hora fin</label>
                    <input type="time" value={formData.horario_fin}
                      onChange={(e) => setFormData({ ...formData, horario_fin: e.target.value })}
                      className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Contactos/día</label>
                    <input type="number" value={formData.contactos_por_dia}
                      onChange={(e) => setFormData({ ...formData, contactos_por_dia: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
                      min={1} max={100} />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Seguimiento (días)</label>
                    <input type="number" value={formData.dias_sin_respuesta}
                      onChange={(e) => setFormData({ ...formData, dias_sin_respuesta: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
                      min={1} max={30} />
                  </div>
                </div>

                {/* Explicación */}
                <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded">
                  <p className="text-xs text-emerald-300">
                    📊 <strong>Ejemplo:</strong> Con 100 contactos y 10 contactos/día, la campaña durará 10 días. 
                    Cada día se contactarán 10 personas nuevas entre las {formData.horario_inicio} y {formData.horario_fin}.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border-color)] flex gap-2">
              <button onClick={() => { setShowModal(false); setEditingId(null); resetForm() }}
                className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]">
                Cancelar
              </button>
              <button onClick={guardarCampania}
                disabled={!formData.nombre || !formData.mensaje_plantilla || !formData.pipeline_id || formData.dias_semana.length === 0}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                {editingId ? 'Guardar Cambios' : 'Crear Campaña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ayuda Variables */}
      {showAyudaVariables && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center shrink-0">
              <h3 className="font-bold text-[var(--text-primary)]">❓ Cómo personalizar tu mensaje</h3>
              <button onClick={() => setShowAyudaVariables(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Usa estos textos especiales y se reemplazarán automáticamente:
              </p>
              <div className="space-y-2">
                {VARIABLES_AYUDA.map(v => (
                  <div key={v.variable} className="bg-[var(--bg-primary)] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <code className="text-emerald-400 font-mono text-sm bg-emerald-500/10 px-2 py-0.5 rounded">{v.variable}</code>
                      <button onClick={() => navigator.clipboard.writeText(v.variable)}
                        className="text-xs text-blue-400 hover:underline">Copiar</button>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{v.descripcion}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Ejemplo: {v.ejemplo}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p className="text-sm text-emerald-300">
                  <strong>Ejemplo:</strong> "Hola [NOMBRE]..." → "Hola Juan..."
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-[var(--border-color)] shrink-0">
              <button onClick={() => setShowAyudaVariables(false)}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg">¡Entendido!</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Plantillas */}
      {showPlantillasMsg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center shrink-0">
              <h3 className="font-bold text-[var(--text-primary)]">📋 Plantillas de Mensaje</h3>
              <button onClick={() => setShowPlantillasMsg(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="p-3 border-b border-[var(--border-color)] flex gap-2 flex-wrap shrink-0">
              {categorias.map(cat => (
                <button key={cat} onClick={() => setFiltroCategoria(cat)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${filtroCategoria === cat ? 'bg-emerald-600 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>
                  {cat === 'todas' ? '📋 Todas' : cat}
                </button>
              ))}
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="grid gap-3">
                {plantillasFiltradas.map(p => (
                  <div key={p.id} onClick={() => aplicarPlantilla(p)}
                    className="p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] cursor-pointer hover:border-emerald-500 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-[var(--text-primary)]">{p.nombre}</span>
                      <span className="text-xs px-2 py-0.5 bg-[var(--bg-tertiary)] rounded">{p.categoria}</span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-2">{p.mensaje}</p>
                    <p className="text-xs text-[var(--text-tertiary)]"><strong>Seguimiento:</strong> {p.seguimiento}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)] shrink-0">
              <p className="text-xs text-[var(--text-tertiary)] text-center">
                💡 Haz clic en una plantilla para usarla. Luego personaliza los textos entre [CORCHETES]
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar */}
      {showImportar && selectedCampania && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center shrink-0">
              <h3 className="font-bold text-[var(--text-primary)]">📥 Importar Contactos</h3>
              <button onClick={() => { setShowImportar(false); setSelectedLeads([]) }} className="text-[var(--text-secondary)] text-xl">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex gap-2 mb-4">
                <button onClick={() => setImportMode('leads')}
                  className={`flex-1 py-2 rounded-lg text-sm ${importMode === 'leads' ? 'bg-emerald-600 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`}>
                  👥 Desde mis Leads
                </button>
                <button onClick={() => setImportMode('csv')}
                  className={`flex-1 py-2 rounded-lg text-sm ${importMode === 'csv' ? 'bg-emerald-600 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`}>
                  📝 Manual
                </button>
              </div>
              {importMode === 'leads' ? (
                <div>
                  <div className="max-h-60 overflow-y-auto border border-[var(--border-color)] rounded-lg">
                    {leadsDisponibles.length === 0 ? (
                      <p className="p-4 text-center text-[var(--text-tertiary)]">No hay leads. Agrega contactos primero.</p>
                    ) : leadsDisponibles.map(lead => (
                      <label key={lead.id} className="flex items-center gap-2 p-2 hover:bg-[var(--bg-primary)] cursor-pointer border-b border-[var(--border-color)] last:border-0">
                        <input type="checkbox" checked={selectedLeads.includes(lead.id)}
                          onChange={(e) => setSelectedLeads(e.target.checked ? [...selectedLeads, lead.id] : selectedLeads.filter(id => id !== lead.id))}
                          className="rounded" />
                        <div className="flex-1">
                          <div className="text-sm text-[var(--text-primary)]">{lead.nombre || 'Sin nombre'}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">{lead.numero_whatsapp || lead.telefono}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {leadsDisponibles.length > 0 && (
                    <button onClick={() => setSelectedLeads(leadsDisponibles.map(l => l.id))}
                      className="mt-2 text-xs text-emerald-400 hover:underline">
                      ✓ Seleccionar todos ({leadsDisponibles.length})
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[var(--text-secondary)] mb-2">Formato: <code className="bg-[var(--bg-primary)] px-1 rounded text-xs">nombre, teléfono</code></p>
                  <textarea value={csvData} onChange={(e) => setCsvData(e.target.value)} rows={8}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] font-mono resize-none"
                    placeholder="Juan Pérez, 593999123456&#10;María López, 593998765432" />
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[var(--border-color)] flex gap-2 shrink-0">
              <button onClick={() => { setShowImportar(false); setSelectedLeads([]); setCsvData('') }}
                className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]">Cancelar</button>
              <button onClick={importMode === 'leads' ? importarLeads : importarCSV}
                disabled={importMode === 'leads' ? selectedLeads.length === 0 : !csvData.trim()}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                Importar {importMode === 'leads' && selectedLeads.length > 0 ? `(${selectedLeads.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Contactos */}
      {showContactos && selectedCampania && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-[var(--text-primary)]">👥 {selectedCampania.nombre}</h3>
                <p className="text-xs text-[var(--text-tertiary)]">{campaniaContactos.length} contactos</p>
              </div>
              <button onClick={() => setShowContactos(false)} className="text-[var(--text-secondary)] text-xl">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {campaniaContactos.length === 0 ? (
                <div className="text-center py-8"><p className="text-[var(--text-tertiary)]">No hay contactos aún</p></div>
              ) : (
                <div className="space-y-2">
                  {campaniaContactos.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg">
                      <div className="flex-1">
                        <div className="text-sm text-[var(--text-primary)]">{c.nombre || 'Sin nombre'}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{c.numero_whatsapp}</div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium ${getEstadoContactoColor(c.estado)}`}>
                          {c.estado === 'pendiente' ? '⏳ Pendiente' : 
                           c.estado === 'enviado' ? '📤 Contactado' :
                           c.estado === 'respondido' ? '💬 Respondió' :
                           c.estado === 'convertido' ? '🎉 Convertido' :
                           c.estado === 'no_interesado' ? '❌ No interesado' : c.estado}
                        </span>
                        {c.etapa_nombre && <div className="text-xs text-[var(--text-tertiary)]">{c.etapa_nombre}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
