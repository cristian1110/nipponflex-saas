// ==================== USUARIOS Y AUTENTICACIÓN ====================
export interface Usuario {
  id: number
  email: string
  nombre: string
  telefono?: string
  rol: 'superadmin' | 'admin' | 'distribuidor' | 'vendedor'
  nivel: number // 5=superadmin, 4=admin, 3=distribuidor, 2=vendedor
  cliente_id?: number
  cliente_nombre?: string
  activo: boolean
  debe_cambiar_password: boolean
  created_at: string
  updated_at: string
}

export interface Cliente {
  id: number
  nombre: string
  email: string
  telefono?: string
  plan: 'starter' | 'pro' | 'business' | 'enterprise'
  limite_agentes: number
  limite_usuarios: number
  limite_mensajes: number
  mensajes_usados: number
  activo: boolean
  fecha_inicio: string
  fecha_fin?: string
  created_at: string
}

// ==================== CRM ====================
export interface Lead {
  id: number
  cliente_id: number
  nombre: string
  telefono: string
  email?: string
  empresa?: string
  etapa_id: number
  etapa_nombre?: string
  etapa_color?: string
  etapa_orden?: number
  valor_estimado: number
  origen: string
  notas?: string
  asignado_a?: number
  asignado_nombre?: string
  ultimo_contacto?: string
  created_at: string
  updated_at: string
}

export interface Etapa {
  id: number
  cliente_id: number
  nombre: string
  color: string
  orden: number
  es_ganado: boolean
  es_perdido: boolean
}

export interface Actividad {
  id: number
  lead_id: number
  usuario_id: number
  usuario_nombre?: string
  tipo: 'llamada' | 'email' | 'whatsapp' | 'reunion' | 'nota' | 'tarea'
  descripcion: string
  fecha_programada?: string
  completada: boolean
  created_at: string
}

// ==================== CONVERSACIONES ====================
export interface Conversacion {
  numero_whatsapp: string
  nombre: string
  ultimo_mensaje: string
  ultimo_rol: 'user' | 'assistant' | 'system'
  fecha_ultimo: string
  total_mensajes: number
  canal: 'whatsapp' | 'telegram' | 'email' | 'instagram'
  sin_leer: number
  asignado_a?: number
  asignado_nombre?: string
}

export interface Mensaje {
  id: number
  conversacion_id?: number
  numero_whatsapp: string
  rol: 'user' | 'assistant' | 'system'
  mensaje: string
  tipo: 'text' | 'image' | 'audio' | 'video' | 'document'
  media_url?: string
  leido: boolean
  created_at: string
}

// ==================== AGENTES IA ====================
export interface Agente {
  id: number
  cliente_id: number
  nombre: string
  descripcion?: string
  prompt_sistema: string
  personalidad?: string
  temperatura: number
  modelo: string
  activo: boolean
  whatsapp_numero?: string
  telegram_bot?: string
  base_conocimiento_ids: number[]
  created_at: string
  updated_at: string
}

export interface BaseConocimiento {
  id: number
  cliente_id: number
  agente_id?: number
  nombre: string
  tipo: 'documento' | 'url' | 'texto' | 'faq'
  contenido?: string
  archivo_url?: string
  vectorizado: boolean
  total_chunks: number
  created_at: string
}

// ==================== CAMPAÑAS ====================
export interface Campana {
  id: number
  cliente_id: number
  nombre: string
  tipo: 'broadcast' | 'secuencia' | 'automatizada'
  estado: 'borrador' | 'programada' | 'enviando' | 'completada' | 'pausada'
  mensaje_template: string
  variables: string[]
  canal: 'whatsapp' | 'telegram' | 'email'
  total_destinatarios: number
  enviados: number
  entregados: number
  leidos: number
  respondidos: number
  fecha_programada?: string
  created_at: string
}

export interface DestinatarioCampana {
  id: number
  campana_id: number
  lead_id?: number
  telefono: string
  nombre: string
  variables: Record<string, string>
  estado: 'pendiente' | 'enviado' | 'entregado' | 'leido' | 'error'
  error_mensaje?: string
  enviado_at?: string
}

// ==================== CALENDARIO Y CITAS ====================
export interface Cita {
  id: number
  cliente_id: number
  lead_id?: number
  usuario_id: number
  titulo: string
  descripcion?: string
  fecha_inicio: string
  fecha_fin: string
  ubicacion?: string
  tipo: 'llamada' | 'reunion' | 'visita' | 'otro'
  estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada'
  recordatorio_enviado: boolean
  created_at: string
}

// ==================== AUTOMATIZACIONES ====================
export interface Automatizacion {
  id: number
  cliente_id: number
  nombre: string
  descripcion?: string
  trigger_tipo: 'mensaje_recibido' | 'nuevo_lead' | 'etapa_cambiada' | 'cita_creada' | 'webhook'
  trigger_config: Record<string, any>
  acciones: AccionAutomatizacion[]
  activo: boolean
  ejecuciones: number
  created_at: string
}

export interface AccionAutomatizacion {
  tipo: 'enviar_mensaje' | 'asignar_etiqueta' | 'mover_etapa' | 'crear_tarea' | 'webhook' | 'esperar'
  config: Record<string, any>
  orden: number
}

// ==================== INTEGRACIONES ====================
export interface Integracion {
  id: number
  cliente_id: number
  tipo: 'whatsapp' | 'telegram' | 'email' | 'odoo' | 'google_calendar' | 'webhook'
  nombre: string
  config: Record<string, any>
  activo: boolean
  ultimo_sync?: string
  created_at: string
}

// ==================== REPORTES ====================
export interface MetricasDashboard {
  total_leads: number
  leads_hoy: number
  leads_semana: number
  mensajes_hoy: number
  mensajes_semana: number
  citas_pendientes: number
  conversion_rate: number
  tiempo_respuesta_promedio: number
  leads_por_etapa: { etapa: string; color: string; total: number }[]
  mensajes_por_dia: { fecha: string; total: number }[]
  leads_por_origen: { origen: string; total: number }[]
}

// ==================== API RESPONSES ====================
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
