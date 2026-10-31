/**
 * REVORA – InvoiceDetailPage
 * Route: /invoices/:id
 * Tabs: Overview | Items | Billing History | Payments
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Receipt, Users, DollarSign, Calendar,
  FileDown, Ban, CheckCircle2, Clock, CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { getInvoiceById, cancelInvoice, finalizeInvoice } from '@/services/invoiceApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';
import type { InvoiceDetail, InvoiceStatus } from '@/types/invoice';
import { INVOICE_STATUS_CONFIG, formatMoney, fmtDate } from '@/types/invoice';

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm font-medium text-slate-800">{children}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-indigo-600" />
      </div>
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = INVOICE_STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', cfg.bg, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

type TabId = 'overview' | 'items' | 'billing' | 'payments';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview',        icon: Receipt    },
  { id: 'items',    label: 'Line Items',       icon: DollarSign },
  { id: 'billing',  label: 'Billing History',  icon: Clock      },
  { id: 'payments', label: 'Payments',         icon: CreditCard },
];

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Clock className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{label} — Coming Soon</h3>
      <p className="text-sm text-slate-400 max-w-xs">This module will be available in a future release.</p>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth() as any;
  const { success, error: te } = useToast();

  const [inv,       setInv]       = useState<InvoiceDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [apiError,  setApiError]  = useState('');
  const [tab,       setTab]       = useState<TabId>('overview');
  const [dialog,    setDialog]    = useState<'cancel' | 'finalize' | null>(null);
  const [actioning, setActioning] = useState(false);
  const [pdfBusy,   setPdfBusy]  = useState(false);

  const invId = Number(id);

  const fetchInv = useCallback(async () => {
    setLoading(true); setApiError('');
    try { setInv(await getInvoiceById(invId)); }
    catch (err: any) { setApiError(err?.response?.status === 404 ? 'Invoice not found.' : getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [invId]);

  useEffect(() => { fetchInv(); }, [fetchInv]);

  const doAction = async () => {
    if (!inv || !dialog) return;
    setActioning(true);
    try {
      if (dialog === 'cancel')   await cancelInvoice(inv.id);
      if (dialog === 'finalize') await finalizeInvoice(inv.id);
      success('Done', `Invoice ${dialog}d.`);
      setDialog(null); fetchInv();
    } catch (err) { te('Failed', getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  const downloadPdf = async () => {
    if (!inv) return;
    setPdfBusy(true);
    try {
      const base = (window as any).__REVORA_API_BASE__ || 'http://localhost:8000/api/v1';
      const res = await fetch(`${base}/invoices/${inv.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('PDF download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `${inv.invoice_number}.pdf`; a.click();
      URL.revokeObjectURL(url);
      success('Downloaded', 'Invoice PDF saved.');
    } catch { te('Failed', 'Could not download PDF.'); }
    finally { setPdfBusy(false); }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-52 bg-slate-200 rounded animate-pulse" />
        <div className="card p-6 space-y-4">{[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${80 - i * 10}%` }} />
        ))}</div>
      </div>
    );
  }

  if (apiError || !inv) {
    return (
      <div className="p-6">
        <div className="card p-8 flex flex-col items-center">
          <p className="text-sm text-slate-600 mb-4">{apiError || 'Not found.'}</p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/invoices')}>Back</Button>
        </div>
      </div>
    );
  }

  const s = inv.status;

  return (
    <div className="space-y-6 p-6">
      <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="w-4 h-4" /> Invoices
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{inv.invoice_number}</h1>
              <StatusBadge status={s} />
            </div>
            <p className="text-sm text-slate-500">
              {inv.customer?.full_name || `Customer #${inv.customer_id}`}
              {inv.subscription ? ` · Subscription ${inv.subscription.subscription_number}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" leftIcon={FileDown} onClick={downloadPdf} loading={pdfBusy}>
              Download PDF
            </Button>
            {s === 'draft' && (
              <Button variant="primary" size="sm" leftIcon={CheckCircle2} onClick={() => setDialog('finalize')}>Finalize</Button>
            )}
            {!['paid','cancelled'].includes(s) && (
              <Button variant="danger" size="sm" leftIcon={Ban} onClick={() => setDialog('cancel')}>Cancel</Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1 px-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Customer */}
            {inv.customer && (
              <div className="card p-5">
                <SectionTitle icon={Users} title="Customer" />
                <div className="grid grid-cols-2 gap-3">
                  <InfoCard label="Name">{inv.customer.full_name}</InfoCard>
                  <InfoCard label="Email">{inv.customer.email}</InfoCard>
                  {inv.customer.company_name && <InfoCard label="Company">{inv.customer.company_name}</InfoCard>}
                  {inv.customer.phone        && <InfoCard label="Phone">{inv.customer.phone}</InfoCard>}
                </div>
              </div>
            )}
            {/* Subscription ref */}
            {inv.subscription && (
              <div className="card p-5">
                <SectionTitle icon={Calendar} title="Subscription Reference" />
                <div className="grid grid-cols-3 gap-3">
                  <InfoCard label="Number">{inv.subscription.subscription_number}</InfoCard>
                  <InfoCard label="Plan">{inv.subscription.snap_plan_name || '—'}</InfoCard>
                  <InfoCard label="Frequency">{inv.subscription.billing_frequency}</InfoCard>
                </div>
              </div>
            )}
            {/* Dates */}
            <div className="card p-5">
              <SectionTitle icon={Calendar} title="Dates" />
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Invoice Date">{fmtDate(inv.invoice_date)}</InfoCard>
                <InfoCard label="Due Date">{fmtDate(inv.due_date)}</InfoCard>
                <InfoCard label="Billing Period Start">{fmtDate(inv.billing_period_start)}</InfoCard>
                <InfoCard label="Billing Period End">{fmtDate(inv.billing_period_end)}</InfoCard>
              </div>
            </div>
            {/* Notes */}
            {(inv.notes || inv.terms_and_conditions) && (
              <div className="card p-5">
                <SectionTitle icon={Receipt} title="Notes & Terms" />
                {inv.notes && <div className="mb-3"><p className="text-xs text-slate-400 uppercase mb-1">Notes</p><p className="text-sm text-slate-700">{inv.notes}</p></div>}
                {inv.terms_and_conditions && <div><p className="text-xs text-slate-400 uppercase mb-1">Terms</p><p className="text-sm text-slate-700">{inv.terms_and_conditions}</p></div>}
              </div>
            )}
          </div>

          {/* Right: Financial summary */}
          <div className="space-y-6">
            <div className="card p-5">
              <SectionTitle icon={DollarSign} title="Financial Summary" />
              <div className="space-y-2">
                {[
                  ['Subtotal',  inv.subtotal],
                  ['Discount',  `-${formatMoney(inv.discount_amount, inv.currency)}`],
                  ['Tax',       formatMoney(inv.tax_amount, inv.currency)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm text-slate-600">
                    <span>{k}</span><span>{typeof v === 'string' && v.startsWith('-') ? <span className="text-red-500">{v}</span> : formatMoney(String(v), inv.currency)}</span>
                  </div>
                ))}
                <div className="h-px bg-slate-200" />
                <div className="flex justify-between font-bold text-base text-slate-900">
                  <span>Total</span>
                  <span className="text-indigo-700">{formatMoney(inv.total_amount, inv.currency)}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Amount Paid</span><span>{formatMoney(inv.amount_paid, inv.currency)}</span>
                </div>
                <div className={cn('flex justify-between text-sm font-bold', Number(inv.amount_due) > 0 ? 'text-red-600' : 'text-slate-400')}>
                  <span>Amount Due</span><span>{formatMoney(inv.amount_due, inv.currency)}</span>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <SectionTitle icon={Calendar} title="Audit" />
              <div className="space-y-2">
                {[['Created', fmtDate(inv.created_at)], ['Updated', fmtDate(inv.updated_at)]].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs text-slate-500">
                    <span>{k}</span><span className="font-medium text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items tab */}
      {tab === 'items' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>{['#','Description','Qty','Unit Price','Disc %','Tax %','Total'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {inv.items.length === 0
                ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">No items.</td></tr>
                : inv.items.map((item, i) => (
                  <tr key={item.id} className={cn('border-b border-slate-100', i % 2 === 0 ? 'bg-white' : 'bg-slate-50')}>
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 text-slate-800">{item.description}</td>
                    <td className="px-4 py-3 text-slate-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-slate-600 text-right">{formatMoney(item.unit_price, inv.currency)}</td>
                    <td className="px-4 py-3 text-slate-600 text-right">{item.discount_percentage}%</td>
                    <td className="px-4 py-3 text-slate-600 text-right">{item.tax_percentage}%</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 text-right">{formatMoney(item.line_total, inv.currency)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Placeholder tabs */}
      {tab === 'billing'  && <div className="card p-6"><ComingSoon label="Billing History" /></div>}
      {tab === 'payments' && <div className="card p-6"><ComingSoon label="Payments" /></div>}

      {/* Dialogs */}
      {dialog && (
        <ConfirmDialog
          open={true}
          onOpenChange={o => { if (!o) setDialog(null); }}
          loading={actioning}
          onConfirm={doAction}
          title={dialog === 'cancel' ? 'Cancel Invoice' : 'Finalize Invoice'}
          description={dialog === 'cancel'
            ? `Cancel ${inv.invoice_number}? This cannot be undone.`
            : `Finalize ${inv.invoice_number} and set to Unpaid?`}
          confirmLabel={dialog === 'cancel' ? 'Cancel Invoice' : 'Finalize'}
          variant={dialog === 'cancel' ? 'danger' : 'primary'}
        />
      )}
    </div>
  );
}
