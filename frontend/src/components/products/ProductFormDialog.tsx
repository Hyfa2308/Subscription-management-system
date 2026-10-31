/**
 * REVORA – ProductFormDialog
 * Slide-over sheet for creating and editing products.
 * Sections: Basic Information, Configuration, Status.
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Package, Settings2, ToggleLeft } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { createProduct, updateProduct } from '@/services/productApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Product } from '@/types/product';

// ── Validation schema ─────────────────────────────────────────────────────────

const productSchema = z.object({
  product_name:   z.string().min(2, 'Product name must be at least 2 characters'),
  description:    z.string().optional().or(z.literal('')),
  category:       z.string().optional().or(z.literal('')),
  product_type:   z.enum(['one_time', 'subscription']),
  billing_type:   z.enum(['one_time', 'recurring']),
  base_price:     z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Price cannot be negative'),
  currency:       z.string().min(1).max(3),
  tax_percentage: z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100, 'Tax must be 0–100'),
  is_active:      z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProductFormDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  product?:     Product | null;
  onSuccess:    () => void;
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-indigo-600" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="form-label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductFormDialog({ open, onOpenChange, product, onSuccess }: ProductFormDialogProps) {
  const { success, error: toastError } = useToast();
  const isEdit = Boolean(product);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      product_name: '', description: '', category: '',
      product_type: 'subscription', billing_type: 'recurring',
      base_price: '0.00', currency: 'INR', tax_percentage: '18.00',
      is_active: true,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        product_name:   product.product_name,
        description:    product.description    ?? '',
        category:       product.category       ?? '',
        product_type:   product.product_type,
        billing_type:   product.billing_type,
        base_price:     product.base_price,
        currency:       product.currency,
        tax_percentage: product.tax_percentage,
        is_active:      product.is_active,
      });
    } else {
      reset({
        product_name: '', description: '', category: '',
        product_type: 'subscription', billing_type: 'recurring',
        base_price: '0.00', currency: 'INR', tax_percentage: '18.00',
        is_active: true,
      });
    }
  }, [product, reset]);

  const onSubmit = async (values: ProductFormValues) => {
    try {
      const payload = {
        ...values,
        description: values.description || undefined,
        category:    values.category    || undefined,
      };
      if (isEdit && product) {
        await updateProduct(product.id, payload);
        success('Product updated', `"${values.product_name}" has been updated.`);
      } else {
        await createProduct(payload);
        success('Product created', `"${values.product_name}" has been added.`);
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 409) toastError('Duplicate name', 'A product with this name already exists.');
      else toastError('Failed to save', getApiErrorMessage(err));
    }
  };

  const handleClose = () => { onOpenChange(false); reset(); };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col focus:outline-none overflow-hidden"
          style={{ animation: 'slideInRight 0.25s ease-out both' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                {isEdit ? 'Edit Product' : 'Add Product'}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500 mt-0.5">
                {isEdit ? 'Update product information and pricing.' : 'Fill in the details to add a new product.'}
              </Dialog.Description>
            </div>
            <Dialog.Close onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6" noValidate>

            {/* Basic Information */}
            <section>
              <SectionHeader icon={Package} title="Basic Information" />
              <div className="space-y-4">
                <Field label="Product Name" required error={errors.product_name?.message}>
                  <input type="text" placeholder="e.g. Cloud Storage Pro" className={cn('form-input', errors.product_name && 'border-red-400')} {...register('product_name')} />
                </Field>
                {isEdit && product && (
                  <div>
                    <label className="form-label">Product Code</label>
                    <input type="text" value={product.product_code} readOnly className="form-input bg-slate-50 text-slate-500 font-mono cursor-not-allowed" />
                    <p className="text-xs text-slate-400 mt-1">Product code cannot be changed after creation.</p>
                  </div>
                )}
                <Field label="Description" error={errors.description?.message}>
                  <textarea rows={3} placeholder="Short description…" className="form-input resize-none" {...register('description')} />
                </Field>
                <Field label="Category" error={errors.category?.message}>
                  <input type="text" placeholder="e.g. Cloud, SaaS, Security" className="form-input" {...register('category')} />
                </Field>
              </div>
            </section>

            {/* Configuration */}
            <section>
              <SectionHeader icon={Settings2} title="Product Configuration" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Product Type" required error={errors.product_type?.message}>
                    <select className="form-input" {...register('product_type')}>
                      <option value="subscription">Subscription</option>
                      <option value="one_time">One-time</option>
                    </select>
                  </Field>
                  <Field label="Billing Type" required error={errors.billing_type?.message}>
                    <select className="form-input" {...register('billing_type')}>
                      <option value="recurring">Recurring</option>
                      <option value="one_time">One-time</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Base Price" required error={errors.base_price?.message}>
                    <input type="number" step="0.01" min="0" className={cn('form-input', errors.base_price && 'border-red-400')} {...register('base_price')} />
                  </Field>
                  <Field label="Currency" required error={errors.currency?.message}>
                    <select className="form-input" {...register('currency')}>
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </Field>
                  <Field label="Tax %" error={errors.tax_percentage?.message}>
                    <input type="number" step="0.01" min="0" max="100" className="form-input" {...register('tax_percentage')} />
                  </Field>
                </div>
              </div>
            </section>

            {/* Status */}
            <section>
              <SectionHeader icon={ToggleLeft} title="Status" />
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-indigo-600" {...register('is_active')} />
                <span className="text-sm text-slate-700">Active (visible and available for subscriptions)</span>
              </label>
            </section>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-slate-50">
            <Button variant="secondary" size="sm" type="button" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" size="sm" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              {isEdit ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
