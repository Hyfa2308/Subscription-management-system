/**
 * REVORA – SearchInput
 * Controlled search input with clear button and loading indicator.
 */

import React, { useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  id?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  loading,
  className,
  id,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('relative flex items-center', className)}>
      <div className="absolute left-3 pointer-events-none">
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
        ) : (
          <Search className="w-3.5 h-3.5 text-slate-400" />
        )}
      </div>
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'form-input pl-9 pr-8 h-9 text-sm',
          'w-full',
        )}
      />
      {value && (
        <button
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
