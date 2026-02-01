import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface AnalyticsCardProps {
  title: string
  value: string | number
  change?: string
  changePercent?: number
  trend?: 'up' | 'down' | 'neutral'
  icon?: ReactNode
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'orange'
  subtitle?: string
}

export function AnalyticsCard({
  title,
  value,
  change,
  changePercent,
  trend = 'neutral',
  icon,
  color = 'blue',
  subtitle,
}: AnalyticsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
  }

  const trendIcon = trend === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'

  return (
    <div className={`border ${colorClasses[color]} rounded-lg p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase opacity-75">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
          {subtitle && <p className="text-xs opacity-75 mt-1">{subtitle}</p>}
          {change && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-xs font-medium ${trendColor}`}>
                {trend !== 'neutral' && trendIcon}
              </span>
              <span className={`text-xs font-medium ${trendColor}`}>{change}</span>
            </div>
          )}
        </div>
        {icon && <div className="flex-shrink-0 opacity-50">{icon}</div>}
      </div>
      {changePercent !== undefined && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <p className="text-xs opacity-75">
            {changePercent > 0 ? '+' : ''}{changePercent}% vs. período anterior
          </p>
        </div>
      )}
    </div>
  )
}
