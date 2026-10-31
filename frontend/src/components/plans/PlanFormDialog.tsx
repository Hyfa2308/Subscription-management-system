/**
 * REVORA – PlanFormDialog
 * Multi-section slide-over for creating and editing subscription plans.
 * Sections: Basic Info, Product Selection, Pricing, Billing,
 *           Trial, Permissions, Commitment, Status.
 */

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X, FileText, ShoppingBag, DollarSign, RefreshCw,
  Clock, Shield, Calendar, ToggleLeft,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { createPlan, updatePlan } from '@/services/planApi';
import { getProducts } from '@/services/productApi';
import { getVariants } from '@/services/productApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { SubscriptionPlanDetail } from '@/types/plan';
import type { Product, ProductVariant } from '@/types/product';
import { BILLING_FREQUENCY_LABELS } from '@/types/plan';

// ── Zod schema ────────────────────────────────────────────────────────────────

const planSchema = z.object({
  plan_name:    z.string().min(2, 'Plan name must be at least 2 characters'),
  description:  z.string().optional().or(z.literal('')),

  product_id:   z.number().min(1, 'Select a product'),
  variant_id:   z.number().nullable().optional(),

  plan_price:     z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Price cannot be negative'),
  currency:       z.string().min(1).max(3),
  setup_fee:      z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Setup fee cannot be negative'),
  tax_percentage: z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100, 'Tax must be 0–100'),

  billing_frequency: z.enum(['daily','weekly','monthly','quarterly','half_yearly','yearly']),
  billing_interval:  z.number().min(1, 'Must be at least 1'),
  trial_period_days: z.number().min(0, 'Cannot be negative'),

  discount_allowed:      z.boolean(),
  pause_allowed:         z.boolean(),
  renewal_allowed:       z.boolean(),
  early_closure_allowed: z.boolean(),

  minimum_commitment_period: z.number().nullable().optional(),

  status: z.enum(['active', 'inactive']),
});

type PlanFormValues = z.infer<typeof planSchema>;

