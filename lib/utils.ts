export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  if (hours < 24) return `hace ${hours}h`
  if (days < 7) return `hace ${days}d`
  return formatDate(date)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const PLANES: Record<string, { nombre: string; agentes: number; usuarios: number; mensajes: number; precio: number }> = {
  starter: { nombre: 'Starter', agentes: 1, usuarios: 2, mensajes: 500, precio: 99 },
  pro: { nombre: 'Pro', agentes: 3, usuarios: 5, mensajes: 2000, precio: 199 },
  business: { nombre: 'Business', agentes: 10, usuarios: 15, mensajes: 10000, precio: 349 },
  enterprise: { nombre: 'Enterprise', agentes: -1, usuarios: -1, mensajes: -1, precio: 0 },
}

export const ORIGENES_LEAD = [
  'WhatsApp',
  'Telegram',
  'Web',
  'Referido',
  'Facebook',
  'Instagram',
  'Google',
  'Llamada',
  'Email',
  'Otro',
]

export const COLORES_ETAPA: Record<string, string> = {
  nuevo: '#3b82f6',
  contactado: '#f59e0b',
  calificado: '#8b5cf6',
  propuesta: '#06b6d4',
  negociacion: '#ec4899',
  ganado: '#22c55e',
  perdido: '#ef4444',
}

export const ROLES: Record<string, { nombre: string; nivel: number; color: string }> = {
  superadmin: { nombre: 'Super Admin', nivel: 5, color: '#ef4444' },
  admin: { nombre: 'Administrador', nivel: 4, color: '#8b5cf6' },
  distribuidor: { nombre: 'Distribuidor', nivel: 3, color: '#3b82f6' },
  vendedor: { nombre: 'Vendedor', nivel: 2, color: '#22c55e' },
}
