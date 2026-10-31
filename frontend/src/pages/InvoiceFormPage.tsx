/**
 * REVORA – InvoiceFormPage
 * Route: /invoices/new
 * 6-section form: customer, source, subscription, items, invoice info, financial summary.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, FileText, Layers, Plus, Trash2,
  DollarSign, Calendar, Save,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { getCustomers } from '@/services/customerApi';
import { getSubscriptions } from '@/services/subscriptionApi';
import { getProducts } from '@/services/productApi';
import { createInvoice } from '@/services/invoiceApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/types/invoice';
import type { InvoiceItemCreate } from '@/types/invoice';

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

const EMPTY_ITEM: InvoiceItemCreate = {
  description: '', quantity: '1', unit_price: '0',
  discount_percentage: '0', tax_percentage: '0',
};

function calcItem(item: InvoiceItemCreate) {
  const qty  = Number(item.quantity)  || 0;
  const up   = Number(item.unit_price) || 0;
  const disc = Number(item.discount_percentage) || 0;
  const tax  = Number(item.tax_percentage) || 0;
  const gross     = qty * up;
  const discAmt   = gross * (disc / 100);
  const afterDisc = gross - discAmt;
  const taxAmt    = afterDisc * (tax / 100);
  return { gross, discAmt, afterDisc, taxAmt, total: afterDisc + taxAmt };
}

export default function InvoiceFormPage() {
  const navigate = useNavigate();
  const { success, error: te } = useToast();

  const [customers,  setCustomers]  = useState<any[]>([]);
  const [subs,       setSubs]       = useState<any[]>([]);
  const [products,   setProducts]   = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // A – Customer
  const [customerId, setCustomerId] = useState('');
  const selectedCustomer = customers.find(c => c.id === Number(customerId));

  // B – Source
  type SourceType = 'manual' | 'subscription';
  const [source, setSource] = useState<SourceType>('manual');
  const [subId,  setSubId]  = useState('');
  const selectedSub = subs.find(s => s.id === Number(subId));

  // D – Items
  const [items, setItems] = useState<InvoiceItemCreate[]>([{ ...EMPTY_ITEM }]);

  // E – Invoice Info
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate,     setDueDate]     = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd,   setPeriodEnd]   = useState('');
  const [currency,    setCurrency]    = useState('INR');
  const [notes,       setNotes]       = useState('');
  const [terms,       setTerms]       = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    getCustomers({ status: 'active', limit: 200 }).then(r => setCustomers(r.customers)).catch(() => {});
    getProducts({ is_active: 'true', limit: 200 }).then(r => setProducts(r.products)).catch(() => {});
  }, []);

  useEffect(() => {
    if (customerId) {
      getSubscriptions({ customer_id: customerId, status: 'active', limit: 100 })
        .then(r => setSubs(r.subscriptions)).catch(() => {});
    }
  }, [customerId]);

  // Auto-fill when sub selected
  useEffect(() => {
    if (selectedSub) {
      setCurrency(selectedSub.currency || 'INR');
      // Pre-fill single item from subscription
      setItems([{
        plan_id:             selectedSub.plan_id,
        description:         `${selectedSub.snap_plan_name || 'Subscription'} — ${selectedSub.billing_frequency} billing`,
        quantity:            String(selectedSub.quantity),
        unit_price:          String(selectedSub.unit_price),
        discount_percentage: '0',
        tax_percentage:      '0',
      }]);
    }
  }, [selectedSub]);

  const setItem = (idx: number, field: keyof InvoiceItemCreate, value: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  // Computed totals
  const totals = items.reduce(
    (acc, item) => {
      const c = calcItem(item);
      return { gross: acc.gross + c.gross, disc: acc.disc + c.discAmt, tax: acc.tax + c.taxAmt, total: acc.total + c.total };
    },
    { gross: 0, disc: 0, tax: 0, total: 0 },
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!customerId)  e.customer = 'Select a customer.';
    if (source === 'subscription' && !subId) e.sub = 'Select a subscription.';
    if (!invoiceDate) e.invoiceDate = 'Invoice date is required.';
    if (items.length === 0) e.items = 'At least one item is required.';
    items.forEach((it, i) => {
      if (!it.description.trim()) e[`item_${i}_desc`] = 'Description required.';
      if (Number(it.quantity) <= 0) e[`item_${i}_qty`] = 'Qty must be > 0.';
      if (Number(it.unit_price) < 0) e[`item_${i}_price`] = 'Price cannot be negative.';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const inv = await createInvoice({
        customer_id:          Number(customerId),
        subscription_id:      source === 'subscription' && subId ? Number(subId) : undefined,
        invoice_date:         new Date(invoiceDate).toISOString(),
        due_date:             dueDate     ? new Date(dueDate).toISOString()     : undefined,
        billing_period_start: periodStart ? new Date(periodStart).toISOString() : undefined,
        billing_period_end:   periodEnd   ? new Date(periodEnd).toISOString()   : undefined,
        currency,
        notes:                notes  || undefined,
        terms_and_conditions: terms  || undefined,
        items,
      });
      success('Created', `Invoice ${inv.invoice_number} created as Draft.`);
      navigate(`/invoices/${inv.id}`);
    } catch (err: any) { te('Failed', getApiErrorMessage(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div>
        <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeft className="w-4 h-4" /> Invoices
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Create Invoice</h1>
          <Button variant="primary" size="sm" leftIcon={Save} onClick={handleCreate} loading={submitting}>Create</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* A – Customer */}
          <div className="card p-5">
            <SectionHeader icon={Users} title="A – Customer" />
            <Field label="Customer" required error={errors.customer}>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                className={cn('form-input', errors.customer && 'border-red-400')}>
                <option value="">— Select customer —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}{c.company_name ? ` (${c.company_name})` : ''}</option>)}
              </select>
            </Field>
            {selectedCustomer && (
              <div className="mt-3 p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700 space-y-0.5">
                <p><strong>{selectedCustomer.full_name}</strong>{selectedCustomer.company_name ? ` · ${selectedCustomer.company_name}` : ''}</p>
                <p>{selectedCustomer.email}</p>
              </div>
            )}
          </div>

          {/* B – Source */}
          <div className="card p-5">
            <SectionHeader icon={FileText} title="B – Invoice Source" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['manual', 'subscription'] as SourceType[]).map(s => (
                <button key={s} onClick={() => setSource(s)}
                  className={cn('p-3 rounded-xl border-2 text-left transition-all',
                    source === s ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white')}>
                  <p className={cn('text-sm font-semibold', source === s ? 'text-indigo-700' : 'text-slate-700')}>
                    {s === 'manual' ? 'Manual Invoice' : 'Subscription Billing'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {s === 'manual' ? 'Create invoice manually.' : 'Link to an active subscription.'}
                  </p>
                </button>
              ))}
            </div>
            {source === 'subscription' && (
              <Field label="Active Subscription" required error={errors.sub}>
                <select value={subId} onChange={e => setSubId(e.target.value)}
                  className={cn('form-input', errors.sub && 'border-red-400')}>
                  <option value="">— Select subscription —</option>
                  {subs.map(s => <option key={s.id} value={s.id}>{s.subscription_number} — {s.snap_plan_name || 'Plan'} ({s.billing_frequency})</option>)}
                </select>
                {!customerId && <p className="text-xs text-amber-600 mt-1">Select a customer first.</p>}
              </Field>
            )}
          </div>

          {/* D – Items */}
          <div className="card p-5">
            <SectionHeader icon={Layers} title="D – Invoice Items" />
            {errors.items && <p className="form-error mb-3">{errors.items}</p>}
            <div className="space-y-4">
              {items.map((item, idx) => {
                const c = calcItem(item);
                return (
                  <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500">Item {idx + 1}</span>
                      {items.length > 1 && (
                        <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                          className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="form-label">Description *</label>
                        <input value={item.description} onChange={e => setItem(idx, 'description', e.target.value)}
                          placeholder="Product or service description"
                          className={cn('form-input', errors[`item_${idx}_desc`] && 'border-red-400')} />
                        {errors[`item_${idx}_desc`] && <p className="form-error">{errors[`item_${idx}_desc`]}</p>}
                      </div>
                      <div>
                        <label className="form-label">Quantity *</label>
                        <input type="number" min="1" value={item.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)}
                          className={cn('form-input', errors[`item_${idx}_qty`] && 'border-red-400')} />
                      </div>
                      <div>
                        <label className="form-label">Unit Price *</label>
                        <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => setItem(idx, 'unit_price', e.target.value)}
                          className={cn('form-input', errors[`item_${idx}_price`] && 'border-red-400')} />
                      </div>
                      <div>
                        <label className="form-label">Discount %</label>
                        <input type="number" min="0" max="100" value={item.discount_percentage} onChange={e => setItem(idx, 'discount_percentage', e.target.value)} className="form-input" />
                      </div>
                      <div>
                        <label className="form-label">Tax %</label>
                        <input type="number" min="0" max="100" value={item.tax_percentage} onChange={e => setItem(idx, 'tax_percentage', e.target.value)} className="form-input" />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end text-xs text-slate-500">
                      Line total: <strong className="ml-1 text-slate-800">{formatMoney(c.total, currency)}</strong>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setItems(prev => [...prev, { ...EMPTY_ITEM }])}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
          </div>

          {/* E – Invoice Info */}
          <div className="card p-5">
            <SectionHeader icon={Calendar} title="E – Invoice Information" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Invoice Date" required error={errors.invoiceDate}>
                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                  className={cn('form-input', errors.invoiceDate && 'border-red-400')} />
              </Field>
              <Field label="Due Date">
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="form-input" />
              </Field>
              <Field label="Billing Period Start">
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="form-input" />
              </Field>
              <Field label="Billing Period End">
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="form-input" />
              </Field>
              <Field label="Currency">
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="form-input">
                  <option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option>
                </select>
              </Field>
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Notes">
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="form-input resize-none" />
              </Field>
              <Field label="Terms & Conditions">
                <textarea rows={2} value={terms} onChange={e => setTerms(e.target.value)} className="form-input resize-none" />
              </Field>
            </div>
          </div>
        </div>

        {/* Right: Financial Summary */}
        <div>
          <div className="card p-5 sticky top-6">
            <SectionHeader icon={DollarSign} title="F – Financial Summary" />
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{formatMoney(totals.gross, currency)}</span></div>
              <div className="flex justify-between text-sm text-red-500"><span>Discount</span><span>– {formatMoney(totals.disc, currency)}</span></div>
              <div className="flex justify-between text-sm text-slate-600"><span>Tax</span><span>{formatMoney(totals.tax, currency)}</span></div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between font-bold text-base text-slate-900">
                <span>Total</span>
                <span className="text-indigo-700">{formatMoney(totals.total, currency)}</span>
              </div>
              <p className="text-xs text-slate-400 italic mt-1">Preview only. Server recalculates final amounts.</p>
            </div>
            <div className="mt-5">
              <Button variant="primary" size="sm" className="w-full" leftIcon={Save} onClick={handleCreate} loading={submitting}>
                Create Invoice
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