// ── Sub-components ────────────────────────────────────────────────────────────

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

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="form-label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint  && !error && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-150',
          checked ? 'bg-indigo-600' : 'bg-slate-200',
        )}
      >
        <span className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0',
        )} />
      </button>
    </label>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlanFormDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  plan?:        SubscriptionPlanDetail | null;
  onSuccess:    () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlanFormDialog({ open, onOpenChange, plan, onSuccess }: PlanFormDialogProps) {
  const { success, error: toastError } = useToast();
  const isEdit = Boolean(plan);

  const [products, setProducts]   = useState<Product[]>([]);
  const [variants, setVariants]   = useState<ProductVariant[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const {
    register, handleSubmit, reset, watch, setValue, control,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      plan_name: '', description: '',
      product_id: 0, variant_id: null,
      plan_price: '0.00', currency: 'INR', setup_fee: '0.00', tax_percentage: '18.00',
      billing_frequency: 'monthly', billing_interval: 1, trial_period_days: 0,
      discount_allowed: true, pause_allowed: true, renewal_allowed: true, early_closure_allowed: false,
      minimum_commitment_period: null,
      status: 'active',
    },
  });

  const watchedProductId = watch('product_id');

  // Load active products when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoadingProducts(true);
    getProducts({ is_active: 'true', limit: 100 })
      .then(r => setProducts(r.products))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [open]);

  // Load variants when product changes
  useEffect(() => {
    if (!watchedProductId || watchedProductId === 0) { setVariants([]); return; }
    getVariants(watchedProductId)
      .then(v => setVariants(v.filter(x => x.is_active)))
      .catch(() => setVariants([]));
    setValue('variant_id', null);
  }, [watchedProductId, setValue]);

  // Auto-fill plan price from selected product/variant
  useEffect(() => {
    const prod = products.find(p => p.id === watchedProductId);
    if (prod && !isEdit) {
      setValue('plan_price', prod.base_price);
      setValue('currency', prod.currency);
      setValue('tax_percentage', prod.tax_percentage);
    }
  }, [watchedProductId, products, isEdit, setValue]);

  // Populate for edit mode
  useEffect(() => {
    if (plan) {
      reset({
        plan_name:    plan.plan_name,
        description:  plan.description ?? '',
        product_id:   plan.product_id,
        variant_id:   plan.variant_id,
        plan_price:   plan.plan_price,
        currency:     plan.currency,
        setup_fee:    plan.setup_fee,
        tax_percentage: plan.tax_percentage,
        billing_frequency: plan.billing_frequency,
        billing_interval:  plan.billing_interval,
        trial_period_days: plan.trial_period_days,
        discount_allowed:      plan.discount_allowed,
        pause_allowed:         plan.pause_allowed,
        renewal_allowed:       plan.renewal_allowed,
        early_closure_allowed: plan.early_closure_allowed,
        minimum_commitment_period: plan.minimum_commitment_period,
        status: plan.status === 'archived' ? 'active' : plan.status,
      });
    } else {
      reset({
        plan_name: '', description: '',
        product_id: 0, variant_id: null,
        plan_price: '0.00', currency: 'INR', setup_fee: '0.00', tax_percentage: '18.00',
        billing_frequency: 'monthly', billing_interval: 1, trial_period_days: 0,
        discount_allowed: true, pause_allowed: true, renewal_allowed: true, early_closure_allowed: false,
        minimum_commitment_period: null, status: 'active',
      });
    }
  }, [plan, reset]);

  const onSubmit = async (values: PlanFormValues) => {
    try {
      const payload = {
        ...values,
        description: values.description || undefined,
        variant_id:  values.variant_id  || null,
        minimum_commitment_period: values.minimum_commitment_period || null,
      };
      if (isEdit && plan) {
        await updatePlan(plan.id, payload);
        success('Plan updated', `"${values.plan_name}" has been updated.`);
      } else {
        await createPlan(payload as any);
        success('Plan created', `"${values.plan_name}" has been created.`);
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 409)      toastError('Duplicate name', 'A plan with this name already exists.');
      else if (s === 400) toastError('Validation error', err?.response?.data?.detail ?? 'Invalid plan configuration.');
      else                toastError('Failed to save', getApiErrorMessage(err));
    }
  };

  const handleClose = () => { onOpenChange(false); reset(); };

  const selectedProduct = products.find(p => p.id === Number(watchedProductId));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col focus:outline-none overflow-hidden"
          style={{ animation: 'slideInRight 0.25s ease-out both' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 flex-shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                {isEdit ? 'Edit Subscription Plan' : 'Add Subscription Plan'}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500 mt-0.5">
                Configure billing, pricing, and subscription settings.
              </Dialog.Description>
            </div>
            <Dialog.Close onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Scrollable body */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-7" noValidate>

            {/* A – Basic Information */}
            <section>
              <SectionHeader icon={FileText} title="A – Basic Information" />
              <div className="space-y-4">
                <Field label="Plan Name" required error={errors.plan_name?.message}>
                  <input type="text" placeholder="e.g. Standard Monthly" className={cn('form-input', errors.plan_name && 'border-red-400')} {...register('plan_name')} />
                </Field>
                {isEdit && plan && (
                  <div>
                    <label className="form-label">Plan Code</label>
                    <input value={plan.plan_code} readOnly className="form-input bg-slate-50 text-slate-500 font-mono cursor-not-allowed" />
                  </div>
                )}
                <Field label="Description">
                  <textarea rows={2} placeholder="Optional description…" className="form-input resize-none" {...register('description')} />
                </Field>
              </div>
            </section>

            {/* B – Product Selection */}
            <section>
              <SectionHeader icon={ShoppingBag} title="B – Product Selection" />
              <div className="space-y-4">
                <Field label="Product" required error={errors.product_id?.message}>
                  <select
                    disabled={isEdit}
                    className={cn('form-input', isEdit && 'bg-slate-50 text-slate-500 cursor-not-allowed', errors.product_id && 'border-red-400')}
                    {...register('product_id', { valueAsNumber: true })}
                  >
                    <option value={0}>{loadingProducts ? 'Loading products…' : '— Select a product —'}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.product_name} ({p.currency} {Number(p.base_price).toLocaleString()})</option>
                    ))}
                  </select>
                  {isEdit && <p className="text-xs text-slate-400 mt-1">Product cannot be changed after creation.</p>}
                </Field>

                {variants.length > 0 && (
                  <Field label="Variant" hint="Optional — select a variant for variant-specific pricing">
                    <select className="form-input" {...register('variant_id', { valueAsNumber: true, setValueAs: v => v === 0 ? null : Number(v) })}>
                      <option value={0}>— No variant (use product base price) —</option>
                      {variants.map(v => (
                        <option key={v.id} value={v.id}>{v.variant_name} ({selectedProduct?.currency} {Number(v.final_price).toLocaleString()})</option>
                      ))}
                    </select>
                  </Field>
                )}

                {selectedProduct && (
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700 space-y-1">
                    <p><span className="font-semibold">Product:</span> {selectedProduct.product_name}</p>
                    <p><span className="font-semibold">Base price:</span> {selectedProduct.currency} {Number(selectedProduct.base_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
              </div>
            </section>

            {/* C – Pricing */}
            <section>
              <SectionHeader icon={DollarSign} title="C – Pricing Configuration" />
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Plan Price" required error={errors.plan_price?.message}>
                    <input type="number" step="0.01" min="0" className={cn('form-input', errors.plan_price && 'border-red-400')} {...register('plan_price')} />
                  </Field>
                  <Field label="Currency" required>
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
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Setup Fee" error={errors.setup_fee?.message}>
                    <input type="number" step="0.01" min="0" className="form-input" {...register('setup_fee')} />
                  </Field>
                  <Field label="Allow Discounts">
                    <Controller name="discount_allowed" control={control} render={({ field }) => (
                      <div className="form-input flex items-center gap-2 cursor-pointer" onClick={() => field.onChange(!field.value)}>
                        <input type="checkbox" checked={field.value} readOnly className="w-4 h-4 accent-indigo-600" />
                        <span className="text-sm text-slate-600">{field.value ? 'Allowed' : 'Not allowed'}</span>
                      </div>
                    )} />
                  </Field>
                </div>
              </div>
            </section>

            {/* D – Billing */}
            <section>
              <SectionHeader icon={RefreshCw} title="D – Billing Configuration" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Billing Frequency" required error={errors.billing_frequency?.message}>
                  <select className="form-input" {...register('billing_frequency')}>
                    {Object.entries(BILLING_FREQUENCY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Billing Interval" required error={errors.billing_interval?.message} hint="e.g. 2 = every 2 months">
                  <input type="number" min="1" step="1" className={cn('form-input', errors.billing_interval && 'border-red-400')} {...register('billing_interval', { valueAsNumber: true })} />
                </Field>
              </div>
            </section>

            {/* E – Trial */}
            <section>
              <SectionHeader icon={Clock} title="E – Trial Configuration" />
              <Field label="Trial Period (days)" hint="Set to 0 for no trial">
                <input type="number" min="0" step="1" className="form-input" {...register('trial_period_days', { valueAsNumber: true })} />
              </Field>
            </section>

            {/* F – Permissions */}
            <section>
              <SectionHeader icon={Shield} title="F – Subscription Permissions" />
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
                <Controller name="pause_allowed"         control={control} render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Allow Pause" />} />
                <Controller name="renewal_allowed"       control={control} render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Allow Renewal" />} />
                <Controller name="early_closure_allowed" control={control} render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Allow Early Closure" />} />
              </div>
            </section>

            {/* G – Commitment */}
            <section>
              <SectionHeader icon={Calendar} title="G – Commitment" />
              <Field label="Minimum Commitment Period (months)" hint="Leave blank for no commitment requirement">
                <input type="number" min="1" step="1" placeholder="e.g. 12" className="form-input" {...register('minimum_commitment_period', { valueAsNumber: true, setValueAs: v => v === '' || isNaN(v) ? null : Number(v) })} />
              </Field>
            </section>

            {/* H – Status */}
            <section>
              <SectionHeader icon={ToggleLeft} title="H – Status" />
              <div className="flex gap-4">
                {(['active', 'inactive'] as const).map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value={s} className="accent-indigo-600" {...register('status')} />
                    <span className="text-sm capitalize text-slate-700">{s}</span>
                  </label>
                ))}
              </div>
            </section>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-slate-50">
            <Button variant="secondary" size="sm" type="button" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" size="sm" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              {isEdit ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
