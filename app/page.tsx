'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

const features = [
  { icon: '🤖', title: 'Agentes IA 24/7', desc: 'Respuestas inteligentes con conocimiento de tu negocio' },
  { icon: '💬', title: 'WhatsApp Business', desc: 'Conexión oficial y estable con Evolution API' },
  { icon: '👥', title: 'CRM Visual', desc: 'Pipeline de ventas tipo Kanban con drag & drop' },
  { icon: '📣', title: 'Campañas Masivas', desc: 'Broadcast con templates y programación' },
  { icon: '🔗', title: 'Integración Odoo', desc: 'Sincroniza contactos, productos y pedidos' },
  { icon: '📊', title: 'Reportes', desc: 'Métricas de rendimiento en tiempo real' },
]

const plans = [
  { name: 'Starter', price: 99, agents: 1, users: 2, messages: 500, features: ['WhatsApp', 'CRM Básico'] },
  { name: 'Pro', price: 199, agents: 3, users: 5, messages: 2000, features: ['WhatsApp', 'Telegram', 'Email', 'CRM Avanzado', 'Campañas'], popular: true },
  { name: 'Business', price: 349, agents: 10, users: 15, messages: 10000, features: ['Todo en Pro', 'Instagram/FB', 'Odoo', 'Voz Clonada', 'API Access'] },
]

export default function LandingPage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(res => {
      if (res.ok) setIsLoggedIn(true)
    })
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-secondary)]/80 backdrop-blur-lg border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="text-xl font-bold text-[var(--text-primary)]">NipponFlex AI</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isLoggedIn ? (
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                Ir al Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push('/login')}
                  className="px-4 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg font-medium transition-colors"
                >
                  Iniciar Sesión
                </button>
                <button
                  onClick={() => router.push('/registro')}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                  Comenzar Gratis
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-500 text-sm font-medium mb-6">
            <span>🚀</span> Plataforma #1 en automatización para LATAM
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-[var(--text-primary)] mb-6">
            Automatiza tu negocio con{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600">
              Inteligencia Artificial
            </span>
          </h1>
          <p className="text-xl text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto">
            Agentes IA que responden 24/7 en WhatsApp, CRM visual con pipeline de ventas, 
            campañas masivas y mucho más. Todo integrado con Odoo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/registro')}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-lg transition-colors shadow-lg shadow-green-500/30"
            >
              Comenzar Prueba Gratis →
            </button>
            <button
              onClick={() => router.push('#demo')}
              className="px-8 py-4 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-xl font-semibold text-lg transition-colors"
            >
              Ver Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-[var(--bg-secondary)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[var(--text-primary)] mb-4">
            Todo lo que necesitas para automatizar
          </h2>
          <p className="text-center text-[var(--text-secondary)] mb-12 max-w-2xl mx-auto">
            Una plataforma completa que integra comunicación, ventas y automatización con IA
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-green-500/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{feature.title}</h3>
                <p className="text-[var(--text-secondary)]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[var(--text-primary)] mb-4">
            Planes para cada negocio
          </h2>
          <p className="text-center text-[var(--text-secondary)] mb-12">
            Precios accesibles para el mercado latinoamericano
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`p-6 rounded-xl border ${
                  plan.popular
                    ? 'border-green-500 bg-green-500/5 relative'
                    : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                    Más Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-[var(--text-primary)]">${plan.price}</span>
                  <span className="text-[var(--text-muted)]">/mes</span>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-green-500">✓</span> {plan.agents} Agente{plan.agents > 1 ? 's' : ''} IA
                  </li>
                  <li className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-green-500">✓</span> {plan.users} Usuarios
                  </li>
                  <li className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-green-500">✓</span> {plan.messages.toLocaleString()} mensajes/mes
                  </li>
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="text-green-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => router.push('/registro')}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    plan.popular
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  }`}
                >
                  Comenzar
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-green-500 to-emerald-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            ¿Listo para automatizar tu negocio?
          </h2>
          <p className="text-white/80 mb-8">
            Únete a cientos de empresas que ya usan NipponFlex AI para crecer sus ventas
          </p>
          <button
            onClick={() => router.push('/registro')}
            className="px-8 py-4 bg-white hover:bg-gray-100 text-green-600 rounded-xl font-semibold text-lg transition-colors"
          >
            Comenzar Prueba Gratis de 14 Días
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">N</span>
              </div>
              <span className="font-semibold text-[var(--text-primary)]">NipponFlex AI</span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              © 2024 NipponFlex AI. Desarrollado por Tecni Support PC - Quito, Ecuador
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
