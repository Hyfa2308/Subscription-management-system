/**
 * REVORA – ChartContainer
 * Wrapper for Recharts charts with title, date filter, and empty/loading states.
 */

import React, { ReactNode } from 'react';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Skeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

interface ChartContainerProps {
  title: string;
  description?: string;
  children?: ReactNode;
  loading?: boolean;
  hasData?: boolean;
  className?: string;
  height?: number;
  action?: ReactNode;
}

export function ChartContainer({
  title,
  description,
  children,
  loading = false,
  hasData = false,
  className,
  height = 240,
  action,
}: ChartContainerProps) {
  return (
    <div className={cn('card flex flex-col', className)}>
      {/* Header */}
      <div className="card-header flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {/* Body */}
      <div className="flex-1 p-4" style={{ minHeight: height }}>
        {loading ? (
          <div className="h-full flex flex-col gap-2 pt-2" style={{ minHeight: height - 24 }}>
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ) : !hasData ? (
          <EmptyState
            icon={BarChart2}
            title="No data yet"
            description="Analytics will appear here once the backend integration is complete and data starts flowing."
            compact
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
