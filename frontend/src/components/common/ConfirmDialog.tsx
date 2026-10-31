/**
 * REVORA – ConfirmDialog
 * Modal dialog for destructive action confirmation.
 * Uses @radix-ui/react-dialog.
 */

import React, { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  trigger?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'danger',
  loading,
  onConfirm,
  trigger,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}

      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />

        {/* Content */}
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-md bg-white rounded-xl shadow-[var(--shadow-modal)] p-6',
            'focus:outline-none data-[state=open]:animate-fade-in',
          )}
        >
          {/* Close */}
          <Dialog.Close className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </Dialog.Close>

          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-4">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              variant === 'danger' ? 'bg-red-100' : 'bg-indigo-100',
            )}>
              <AlertTriangle className={cn(
                'w-5 h-5',
                variant === 'danger' ? 'text-red-600' : 'text-indigo-600',
              )} />
            </div>
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">{title}</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500 mt-1 leading-relaxed">{description}</Dialog.Description>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <Button variant="secondary" size="sm">{cancelLabel}</Button>
            </Dialog.Close>
            <Button
              variant={variant}
              size="sm"
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
