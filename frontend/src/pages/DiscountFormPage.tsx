/**
 * REVORA – DiscountFormPage
 * Route: /discounts/new and /discounts/:id/edit
 * 6-section form: basic, configuration, validity, usage, applicability, status.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Info, Tag, Calendar, Users, Layers, ToggleLeft, Save,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { getDiscountById, createDiscount, updateDiscount } from '@/services/discountApi';
import { getProducts } from '@/services/productApi';
import { getPlans } from '@/services/planApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type { DiscountCreateRequest, DiscountApplicableTo } from '@/types/discount';

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-indigo-600" />
      </div>
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button type="button" onClick={() => onChange(!checked)}
        className={cn('w-9 h-5 rounded-full transition-colors relative flex-shrink-0',
          checked ? 'bg-indigo-600' : 'bg-slate-200')}>
        <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0')} />
      </button>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

export default function DiscountFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const { success, error: te } = useToast();

  const [loading,    setLoading]    = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [products,   setProducts]   = useState<any[]>([]);
  const [plans,      setPlans]      = useState<any[]>([]);

  // A – Basic
  const [name,        setName]        = useState('');
  const [code,        setCode]        = useState('');
  const [description, setDescription] = useState('');

  // B – Config
  const [discountType,    setDiscountType]    = useState<'percentage' | 'fixed_amount'>('percentage');
  const [discountValue,   setDiscountValue]   = useState('');
  const [currency,        setCurrency]        = useState('INR');
  const [maxDiscount,     setMaxDiscount]     = useState('');
  const [minPurchase,     setMinPurchase]     = useState('');

  // C – Validity
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');

  // D – Usage
  const [usageLimit,    setUsageLimit]    = useState('');
  const [custLimit,     setCustLimit]     = useState('');
  const [isStackable,   setIsStackable]   = useState(false);
  const [requiresCoupon,setRequiresCoupon]= useState(true);

  // E – Applicability
  const [applicableTo, setApplicableTo]     = useState<DiscountApplicableTo>('all');
  const [selProducts,  setSelProducts]      = useState<number[]>([]);
  const [selPlans,     setSelPlans]         = useState<number[]>([]);

  // F – Status
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing discount for edit
  useEffect(() => {
    if (isEdit) {
      getDiscountById(Number(id)).then(d => {
        setName(d.discount_name);
        setCode(d.discount_code);
        setDescription(d.description || '');
        setDiscountType(d.discount_type);
        setDiscountValue(d.discount_value);
        setCurrency(d.currency);
        setMaxDiscount(d.maximum_discount_amount || '');
        setMinPurchase(d.minimum_purchase_amount || '');
        setStartDate(d.start_date.split('T')[0]);
        setEndDate(d.end_date ? d.end_date.split('T')[0] : '');
        setUsageLimit(d.usage_limit != null ? String(d.usage_limit) : '');
        setCustLimit(d.usage_limit_per_customer != null ? String(d.usage_limit_per_customer) : '');
        setIsStackable(d.is_stackable);
        setRequiresCoupon(d.requires_coupon_code);
        setApplicableTo(d.applicable_to);
        setSelProducts(d.applicable_product_ids || []);
        setSelPlans(d.applicable_plan_ids || []);
        setStatus(d.status === 'inactive' ? 'inactive' : 'active');
        setLoading(false);
      }).catch(() => { te('Error', 'Failed to load discount.'); navigate('/discounts'); });
    }
    getProducts({ is_active: 'true', limit: 200 }).then(r => setProducts(r.products)).catch(() => {});
    getPlans({ status: 'active', limit: 200 }).then(r => setPlans(r.plans)).catch(() => {});
  }, [id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())     e.name = 'Discount name is required.';
    if (!discountValue || Number(discountValue) <= 0) e.value = 'Discount value must be greater than zero.';
    if (discountType === 'percentage' && Number(discountValue) > 100) e.value = 'Percentage cannot exceed 100%.';
    if (!startDate)       e.startDate = 'Start date is required.';
    if (endDate && endDate < startDate) e.endDate = 'End date must be after start date.';
    if (maxDiscount && Number(maxDiscount) < 0) e.maxDiscount = 'Cannot be negative.';
    if (minPurchase && Number(minPurchase) < 0) e.minPurchase = 'Cannot be negative.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload: DiscountCreateRequest = {
        discount_name:            name.trim(),
        discount_code:            code.trim() || undefined,
        description:              description.trim() || undefined,
        discount_type:            discountType,
        discount_value:           discountValue,
        currency,
        maximum_discount_amount:  maxDiscount || undefined,
        minimum_purchase_amount:  minPurchase || undefined,
        start_date:               new Date(startDate).toISOString(),
        end_date:                 endDate ? new Date(endDate).toISOString() : undefined,
        usage_limit:              usageLimit ? Number(usageLimit) : undefined,
        usage_limit_per_customer: custLimit  ? Number(custLimit)  : undefined,
        applicable_to:            applicableTo,
        applicable_product_ids:   applicableTo === 'products'           ? selProducts : undefined,
        applicable_plan_ids:      applicableTo === 'subscription_plans' ? selPlans    : undefined,
        is_stackable:             isStackable,
        requires_coupon_code:     requiresCoupon,
        status,
      };

      if (isEdit) {
        await updateDiscount(Number(id), payload as any);
        success('Updated', 'Discount updated successfully.');
        navigate(`/discounts/${id}`);
      } else {
        const d = await createDiscount(payload);
        success('Created', `Discount ${d.discount_code} created.`);
        navigate(`/discounts/${d.id}`);
      }
    } catch (err: any) { te('Failed', getApiErrorMessage(err)); }
    finally { setSubmitting(false); }
  };

  const toggleProduct = (pid: number) =>
    setSelProducts(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]);

  const togglePlan = (pid: number) =>
    setSelPlans(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card p-5"><div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" /></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div>
        <Link to="/discounts" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeft className="w-4 h-4" /> Discounts
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">{isEdit ? 'Edit Discount' : 'Create Discount'}</h1>
          <Button variant="primary" size="sm" leftIcon={Save} onClick={handleSubmit} loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Discount'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* A – Basic */}
        <div className="card p-5">
          <SectionHeader icon={Info} title="A – Basic Information" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Discount Name" required error={errors.name}>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Summer Sale 20%" className={cn('form-input', errors.name && 'border-red-400')} />
            </Field>
            <Field label="Discount Code" error={errors.code}>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Auto-generated if empty" className="form-input font-mono" />
            </Field>
            <div className="col-span-2">
              <Field label="Description">
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Optional description" className="form-input resize-none" />
              </Field>
            </div>
          </div>
        </div>

        {/* B – Config */}
        <div className="card p-5">
          <SectionHeader icon={Tag} title="B – Discount Configuration" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Discount Type" required>
              <div className="grid grid-cols-2 gap-2">
                {(['percentage', 'fixed_amount'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setDiscountType(t)}
                    className={cn('p-2.5 rounded-lg border-2 text-sm font-medium transition-all',
                      discountType === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                    {t === 'percentage' ? 'Percentage (%)' : 'Fixed Amount'}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Discount Value" required error={errors.value}>
              <div className="relative">
                <input type="number" min="0" max={discountType === 'percentage' ? '100' : undefined}
                  step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? '0–100' : '0.00'}
                  className={cn('form-input pr-10', errors.value && 'border-red-400')} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  {discountType === 'percentage' ? '%' : currency}
                </span>
              </div>
            </Field>
            {discountType === 'fixed_amount' && (
              <Field label="Currency">
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="form-input">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </Field>
            )}
            <Field label="Maximum Discount Amount (optional)" error={errors.maxDiscount}>
              <input type="number" min="0" step="0.01" value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)}
                placeholder="Leave empty for no cap" className={cn('form-input', errors.maxDiscount && 'border-red-400')} />
            </Field>
            <Field label="Minimum Purchase Amount (optional)" error={errors.minPurchase}>
              <input type="number" min="0" step="0.01" value={minPurchase} onChange={e => setMinPurchase(e.target.value)}
                placeholder="Leave empty for no minimum" className={cn('form-input', errors.minPurchase && 'border-red-400')} />
            </Field>
          </div>
        </div>

        {/* C – Validity */}
        <div className="card p-5">
          <SectionHeader icon={Calendar} title="C – Validity Period" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" required error={errors.startDate}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className={cn('form-input', errors.startDate && 'border-red-400')} />
            </Field>
            <Field label="End Date" error={errors.endDate}>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className={cn('form-input', errors.endDate && 'border-red-400')} />
              {!endDate && <p className="text-xs text-slate-400 mt-1">Leave empty for no expiry.</p>}
            </Field>
          </div>
        </div>

        {/* D – Usage */}
        <div className="card p-5">
          <SectionHeader icon={Users} title="D – Usage Restrictions" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Global Usage Limit">
              <input type="number" min="0" value={usageLimit} onChange={e => setUsageLimit(e.target.value)}
                placeholder="Unlimited" className="form-input" />
            </Field>
            <Field label="Usage Limit Per Customer">
              <input type="number" min="0" value={custLimit} onChange={e => setCustLimit(e.target.value)}
                placeholder="Unlimited" className="form-input" />
            </Field>
          </div>
          <div className="space-y-3">
            <Toggle checked={isStackable}    onChange={setIsStackable}    label="Allow stacking with other discounts" />
            <Toggle checked={requiresCoupon} onChange={setRequiresCoupon} label="Require coupon code entry" />
          </div>
        </div>

        {/* E – Applicability */}
        <div className="card p-5">
          <SectionHeader icon={Layers} title="E – Applicability" />
          <div className="mb-4">
            <div className="flex gap-2 flex-wrap">
              {(['all','products','subscription_plans'] as DiscountApplicableTo[]).map(opt => (
                <button key={opt} type="button" onClick={() => setApplicableTo(opt)}
                  className={cn('px-3 py-1.5 rounded-lg border text-sm font-medium transition-all',
                    applicableTo === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                  {opt === 'all' ? 'All' : opt === 'products' ? 'Specific Products' : 'Specific Plans'}
                </button>
              ))}
            </div>
          </div>

          {applicableTo === 'products' && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Select applicable products (leave empty for all products):</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {products.map(p => (
                  <label key={p.id} className={cn('flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors',
                    selProducts.includes(p.id) ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50')}>
                    <input type="checkbox" checked={selProducts.includes(p.id)} onChange={() => toggleProduct(p.id)} className="rounded" />
                    <span className="text-xs text-slate-700">{p.product_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {applicableTo === 'subscription_plans' && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Select applicable plans (leave empty for all plans):</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {plans.map(p => (
                  <label key={p.id} className={cn('flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors',
                    selPlans.includes(p.id) ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50')}>
                    <input type="checkbox" checked={selPlans.includes(p.id)} onChange={() => togglePlan(p.id)} className="rounded" />
                    <span className="text-xs text-slate-700">{p.plan_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* F – Status */}
        <div className="card p-5">
          <SectionHeader icon={ToggleLeft} title="F – Status" />
          <div className="flex gap-3">
            {(['active','inactive'] as const).map(s => (
              <button key={s} type="button" onClick={() => setStatus(s)}
                className={cn('px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                  status === s
                    ? s === 'active' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-400 bg-slate-100 text-slate-600'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
                {s === 'active' ? '✓ Active' : '✗ Inactive'}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {status === 'active' ? 'Discount will be available immediately after creation.' : 'Discount will not be applied until activated.'}
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" size="sm" leftIcon={Save} onClick={handleSubmit} loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Discount'}
          </Button>
        </div>
      </div>
    </div>
  );
}
