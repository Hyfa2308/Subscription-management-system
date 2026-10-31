/**
 * REVORA – SubscriptionFormPage
 * Route: /subscriptions/new
 * 5-section form: customer, source, plan+product, config, financial summary.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Users, Layers, Settings, DollarSign, FileText, Save } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { getCustomers } from '@/services/customerApi';
import { getProducts } from '@/services/productApi';
import { getPlans } from '@/services/planApi';
import { getQuotations } from '@/services/quotationApi';
import { createSubscription } from '@/services/subscriptionApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/types/subscription';
import { BILLING_FREQUENCY_LABELS } from '@/types/subscription';

// ── Local helpers ─────────────────────────────────────────────────────────────

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

// ── Financial summary panel ───────────────────────────────────────────────────

function FinancialSummary({
  plan, quantity, currency,
}: {
  plan: any; quantity: number; currency: string;
}) {
  const unitPrice = Number(plan?.plan_price || 0);
  const taxPct    = Number(plan?.tax_percentage || 0);
  const gross     = unitPrice * quantity;
  const taxAmt    = gross * (taxPct / 100);
  const total     = gross + taxAmt;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
      <div className="flex justify-between text-sm text-slate-600">
        <span>Unit Price</span><span>{formatMoney(unitPrice, currency)}</span>
      </div>
      <div className="flex justify-between text-sm text-slate-600">
        <span>Quantity</span><span>× {quantity}</span>
      </div>
      <div className="flex justify-between text-sm text-slate-600">
        <span>Subtotal</span><span>{formatMoney(gross, currency)}</span>
      </div>
      <div className="flex justify-between text-sm text-slate-600">
        <span>Tax ({taxPct}%)</span><span>{formatMoney(taxAmt, currency)}</span>
      </div>
      <div className="h-px bg-slate-200" />
      <div className="flex justify-between font-bold text-base text-slate-900">
        <span>Total</span>
        <span className="text-indigo-700">{formatMoney(total, currency)}</span>
      </div>
      <p className="text-xs text-slate-400 italic">Preview only. Server recalculates final amounts.</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SourceType = 'direct' | 'quotation';

export default function SubscriptionFormPage() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [customers,  setCustomers]  = useState<any[]>([]);
  const [plans,      setPlans]      = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Section A – Customer
  const [customerId, setCustomerId] = useState('');
  const selectedCustomer = customers.find(c => c.id === Number(customerId));

  // Section B – Source
  const [source, setSource] = useState<SourceType>('direct');
  const [quotationId, setQuotationId] = useState('');

  // Section C – Plan
  const [planId, setPlanId] = useState('');
  const selectedPlan = plans.find(p => p.id === Number(planId));

  // Section D – Configuration
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate]     = useState('');
  const [quantity, setQuantity]   = useState('1');
  const [autoRenew, setAutoRenew] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load dropdowns
  useEffect(() => {
    getCustomers({ status: 'active', limit: 200 }).then(r => setCustomers(r.customers)).catch(() => {});
    getPlans({ status: 'active', limit: 200 }).then(r => setPlans(r.plans)).catch(() => {});
    getQuotations({ status: 'accepted', limit: 200 }).then(r => setQuotations(r.quotations)).catch(() => {});
  }, []);

  // When quotation selected, auto-fill customer
  useEffect(() => {
    if (source === 'quotation' && quotationId) {
      const q = quotations.find(x => x.id === Number(quotationId));
      if (q) setCustomerId(String(q.customer_id));
    }
  }, [quotationId, source, quotations]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!customerId) e.customer = 'Select a customer.';
    if (source === 'quotation' && !quotationId) e.quotation = 'Select a quotation.';
    if (!planId)     e.plan     = 'Select a subscription plan.';
    if (!startDate)  e.startDate= 'Start date is required.';
    if (Number(quantity) <= 0) e.quantity = 'Quantity must be greater than 0.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const sub = await createSubscription({
        customer_id:  Number(customerId),
        plan_id:      Number(planId),
        quotation_id: source === 'quotation' && quotationId ? Number(quotationId) : undefined,
        start_date:   new Date(startDate).toISOString(),
        end_date:     endDate ? new Date(endDate).toISOString() : undefined,
        quantity,
        auto_renew:   autoRenew,
      });
      success('Created', `Subscription ${sub.subscription_number} created as Draft.`);
      navigate(`/subscriptions/${sub.id}`);
    } catch (err: any) {
      toastError('Failed', getApiErrorMessage(err));
    } finally { setSubmitting(false); }
  };

  const currency = selectedPlan?.currency || 'INR';

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link to="/subscriptions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeft className="w-4 h-4" /> Subscriptions
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Create Subscription</h1>
          <Button variant="primary" size="sm" leftIcon={Save} onClick={handleCreate} loading={submitting}>
            Create
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main 2/3 */}
        <div className="lg:col-span-2 space-y-6">

          {/* A – Customer */}
          <div className="card p-5">
            <SectionHeader icon={Users} title="A – Customer" />
            <Field label="Customer" required error={errors.customer}>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                className={cn('form-input', errors.customer && 'border-red-400')}>
                <option value="">— Select customer —</option>
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

          {/* B – Source */}
          <div className="card p-5">
            <SectionHeader icon={FileText} title="B – Subscription Source" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['direct', 'quotation'] as SourceType[]).map(s => (
                <button key={s} onClick={() => setSource(s)}
                  className={cn(
                    'p-3 rounded-xl border-2 text-left transition-all',
                    source === s
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white',
                  )}>
                  <p className={cn('text-sm font-semibold', source === s ? 'text-indigo-700' : 'text-slate-700')}>
                    {s === 'direct' ? 'Direct Creation' : 'From Accepted Quotation'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {s === 'direct' ? 'Configure plan manually.' : 'Auto-fill from an accepted quotation.'}
                  </p>
                </button>
              ))}
            </div>
            {source === 'quotation' && (
              <Field label="Accepted Quotation" required error={errors.quotation}>
                <select value={quotationId} onChange={e => setQuotationId(e.target.value)}
                  className={cn('form-input', errors.quotation && 'border-red-400')}>
                  <option value="">— Select quotation —</option>
                  {quotations.map(q => (
                    <option key={q.id} value={q.id}>{q.quotation_number} — Customer #{q.customer_id}</option>
                  ))}
                </select>
                {quotations.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No accepted quotations found. Accept a quotation first.</p>
                )}
              </Field>
            )}
          </div>

          {/* C – Plan */}
          <div className="card p-5">
            <SectionHeader icon={Layers} title="C – Plan & Product" />
            <Field label="Subscription Plan" required error={errors.plan}>
              <select value={planId} onChange={e => setPlanId(e.target.value)}
                className={cn('form-input', errors.plan && 'border-red-400')}>
                <option value="">— Select active plan —</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.plan_name} — {p.currency} {Number(p.plan_price).toLocaleString('en-IN')}/{p.billing_frequency}</option>
                ))}
              </select>
            </Field>
            {selectedPlan && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  ['Billing', `${BILLING_FREQUENCY_LABELS[selectedPlan.billing_frequency as keyof typeof BILLING_FREQUENCY_LABELS] || selectedPlan.billing_frequency}`],
                  ['Price',   formatMoney(selectedPlan.plan_price, selectedPlan.currency)],
                  ['Tax',     `${selectedPlan.tax_percentage || 0}%`],
                  ['Trial',   selectedPlan.trial_period_days ? `${selectedPlan.trial_period_days} days` : '—'],
                  ['Pause',   selectedPlan.pause_allowed ? '✓ Allowed' : '✗ Not allowed'],
                  ['Renewal', selectedPlan.renewal_allowed ? '✓ Allowed' : '✗ Not allowed'],
                ].map(([k, v]) => (
                  <div key={k} className="p-2.5 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{k}</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* D – Configuration */}
          <div className="card p-5">
            <SectionHeader icon={Settings} title="D – Subscription Configuration" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date" required error={errors.startDate}>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className={cn('form-input', errors.startDate && 'border-red-400')} />
              </Field>
              <Field label="End Date (optional)">
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" />
              </Field>
              <Field label="Quantity" required error={errors.quantity}>
                <input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)}
                  className={cn('form-input', errors.quantity && 'border-red-400')} />
              </Field>
              <div className="flex items-end pb-1">
                <div className="flex items-center justify-between w-full p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Auto Renew</p>
                    <p className="text-xs text-slate-400">Automatically renew on billing date</p>
                  </div>
                  <button type="button" onClick={() => setAutoRenew(a => !a)}
                    className={cn('relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors', autoRenew ? 'bg-indigo-600' : 'bg-slate-200')}>
                    <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', autoRenew ? 'translate-x-4' : 'translate-x-0')} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Financial summary */}
        <div>
          <div className="card p-5 sticky top-6">
            <SectionHeader icon={DollarSign} title="E – Financial Summary" />
            {selectedPlan
              ? <FinancialSummary plan={selectedPlan} quantity={Number(quantity) || 1} currency={currency} />
              : <p className="text-sm text-slate-400 italic">Select a plan to see price details.</p>
            }
            <div className="mt-4">
              <Button variant="primary" size="sm" className="w-full" leftIcon={Save} onClick={handleCreate} loading={submitting}>
                Create Subscription
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
