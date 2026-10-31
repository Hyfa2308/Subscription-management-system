/**
 * REVORA – PageHeader
 * Reusable page header with title, description, optional breadcrumbs and actions.
 */

import React, { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight truncate">{title}</h1>
        {description && (
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        )}
        {children}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
}
