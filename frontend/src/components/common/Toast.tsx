/**
 * REVORA – Toast notification system.
 * Lightweight, accessible toast using a React context + portal.
 * No external library needed.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useReducer, useRef,
  type ReactNode,
} from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/utils/cn';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id:       string;
  variant:  ToastVariant;
  title:    string;
  message?: string;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
}

type ToastAction =
  | { type: 'ADD';    toast: ToastItem }
  | { type: 'REMOVE'; id: string };

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      return { toasts: [action.toast, ...state.toasts].slice(0, 5) };
    case 'REMOVE':
      return { toasts: state.toasts.filter(t => t.id !== action.id) };
    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────────

interface ToastContextValue {
  toast: (variant: ToastVariant, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error:   (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info:    (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Single Toast ───────────────────────────────────────────────────────────────

function Toast({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => onRemove(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onRemove]);

  const icons: Record<ToastVariant, React.ElementType> = {
    success: CheckCircle2,
    error:   XCircle,
    warning: AlertTriangle,
    info:    Info,
  };
  const styles: Record<ToastVariant, { wrapper: string; icon: string }> = {
    success: { wrapper: 'border-emerald-200 bg-white',   icon: 'text-emerald-600' },
    error:   { wrapper: 'border-red-200   bg-white',     icon: 'text-red-600'     },
    warning: { wrapper: 'border-amber-200 bg-white',     icon: 'text-amber-600'   },
    info:    { wrapper: 'border-indigo-200 bg-white',    icon: 'text-indigo-600'  },
  };
  const barColors: Record<ToastVariant, string> = {
    success: 'bg-emerald-500', error: 'bg-red-500',
    warning: 'bg-amber-500',   info:  'bg-indigo-500',
  };

  const Icon = icons[item.variant];
  const s    = styles[item.variant];

  return (
    <div className={cn(
      'relative w-80 rounded-xl border shadow-lg overflow-hidden animate-slide-in-left',
      s.wrapper,
    )}>
      {/* Progress bar */}
      <div
        className={cn('absolute top-0 left-0 h-0.5', barColors[item.variant])}
        style={{ animation: `shrinkWidth ${item.duration}ms linear forwards` }}
      />

      <div className="flex items-start gap-3 p-4">
        <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', s.icon)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          {item.message && (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.message}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });

  const remove = useCallback((id: string) => dispatch({ type: 'REMOVE', id }), []);

  const toast = useCallback((
    variant: ToastVariant, title: string, message?: string, duration = 4000,
  ) => {
    dispatch({
      type: 'ADD',
      toast: {
        id: `${Date.now()}-${Math.random()}`,
        variant, title, message, duration,
      },
    });
  }, []);

  const success = useCallback((t: string, m?: string) => toast('success', t, m), [toast]);
  const error   = useCallback((t: string, m?: string) => toast('error',   t, m, 5000), [toast]);
  const warning = useCallback((t: string, m?: string) => toast('warning', t, m), [toast]);
  const info    = useCallback((t: string, m?: string) => toast('info',    t, m), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast container – top-right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {state.toasts.map(item => (
          <div key={item.id} className="pointer-events-auto">
            <Toast item={item} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
