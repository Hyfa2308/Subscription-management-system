/**
 * REVORA – Buttons
 * Typed primary, secondary, danger, and ghost button components.
 */

import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ButtonVariant, ButtonSize } from '@/types';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ElementType;
  rightIcon?: React.ElementType;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:   'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 focus:ring-slate-400',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm',
  ghost:     'text-slate-600 hover:bg-slate-100 focus:ring-slate-300',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm:   'px-3 py-1.5 text-xs gap-1.5',
  md:   'px-4 py-2 text-sm gap-2',
  lg:   'px-5 py-2.5 text-sm gap-2',
  icon: 'p-2 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      className,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg',
        'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : LeftIcon ? (
        <LeftIcon className="w-3.5 h-3.5 flex-shrink-0" />
      ) : null}
      {children}
      {!loading && RightIcon && <RightIcon className="w-3.5 h-3.5 flex-shrink-0" />}
    </button>
  ),
);
Button.displayName = 'Button';

// Convenience aliases
export const PrimaryButton   = (p: ButtonProps) => <Button variant="primary"   {...p} />;
export const SecondaryButton = (p: ButtonProps) => <Button variant="secondary" {...p} />;
export const DangerButton    = (p: ButtonProps) => <Button variant="danger"    {...p} />;
export const GhostButton     = (p: ButtonProps) => <Button variant="ghost"     {...p} />;
