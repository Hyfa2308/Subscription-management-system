/**
 * REVORA – MetricCard (StatCard)
 * KPI summary card for dashboard and analytics pages.
 */

import React, { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  trendLabel?: string;
  loading?: boolean;
  note?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-indigo-600',
  iconBg = 'bg-indigo-50',
  trend,
  trendValue,
  trendLabel,
  loading = false,
  note,
  className,
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'   ? 'text-emerald-600' :
    trend === 'down' ? 'text-red-600' :
    'text-slate-400';

  if (loading) {
    return (
      <div className={cn('card p-5 space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-28 bg-slate-200 rounded animate-pulse" />
          <div className="w-10 h-10 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="h-7 w-20 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className={cn('card card-hover p-5 flex flex-col gap-4', className)}>
      {/* Label + icon */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">
          {label}
        </p>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
      </div>

      {/* Value */}
      <p className="text-2xl font-bold text-slate-900 tracking-tight leading-none">{value}</p>

      {/* Trend / note */}
      <div className="flex items-center gap-1.5 min-h-[16px]">
        {trend && trendValue ? (
          <>
            <TrendIcon className={cn('w-3.5 h-3.5', trendColor)} />
            <span className={cn('text-xs font-semibold', trendColor)}>{trendValue}</span>
            {trendLabel && <span className="text-xs text-slate-400">{trendLabel}</span>}
          </>
        ) : note ? (
          <span className="text-xs text-slate-400 italic">{note}</span>
        ) : null}
      </div>
    </div>
  );
}
