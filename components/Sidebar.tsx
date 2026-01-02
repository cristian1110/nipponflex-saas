'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

interface SidebarProps {
  user: {
    nombre: string
    email: string
    rol: string
    nivel: number
    cliente_nombre?: string
  }
}

const menuItems = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard', minLevel: 1 },
  { href: '/crm', icon: '👥', label: 'CRM', minLevel: 2 },
  { href: '/conversaciones', icon: '💬', label: 'Conversaciones', minLevel: 2 },
  { href: '/calendario', icon: '📅', label: 'Calendario', minLevel: 2 },
  { href: '/agentes', icon: '🤖', label: 'Agentes IA', minLevel: 3 },
  { href: '/reportes', icon: '📊', label: 'Reportes', minLevel: 3 },
  { href: '/usuarios', icon: '👤', label: 'Usuarios', minLevel: 4 },
  { href: '/clientes', icon: '🏢', label: 'Clientes', minLevel: 5 },
  { href: '/integraciones', icon: '🔗', label: 'Integraciones', minLevel: 4 },
  { href: '/configuracion', icon: '⚙️', label: 'Configuración', minLevel: 3 },
]

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = menuItems.filter(item => user.nivel >= item.minLevel)

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
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'text-[var(--sidebar-text)] hover:bg-[var(--bg-hover)]'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && <span className="text-sm">{item.label}</span>}
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
              Salir
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
