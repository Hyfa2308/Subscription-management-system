/**
 * REVORA – QuotationFormPage
 * Multi-section form for creating/editing a quotation.
 * Route: /quotations/new  and  /quotations/:id/edit
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Users, FileText,
  DollarSign, ClipboardList, Save, Send,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { getCustomers } from '@/services/customerApi';
import { getProducts, getVariants } from '@/services/productApi';
import { getPlans } from '@/services/planApi';
import { getTemplates } from '@/services/quotationTemplateApi';
import {
  createQuotation, updateQuotation, getQuotationById, sendQuotation,
} from '@/services/quotationApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type { QuotationItemCreate } from '@/types/quotation';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Line item row ──────────────────────────────────────────────────────────────

interface LineItemRowProps {
  index:       number;
  item:        QuotationItemCreate;
  products:    any[];
  onChange:    (index: number, field: keyof QuotationItemCreate, value: string | number | null) => void;
  onRemove:    (index: number) => void;
  basePrice:   string;
}

function LineItemRow({ index, item, products, onChange, onRemove }: LineItemRowProps) {
  const [variants, setVariants] = useState<any[]>([]);
  const [plans,    setPlans]    = useState<any[]>([]);

  useEffect(() => {
    if (item.product_id) {
      getVariants(Number(item.product_id)).then(v => setVariants(v.filter((x: any) => x.is_active))).catch(() => {});
      getPlans({ product_id: Number(item.product_id), status: 'active', limit: 100 })
        .then(r => setPlans(r.plans)).catch(() => {});
    } else {
      setVariants([]); setPlans([]);
    }
  }, [item.product_id]);

  // When product selected, auto-fill unit_price and description
  const handleProductChange = (productId: string) => {
    const prod = products.find(p => p.id === Number(productId));
    onChange(index, 'product_id', productId ? Number(productId) : null);
    onChange(index, 'variant_id', null);
    onChange(index, 'plan_id', null);
    if (prod) {
      if (!item.description) onChange(index, 'description', prod.product_name);
      onChange(index, 'unit_price', prod.base_price);
    }
  };

  const handleVariantChange = (variantId: string) => {
    const v = variants.find((x: any) => x.id === Number(variantId));
    onChange(index, 'variant_id', variantId ? Number(variantId) : null);
    if (v) onChange(index, 'unit_price', v.final_price);
  };

  const handlePlanChange = (planId: string) => {
    const p = plans.find((x: any) => x.id === Number(planId));
    onChange(index, 'plan_id', planId ? Number(planId) : null);
    if (p) onChange(index, 'unit_price', p.plan_price);
  };

  // Local line total preview
  const qty   = Number(item.quantity)            || 0;
  const up    = Number(item.unit_price)           || 0;
  const disc  = Number(item.discount_percentage)  || 0;
  const tax   = Number(item.tax_percentage)       || 0;
  const gross = qty * up;
  const discAmt = gross * (disc / 100);
  const afterDisc = gross - discAmt;
  const taxAmt = afterDisc * (tax / 100);
  const lineTotal = afterDisc + taxAmt;

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Item #{index + 1}</span>
        <button type="button" onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Product / Variant / Plan selection row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="form-label text-xs">Product</label>
          <select value={item.product_id || ''} onChange={e => handleProductChange(e.target.value)} className="form-input py-1.5 text-sm">
            <option value="">— Select product —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label text-xs">Variant</label>
          <select value={item.variant_id || ''} onChange={e => handleVariantChange(e.target.value)} className="form-input py-1.5 text-sm" disabled={!variants.length}>
            <option value="">— None —</option>
            {variants.map((v: any) => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label text-xs">Plan</label>
          <select value={item.plan_id || ''} onChange={e => handlePlanChange(e.target.value)} className="form-input py-1.5 text-sm" disabled={!plans.length}>
            <option value="">— None —</option>
            {plans.map((p: any) => <option key={p.id} value={p.id}>{p.plan_name}</option>)}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="form-label text-xs">Description <span className="text-red-500">*</span></label>
        <input type="text" value={item.description} onChange={e => onChange(index, 'description', e.target.value)}
          placeholder="Item description" className="form-input py-1.5 text-sm" />
      </div>

      {/* Pricing row */}
      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-1">
          <label className="form-label text-xs">Qty <span className="text-red-500">*</span></label>
          <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => onChange(index, 'quantity', e.target.value)} className="form-input py-1.5 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="form-label text-xs">Unit Price <span className="text-red-500">*</span></label>
          <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => onChange(index, 'unit_price', e.target.value)} className="form-input py-1.5 text-sm" />
        </div>
        <div>
          <label className="form-label text-xs">Disc %</label>
          <input type="number" min="0" max="100" step="0.01" value={item.discount_percentage} onChange={e => onChange(index, 'discount_percentage', e.target.value)} className="form-input py-1.5 text-sm" />
        </div>
        <div>
          <label className="form-label text-xs">Tax %</label>
          <input type="number" min="0" max="100" step="0.01" value={item.tax_percentage} onChange={e => onChange(index, 'tax_percentage', e.target.value)} className="form-input py-1.5 text-sm" />
        </div>
      </div>

      {/* Line total preview */}
      <div className="flex justify-end">
        <span className="text-xs text-slate-500 mr-2">Line Total:</span>
        <span className="text-sm font-semibold text-slate-900">
          {lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

// ── Financial summary ──────────────────────────────────────────────────────────

function FinancialSummary({ items, currency }: { items: QuotationItemCreate[]; currency: string }) {
  const { subtotal, discount, tax, total } = useMemo(() => {
    let sub = 0, disc = 0, tax = 0;
    for (const item of items) {
      const qty  = Number(item.quantity) || 0;
      const up   = Number(item.unit_price) || 0;
      const dp   = Number(item.discount_percentage) || 0;
      const tp   = Number(item.tax_percentage) || 0;
      const gross = qty * up;
      const discAmt = gross * (dp / 100);
      const after = gross - discAmt;
      sub  += gross;
      disc += discAmt;
      tax  += after * (tp / 100);
    }
    return { subtotal: sub, discount: disc, tax, total: sub - disc + tax };
  }, [items]);

  const fmt = (v: number) => `${currency} ${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200">
      <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
      <div className="flex justify-between text-sm text-slate-600"><span>Discount</span><span className="text-red-600">- {fmt(discount)}</span></div>
      <div className="flex justify-between text-sm text-slate-600"><span>Tax</span><span>{fmt(tax)}</span></div>
      <div className="h-px bg-slate-200 my-1" />
      <div className="flex justify-between font-semibold text-base text-slate-900"><span>Total</span><span className="text-indigo-700">{fmt(total)}</span></div>
      <p className="text-xs text-slate-400 italic">Preview only. Final amounts calculated on the server.</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const emptyItem = (): QuotationItemCreate => ({
  product_id: null, variant_id: null, plan_id: null,
  description: '', quantity: '1', unit_price: '0.00',
  discount_percentage: '0', tax_percentage: '18',
});

export default function QuotationFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { success, error: toastError } = useToast();

  const [customers,  setCustomers]  = useState<any[]>([]);
  const [products,   setProducts]   = useState<any[]>([]);
  const [templates,  setTemplates]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [currency,  setCurrency]  = useState('INR');
  const [notes,     setNotes]     = useState('');
  const [terms,     setTerms]     = useState('');
  const [items,     setItems]     = useState<QuotationItemCreate[]>([emptyItem()]);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  const selectedCustomer = customers.find(c => c.id === Number(customerId));

  // Load dropdowns
  useEffect(() => {
    getCustomers({ status: 'active', limit: 200 }).then(r => setCustomers(r.customers)).catch(() => {});
    getProducts({ is_active: 'true', limit: 200 }).then(r => setProducts(r.products)).catch(() => {});
    getTemplates({ is_active: true, limit: 50 }).then(r => setTemplates(r.templates)).catch(() => {});
  }, []);

  // Load existing quotation for edit
  useEffect(() => {
    if (!isEdit || !id) return;
    getQuotationById(Number(id)).then(q => {
      setCustomerId(String(q.customer_id));
      setQuotationDate(q.quotation_date.split('T')[0]);
      setExpiryDate(q.expiry_date ? q.expiry_date.split('T')[0] : '');
      setCurrency(q.currency);
      setNotes(q.notes || '');
      setTerms(q.terms_and_conditions || '');
      setItems(q.items.map(i => ({
        product_id: i.product_id, variant_id: i.variant_id, plan_id: i.plan_id,
        description: i.description, quantity: i.quantity, unit_price: i.unit_price,
        discount_percentage: i.discount_percentage, tax_percentage: i.tax_percentage,
      })));
    }).catch(() => toastError('Error', 'Could not load quotation.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const applyTemplate = (templateId: string) => {
    const t = templates.find(x => x.id === Number(templateId));
    if (!t) return;
    if (t.default_notes)              setNotes(t.default_notes);
    if (t.default_terms_and_conditions) setTerms(t.default_terms_and_conditions);
    if (t.default_validity_days) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + t.default_validity_days);
      setExpiryDate(expiry.toISOString().split('T')[0]);
    }
  };

  const updateItem = (index: number, field: keyof QuotationItemCreate, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!customerId)    e.customer  = 'Select a customer.';
    if (!quotationDate) e.date      = 'Quotation date is required.';
    for (let i = 0; i < items.length; i++) {
      if (!items[i].description.trim())   e[`item_${i}_desc`] = 'Description required.';
      if (Number(items[i].quantity) <= 0) e[`item_${i}_qty`]  = 'Quantity must be > 0.';
      if (Number(items[i].unit_price) < 0) e[`item_${i}_price`] = 'Price cannot be negative.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPayload = () => ({
    customer_id:           Number(customerId),
    quotation_date:        quotationDate ? new Date(quotationDate).toISOString() : undefined,
    expiry_date:           expiryDate    ? new Date(expiryDate).toISOString()    : undefined,
    currency,
    notes:     notes  || undefined,
    terms_and_conditions: terms || undefined,
    items: items.map(i => ({
      ...i,
      product_id: i.product_id || undefined,
      variant_id: i.variant_id || undefined,
      plan_id:    i.plan_id    || undefined,
    })),
  });

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isEdit && id) {
        const q = await updateQuotation(Number(id), buildPayload());
        success('Saved', 'Quotation updated successfully.');
        navigate(`/quotations/${q.id}`);
      } else {
        const q = await createQuotation(buildPayload() as any);
        success('Created', `Quotation ${q.quotation_number} created as draft.`);
        navigate(`/quotations/${q.id}`);
      }
    } catch (err: any) {
      toastError('Failed', getApiErrorMessage(err));
    } finally { setSubmitting(false); }
  };

  const handleSaveAndSend = async () => {
    if (!validate() || items.length === 0) {
      toastError('Cannot send', 'Add at least one item before sending.');
      return;
    }
    setSubmitting(true);
    try {
      let q;
      if (isEdit && id) {
        q = await updateQuotation(Number(id), buildPayload());
      } else {
        q = await createQuotation(buildPayload() as any);
      }
      await sendQuotation(q.id);
      success('Sent', `Quotation ${q.quotation_number} has been sent.`);
      navigate(`/quotations/${q.id}`);
    } catch (err: any) {
      toastError('Failed', getApiErrorMessage(err));
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className="p-6"><div className="h-6 w-48 bg-slate-200 rounded animate-pulse" /></div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/quotations" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Quotations
          </Link>
          <h1 className="text-xl font-bold text-slate-900">{isEdit ? 'Edit Quotation' : 'Create Quotation'}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={Save} onClick={handleSave} loading={submitting}>Save Draft</Button>
          <Button variant="primary"   size="sm" leftIcon={Send} onClick={handleSaveAndSend} loading={submitting}>Save & Send</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form — 2/3 width */}
        <div className="lg:col-span-2 space-y-6">

          {/* A – Customer */}
          <div className="card p-5">
            <SectionHeader icon={Users} title="A – Customer Details" />
            <Field label="Customer" required error={errors.customer}>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                className={cn('form-input', errors.customer && 'border-red-400')}>
                <option value="">— Select a customer —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}{c.company_name ? ` (${c.company_name})` : ''}</option>
                ))}
              </select>
            </Field>
            {selectedCustomer && (
              <div className="mt-3 p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700 space-y-0.5">
                <p><strong>{selectedCustomer.full_name}</strong>{selectedCustomer.company_name ? ` · ${selectedCustomer.company_name}` : ''}</p>
                <p>{selectedCustomer.email}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}</p>
              </div>
            )}
          </div>

          {/* B – Quotation Info */}
          <div className="card p-5">
            <SectionHeader icon={FileText} title="B – Quotation Information" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quotation Date" required error={errors.date}>
                <input type="date" value={quotationDate} onChange={e => setQuotationDate(e.target.value)}
                  className={cn('form-input', errors.date && 'border-red-400')} />
              </Field>
              <Field label="Expiry Date">
                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="form-input" />
              </Field>
              <Field label="Currency">
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="form-input">
                  <option value="INR">INR</option><option value="USD">USD</option>
                  <option value="EUR">EUR</option><option value="GBP">GBP</option>
                </select>
              </Field>
              <Field label="Apply Template">
                <select onChange={e => applyTemplate(e.target.value)} className="form-input" defaultValue="">
                  <option value="">— Select template (optional) —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* C – Items */}
          <div className="card p-5">
            <SectionHeader icon={ClipboardList} title="C – Quotation Items" />
            <div className="space-y-4">
              {items.map((item, i) => (
                <LineItemRow key={i} index={i} item={item} products={products}
                  onChange={updateItem} onRemove={removeItem} basePrice={item.unit_price} />
              ))}
            </div>
            <button type="button" onClick={addItem}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>

          {/* E – Additional */}
          <div className="card p-5">
            <SectionHeader icon={FileText} title="E – Additional Details" />
            <div className="space-y-4">
              <Field label="Notes">
                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal or customer-facing notes…" className="form-input resize-none" />
              </Field>
              <Field label="Terms & Conditions">
                <textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)} placeholder="Payment terms, validity, etc.…" className="form-input resize-none" />
              </Field>
            </div>
          </div>
        </div>

        {/* Right: D – Financial Summary */}
        <div className="space-y-4">
          <div className="card p-5 sticky top-6">
            <SectionHeader icon={DollarSign} title="D – Financial Summary" />
            <FinancialSummary items={items} currency={currency} />
            <div className="mt-4 space-y-2">
              <Button variant="secondary" size="sm" className="w-full" leftIcon={Save} onClick={handleSave} loading={submitting}>
                Save as Draft
              </Button>
              <Button variant="primary" size="sm" className="w-full" leftIcon={Send} onClick={handleSaveAndSend} loading={submitting}>
                Save & Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
