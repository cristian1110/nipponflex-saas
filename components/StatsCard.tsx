'use client'

interface StatsCardProps {
  title: string
  value: string | number
  icon: string
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'pink'
  trend?: {
    value: number
    label: string
  }
  onClick?: () => void
}

const colorClasses = {
  blue: 'bg-blue-500/20 text-blue-500',
  green: 'bg-green-500/20 text-green-500',
  purple: 'bg-purple-500/20 text-purple-500',
  orange: 'bg-orange-500/20 text-orange-500',
  red: 'bg-red-500/20 text-red-500',
  pink: 'bg-pink-500/20 text-pink-500',
}

export default function StatsCard({ title, value, icon, color = 'blue', trend, onClick }: StatsCardProps) {
  const Component = onClick ? 'button' : 'div'
  
  return (
    <Component
      onClick={onClick}
      className={`bg-[var(--card-bg)] rounded-xl p-5 border border-[var(--border-color)] ${onClick ? 'hover:border-green-500/50 cursor-pointer transition-all' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-muted)]">{title}</p>
          <p className={`text-3xl font-bold ${color === 'blue' ? 'text-[var(--text-primary)]' : `text-${color}-500`}`}>
            {value}
          </p>
          {trend && (
            <p className={`text-xs mt-1 ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </Component>
  )
}
