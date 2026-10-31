/**
 * REVORA – FilterDropdown
 * Reusable dropdown for filtering data by a set of options.
 */

import React, { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useClickOutside } from '@/hooks/useClickOutside';

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterDropdown({
  label,
  options,
  value,
  onChange,
  className,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null!);
  useClickOutside(ref, () => setOpen(false));

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 h-9 px-3 text-sm font-medium rounded-lg border',
          'bg-white border-slate-300 text-slate-700',
          'hover:bg-slate-50 hover:border-slate-400 transition-colors',
          open && 'border-indigo-400 ring-2 ring-indigo-100',
        )}
      >
        <span className="text-slate-500 text-xs">{label}:</span>
        <span>{selected?.label ?? 'All'}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[160px] bg-white border border-slate-200 rounded-lg shadow-lg z-40 py-1 animate-fade-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {opt.label}
              {value === opt.value && <Check className="w-3.5 h-3.5 text-indigo-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
