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
  { href: '/crm', icon: '👥', label: 'CRM / Leads', minLevel: 2 },
  { href: '/conversaciones', icon: '💬', label: 'Conversaciones', minLevel: 2 },
  { href: '/calendario', icon: '📅', label: 'Calendario', minLevel: 2 },
  { href: '/agentes', icon: '🤖', label: 'Agentes IA', minLevel: 3 },
  { href: '/conocimientos', icon: '📚', label: 'Base de Conocimientos', minLevel: 3 },
  { href: '/campanas', icon: '📣', label: 'Campañas', minLevel: 3 },
  { href: '/automatizaciones', icon: '⚡', label: 'Automatizaciones', minLevel: 3 },
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
    <aside className={`h-screen bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] transition-all duration-300 flex-shrink-0 flex flex-col ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-[var(--sidebar-text)]">NipponFlex</h1>
              <p className="text-xs text-[var(--text-muted)]">AI Platform</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <button
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-green-500/20 text-green-500'
                      : 'text-[var(--sidebar-text)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Usuario y acciones */}
      <div className="p-4 border-t border-[var(--border-color)]">
        {!collapsed && (
          <div className="mb-3">
            <p className="text-sm font-medium text-[var(--sidebar-text)] truncate">{user.nombre}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{user.cliente_nombre || user.rol}</p>
          </div>
        )}
        <div className={`flex ${collapsed ? 'flex-col' : ''} gap-2`}>
          <ThemeToggle className="flex-1" />
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
            title="Cerrar sesión"
          >
            {collapsed ? '🚪' : 'Salir'}
          </button>
        </div>
      </div>
    </aside>
  )
}
