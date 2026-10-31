/**
 * REVORA – FormField
 * Reusable label + input + error/hint wrapper for forms.
 */

import React, { ReactNode, InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children?: ReactNode;
}

export function FormField({ id, label, error, hint, required, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="form-error">{error}</p>}
      {hint && !error && <p className="form-hint">{hint}</p>}
    </div>
  );
}

// ── Input ──────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'form-input',
        error && 'border-red-400 focus:ring-red-400',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

// ── Textarea ───────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={3}
      className={cn(
        'form-input resize-y',
        error && 'border-red-400 focus:ring-red-400',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
