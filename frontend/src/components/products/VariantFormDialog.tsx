/**
 * REVORA – VariantFormDialog
 * Modal dialog for creating and editing product variants.
 * Shows calculated final price preview before submission.
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Layers } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { createVariant, updateVariant } from '@/services/productApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Product, ProductVariant } from '@/types/product';

// ── Schema ────────────────────────────────────────────────────────────────────

const variantSchema = z.object({
  variant_name:     z.string().min(1, 'Variant name is required'),
  description:      z.string().optional().or(z.literal('')),
  price_adjustment: z.string().refine(v => !isNaN(Number(v)), 'Must be a number'),
  is_active:        z.boolean(),
});

type VariantFormValues = z.infer<typeof variantSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface VariantFormDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  product:      Product;
  variant?:     ProductVariant | null;
  onSuccess:    () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VariantFormDialog({
  open, onOpenChange, product, variant, onSuccess,
}: VariantFormDialogProps) {
  const { success, error: toastError } = useToast();
  const isEdit = Boolean(variant);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<VariantFormValues>({
      resolver: zodResolver(variantSchema),
      defaultValues: {
        variant_name: '', description: '',
        price_adjustment: '0.00', is_active: true,
      },
    });

  useEffect(() => {
    if (variant) {
      reset({
        variant_name:     variant.variant_name,
        description:      variant.description ?? '',
        price_adjustment: variant.price_adjustment,
        is_active:        variant.is_active,
      });
    } else {
      reset({ variant_name: '', description: '', price_adjustment: '0.00', is_active: true });
    }
  }, [variant, reset]);

  // Live preview of final price
  const priceAdjStr   = watch('price_adjustment');
  const priceAdj      = isNaN(Number(priceAdjStr)) ? 0 : Number(priceAdjStr);
  const basePrice     = Number(product.base_price);
  const previewFinal  = basePrice + priceAdj;
  const isNegative    = previewFinal < 0;

  const onSubmit = async (values: VariantFormValues) => {
    if (isNegative) {
      toastError('Invalid price', 'Final price cannot be negative.');
      return;
    }
    try {
      const payload = {
        variant_name:     values.variant_name,
        description:      values.description || undefined,
        price_adjustment: values.price_adjustment,
        is_active:        values.is_active,
      };
      if (isEdit && variant) {
        await updateVariant(product.id, variant.id, payload);
        success('Variant updated', `"${values.variant_name}" has been updated.`);
      } else {
        await createVariant(product.id, payload);
        success('Variant created', `"${values.variant_name}" has been added.`);
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toastError('Failed to save variant', getApiErrorMessage(err));
    }
  };

  const handleClose = () => { onOpenChange(false); reset(); };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-md bg-white rounded-2xl shadow-[var(--shadow-modal)]',
            'focus:outline-none data-[state=open]:animate-scale-in overflow-hidden',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                <Layers className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-semibold text-slate-900">
                  {isEdit ? 'Edit Variant' : 'Add Variant'}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400">
                  {product.product_name} · Base: {product.currency} {Number(product.base_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4" noValidate>
            <div>
              <label className="form-label">Variant Name <span className="text-red-500">*</span></label>
              <input
                type="text" placeholder="e.g. Standard, Premium, Enterprise"
                className={cn('form-input', errors.variant_name && 'border-red-400')}
                {...register('variant_name')}
              />
              {errors.variant_name && <p className="form-error">{errors.variant_name.message}</p>}
            </div>

            {isEdit && variant && (
              <div>
                <label className="form-label">Variant Code</label>
                <input type="text" value={variant.variant_code} readOnly className="form-input bg-slate-50 text-slate-500 font-mono cursor-not-allowed" />
              </div>
            )}

            <div>
              <label className="form-label">Description</label>
              <input type="text" placeholder="Optional description" className="form-input" {...register('description')} />
            </div>

            <div>
              <label className="form-label">
                Price Adjustment
                <span className="text-xs text-slate-400 font-normal ml-2">(negative = discount)</span>
              </label>
              <input
                type="number" step="0.01"
                className={cn('form-input', isNegative && 'border-red-400')}
                {...register('price_adjustment')}
              />

              {/* Final price preview */}
              <div className={cn(
                'mt-2 p-3 rounded-lg border text-sm flex items-center justify-between',
                isNegative ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200',
              )}>
                <span className="text-slate-500">Final price:</span>
                <span className={cn('font-bold', isNegative ? 'text-red-600' : 'text-slate-900')}>
                  {product.currency} {previewFinal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {isNegative && ' ⚠ Cannot be negative'}
                </span>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-indigo-600" {...register('is_active')} />
              <span className="text-sm text-slate-700">Active</span>
            </label>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <Button variant="secondary" size="sm" type="button" onClick={handleClose}>Cancel</Button>
            <Button
              variant="primary" size="sm" loading={isSubmitting}
              onClick={handleSubmit(onSubmit)}
              disabled={isNegative}
            >
              {isEdit ? 'Save Changes' : 'Add Variant'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
