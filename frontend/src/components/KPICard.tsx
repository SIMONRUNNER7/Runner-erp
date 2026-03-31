import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'cyan';
  loading?: boolean;
}

const colorConfig = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', value: 'text-blue-700' },
  green: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600', value: 'text-green-700' },
  yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600', value: 'text-yellow-700' },
  red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', value: 'text-red-700' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', value: 'text-purple-700' },
  cyan: { bg: 'bg-cyan-50', icon: 'bg-cyan-100 text-cyan-600', value: 'text-cyan-700' },
};

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  color = 'blue',
  loading = false,
}: KPICardProps) {
  const colors = colorConfig[color];

  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        </div>
        <div className="h-8 bg-gray-200 rounded w-32 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-20" />
      </div>
    );
  }

  return (
    <div className={clsx('card p-6', colors.bg)}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', colors.icon)}>
          <Icon size={20} />
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className={clsx('text-2xl font-bold', colors.value)}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>

        {trend !== undefined && (
          <div
            className={clsx(
              'flex items-center gap-1 text-xs font-medium',
              trend >= 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>
              {trend >= 0 ? '+' : ''}
              {trend.toFixed(1)}%
            </span>
            {trendLabel && <span className="text-gray-400 font-normal">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
