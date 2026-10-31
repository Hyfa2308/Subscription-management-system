/**
 * REVORA – StatusBadge
 * Consistent badge/pill for status values across the application.
 */

import React from 'react';
import { cn } from '@/utils/cn';
import type { BadgeVariant } from '@/types';

interface StatusBadgeProps {
  variant?: BadgeVariant;
  label: string;
  dot?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  warning: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  danger:  'bg-red-50    text-red-700    ring-1 ring-red-200',
  info:    'bg-blue-50   text-blue-700   ring-1 ring-blue-200',
  neutral: 'bg-slate-100 text-slate-600  ring-1 ring-slate-200',
  indigo:  'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  teal:    'bg-teal-50   text-teal-700   ring-1 ring-teal-200',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-slate-400',
  indigo:  'bg-indigo-500',
  teal:    'bg-teal-500',
};

export function StatusBadge({ variant = 'neutral', label, dot = true, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', DOT_CLASSES[variant])} />
      )}
      {label}
    </span>
  );
}
