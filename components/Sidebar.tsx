'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import { useTranslation } from '@/lib/i18n'

interface SidebarProps {
  user: {
    nombre: string
    email: string
    rol: string
    nivel: number
    cliente_nombre?: string
  }
}

// Labels traducidos por key
const menuLabels: Record<string, { es: string; en: string; pt: string }> = {
  '/dashboard': { es: 'Dashboard', en: 'Dashboard', pt: 'Painel' },
  '/crm': { es: 'CRM', en: 'CRM', pt: 'CRM' },
  '/conversaciones': { es: 'Conversaciones', en: 'Conversations', pt: 'Conversas' },
  '/calendario': { es: 'Calendario', en: 'Calendar', pt: 'Calendário' },
  '/agentes': { es: 'Agentes IA', en: 'AI Agents', pt: 'Agentes IA' },
  '/catalogo': { es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' },
  '/reportes': { es: 'Reportes', en: 'Reports', pt: 'Relatórios' },
  '/usuarios': { es: 'Usuarios', en: 'Users', pt: 'Usuários' },
  '/integraciones': { es: 'Integraciones', en: 'Integrations', pt: 'Integrações' },
  '/configuracion': { es: 'Configuración', en: 'Settings', pt: 'Configurações' },
  '/admin/sistema': { es: 'Admin Sistema', en: 'System Admin', pt: 'Admin Sistema' },
  '/admin/metricas': { es: 'Métricas APIs', en: 'API Metrics', pt: 'Métricas APIs' },
}

const menuItems = [
  { href: '/dashboard', icon: '🏠', minLevel: 1 },
  { href: '/crm', icon: '👥', minLevel: 2 },
  { href: '/conversaciones', icon: '💬', minLevel: 2 },
  { href: '/calendario', icon: '📅', minLevel: 2 },
  { href: '/agentes', icon: '🤖', minLevel: 3 },
  { href: '/catalogo', icon: '📦', minLevel: 2 },
  { href: '/reportes', icon: '📊', minLevel: 3 },
  { href: '/usuarios', icon: '👤', minLevel: 4 },
  { href: '/integraciones', icon: '🔗', minLevel: 4 },
  { href: '/configuracion', icon: '⚙️', minLevel: 3 },
  // Solo Super Admin (nivel 100)
  { href: '/admin/sistema', icon: '🔧', minLevel: 100 },
  { href: '/admin/metricas', icon: '📈', minLevel: 100 },
]

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { locale, t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = menuItems.filter(item => user.nivel >= item.minLevel)

  // Función para obtener label traducido
  const getLabel = (href: string) => {
    const labels = menuLabels[href]
    return labels ? labels[locale] || labels.es : href
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className={`h-screen bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] transition-all duration-300 flex-shrink-0 flex flex-col ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">N</span>
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-[var(--sidebar-text)]">NipponFlex</h1>
              <p className="text-[10px] text-[var(--text-muted)]">AI Platform</p>
            </div>
          )}
        </div>
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] text-xs"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href
          const label = getLabel(item.href)
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'text-[var(--sidebar-text)] hover:bg-[var(--bg-hover)]'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? label : undefined}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && <span className="text-sm">{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-[var(--border-color)] p-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
            {user.nombre?.charAt(0).toUpperCase() || '?'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--sidebar-text)] truncate">{user.nombre}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{user.cliente_nombre || 'NipponFlex Ecuador'}</p>
            </div>
          )}
        </div>
        
        <div className={`flex items-center mt-3 ${collapsed ? 'justify-center' : 'gap-2'}`}>
          <ThemeToggle />
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="flex-1 px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              {t('common.logout')}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
