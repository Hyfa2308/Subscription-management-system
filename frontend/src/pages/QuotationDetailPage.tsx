/**
 * REVORA – QuotationDetailPage
 * Route: /quotations/:id
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Send, CheckCircle2, XCircle, Ban,
  Download, FileText, DollarSign, Users, Calendar,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import {
  getQuotationById, sendQuotation, acceptQuotation,
  rejectQuotation, cancelQuotation, getQuotationPdfUrl,
} from '@/services/quotationApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type { QuotationDetail } from '@/types/quotation';
import { QUOTATION_STATUS_CONFIG, formatMoney } from '@/types/quotation';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function fmtDate(dt?: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [q,          setQ]          = useState<QuotationDetail | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [apiError,   setApiError]   = useState('');
  const [actioning,  setActioning]  = useState(false);
  const [dialog,     setDialog]     = useState<'send' | 'accept' | 'reject' | 'cancel' | null>(null);

  const qId = Number(id);

  const fetchQ = useCallback(async () => {
    setLoading(true); setApiError('');
    try { setQ(await getQuotationById(qId)); }
    catch (err: any) {
      setApiError(err?.response?.status === 404 ? 'Quotation not found.' : getApiErrorMessage(err));
    } finally { setLoading(false); }
  }, [qId]);

  useEffect(() => { fetchQ(); }, [fetchQ]);

  const doAction = async (action: typeof dialog) => {
    if (!q || !action) return;
    setActioning(true);
    try {
      if (action === 'send')   await sendQuotation(q.id);
      if (action === 'accept') await acceptQuotation(q.id);
      if (action === 'reject') await rejectQuotation(q.id);
      if (action === 'cancel') await cancelQuotation(q.id);
      success('Done', `Quotation ${action}ed.`);
      setDialog(null);
      fetchQ();
    } catch (err) { toastError('Failed', getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  const downloadPdf = () => {
    if (!q) return;
    // Get PDF download URL with auth token
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const url = getQuotationPdfUrl(q.id);
    // Open in new tab with auth header via fetch-blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `quotation-${q.quotation_number}.pdf`;
        a.click();
      })
      .catch(() => toastError('PDF Error', 'Could not generate PDF.'));
  };

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="card p-6 space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${75 - i * 10}%` }} />)}
        </div>
      </div>
    );
  }

  if (apiError || !q) {
    return (
      <div className="p-6">
        <div className="card p-8 flex flex-col items-center text-center">
          <p className="text-sm text-slate-600 mb-4">{apiError || 'Not found.'}</p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/quotations')}>Back to Quotations</Button>
        </div>
      </div>
    );
  }

  const statusCfg = QUOTATION_STATUS_CONFIG[q.status];

  return (
    <div className="space-y-6 p-6">
      {/* Back */}
      <Link to="/quotations" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quotations
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{q.quotation_number}</h1>
              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', statusCfg.bg, statusCfg.text)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
                {statusCfg.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <span>Date: {fmtDate(q.quotation_date)}</span>
              {q.expiry_date && <span>Expires: {fmtDate(q.expiry_date)}</span>}
              <span>Currency: {q.currency}</span>
            </div>
          </div>
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" leftIcon={Download} onClick={downloadPdf}>PDF</Button>
            {q.status === 'draft' && (
              <>
                <Button variant="secondary" size="sm" leftIcon={Edit3} onClick={() => navigate(`/quotations/${q.id}/edit`)}>Edit</Button>
                <Button variant="primary"   size="sm" leftIcon={Send}  onClick={() => setDialog('send')}>Send</Button>
              </>
            )}
            {q.status === 'sent' && (
              <>
                <Button variant="primary"   size="sm" leftIcon={CheckCircle2} onClick={() => setDialog('accept')}>Accept</Button>
                <Button variant="secondary" size="sm" leftIcon={XCircle}      onClick={() => setDialog('reject')}>Reject</Button>
              </>
            )}
            {['draft','sent'].includes(q.status) && (
              <Button variant="danger" size="sm" leftIcon={Ban} onClick={() => setDialog('cancel')}>Cancel</Button>
            )}
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Items table — full width */}
        <div className="lg:col-span-2 space-y-6">

          {/* Customer */}
          {q.customer && (
            <div className="card p-5">
              <SectionTitle icon={Users} title="Customer" />
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Name">{q.customer.full_name}</InfoCard>
                <InfoCard label="Email">{q.customer.email}</InfoCard>
                {q.customer.company_name && <InfoCard label="Company">{q.customer.company_name}</InfoCard>}
                {q.customer.phone        && <InfoCard label="Phone">{q.customer.phone}</InfoCard>}
              </div>
            </div>
          )}

          {/* Line items */}
          <div className="card p-5">
            <SectionTitle icon={DollarSign} title="Line Items" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">#</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Unit Price</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Disc %</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Tax %</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {q.items.map((item, i) => (
                    <tr key={item.id} className={cn('border-b border-slate-100', i % 2 === 0 && 'bg-slate-50/50')}>
                      <td className="py-3 px-3 text-slate-400">{i + 1}</td>
                      <td className="py-3 px-3 text-slate-800 font-medium">{item.description}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{item.quantity}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{formatMoney(item.unit_price, q.currency)}</td>
                      <td className="py-3 px-3 text-right text-slate-500">{item.discount_percentage}%</td>
                      <td className="py-3 px-3 text-right text-slate-500">{item.tax_percentage}%</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900">{formatMoney(item.line_total, q.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {q.items.length === 0 && <p className="text-sm text-slate-400 italic text-center py-6">No items.</p>}
            </div>
          </div>

          {/* Notes + Terms */}
          {(q.notes || q.terms_and_conditions) && (
            <div className="card p-5">
              <SectionTitle icon={FileText} title="Additional Details" />
              {q.notes && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Notes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{q.notes}</p>
                </div>
              )}
              {q.terms_and_conditions && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Terms & Conditions</p>
                  <p className="text-sm text-slate-500 whitespace-pre-wrap">{q.terms_and_conditions}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Totals + Dates */}
        <div className="space-y-6">

          {/* Totals */}
          <div className="card p-5">
            <SectionTitle icon={DollarSign} title="Financial Summary" />
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{formatMoney(q.subtotal, q.currency)}</span></div>
              <div className="flex justify-between text-sm text-slate-600"><span>Discount</span><span className="text-red-600">- {formatMoney(q.discount_amount, q.currency)}</span></div>
              <div className="flex justify-between text-sm text-slate-600"><span>Tax</span><span>{formatMoney(q.tax_amount, q.currency)}</span></div>
              <div className="h-px bg-slate-200 my-2" />
              <div className="flex justify-between text-base font-bold text-slate-900">
                <span>Total</span>
                <span className="text-indigo-700">{formatMoney(q.total_amount, q.currency)}</span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="card p-5">
            <SectionTitle icon={Calendar} title="Timeline" />
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500"><span>Quotation Date</span><span>{fmtDate(q.quotation_date)}</span></div>
              {q.expiry_date && <div className="flex justify-between text-xs text-slate-500"><span>Expires</span><span>{fmtDate(q.expiry_date)}</span></div>}
              <div className="flex justify-between text-xs text-slate-500"><span>Created</span><span>{fmtDate(q.created_at)}</span></div>
              <div className="flex justify-between text-xs text-slate-500"><span>Updated</span><span>{fmtDate(q.updated_at)}</span></div>
            </div>
          </div>

          {/* Future: activity history */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Activity</h2>
            <p className="text-xs text-slate-400 italic">Activity timeline will appear here in a future release.</p>
          </div>
        </div>
      </div>

      {/* Action dialogs */}
      <ConfirmDialog open={dialog === 'send'} onOpenChange={o => !o && setDialog(null)}
        title="Send Quotation" description={`Send ${q.quotation_number} to the customer?`}
        confirmLabel="Send" variant="primary" loading={actioning} onConfirm={() => doAction('send')} />
      <ConfirmDialog open={dialog === 'accept'} onOpenChange={o => !o && setDialog(null)}
        title="Accept Quotation" description="Mark this quotation as accepted?"
        confirmLabel="Accept" variant="primary" loading={actioning} onConfirm={() => doAction('accept')} />
      <ConfirmDialog open={dialog === 'reject'} onOpenChange={o => !o && setDialog(null)}
        title="Reject Quotation" description="Mark this quotation as rejected?"
        confirmLabel="Reject" variant="danger" loading={actioning} onConfirm={() => doAction('reject')} />
      <ConfirmDialog open={dialog === 'cancel'} onOpenChange={o => !o && setDialog(null)}
        title="Cancel Quotation" description="Cancel this quotation? This cannot be reversed."
        confirmLabel="Cancel" variant="danger" loading={actioning} onConfirm={() => doAction('cancel')} />
    </div>
  );
}
