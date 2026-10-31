/**
 * REVORA – SubscriptionDetailPage
 * Route: /subscriptions/:id
 * Tabs: Overview | Activity | Billing History | Invoices | Payments
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Layers, Users, DollarSign, Calendar,
  Play, Pause, RotateCw, XCircle, Ban, AlertTriangle,
  Activity, CreditCard, FileText, Receipt, Clock,
  CheckCircle2, PauseCircle,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import {
  getSubscriptionById, activateSubscription, pauseSubscription,
  resumeSubscription, renewSubscription, closeSubscription, cancelSubscription,
} from '@/services/subscriptionApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type { SubscriptionDetail, SubscriptionStatus, ActivityItem } from '@/types/subscription';
import {
  SUBSCRIPTION_STATUS_CONFIG, BILLING_FREQUENCY_LABELS, formatMoney, fmtDate,
} from '@/types/subscription';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const cfg = SUBSCRIPTION_STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', cfg.bg, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Reason Dialog ─────────────────────────────────────────────────────────────

function ReasonDialog({
  open, onClose, title, description, confirmLabel, variant, loading, requireReason, onConfirm,
}: {
  open: boolean; onClose: () => void; title: string; description: string;
  confirmLabel: string; variant: 'danger' | 'primary' | 'warning';
  loading: boolean; requireReason: boolean; onConfirm: (r: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [err, setErr]       = useState('');
  useEffect(() => { if (!open) { setReason(''); setErr(''); } }, [open]);

  if (!open) return null;

  const btnCls = {
    danger:  'bg-red-600 hover:bg-red-700 text-white',
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  }[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
              variant === 'danger' ? 'bg-red-100' : variant === 'warning' ? 'bg-amber-100' : 'bg-indigo-100')}>
              <AlertTriangle className={cn('w-4 h-4', variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-amber-600' : 'text-indigo-600')} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>
          {requireReason && (
            <div>
              <label className="form-label">Reason <span className="text-red-500">*</span></label>
              <textarea rows={3} value={reason} onChange={e => { setReason(e.target.value); setErr(''); }}
                placeholder="Enter reason…" className={cn('form-input resize-none', err && 'border-red-400')} />
              {err && <p className="form-error">{err}</p>}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
          <button onClick={() => {
            if (requireReason && !reason.trim()) { setErr('Please provide a reason.'); return; }
            onConfirm(reason.trim());
          }} disabled={loading} className={cn('px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50', btnCls)}>
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Activity timeline ─────────────────────────────────────────────────────────

function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
  const actionIcon: Record<string, React.ElementType> = {
    created:   CheckCircle2, activated: Play, paused: PauseCircle,
    resumed:   Play, renewed: RotateCw, closed: XCircle,
    cancelled: Ban, updated: FileText, pending: Clock, expired: Clock,
  };
  const actionColor: Record<string, string> = {
    created:   'bg-indigo-100 text-indigo-600',
    activated: 'bg-emerald-100 text-emerald-600',
    paused:    'bg-blue-100 text-blue-600',
    resumed:   'bg-emerald-100 text-emerald-600',
    renewed:   'bg-violet-100 text-violet-600',
    closed:    'bg-slate-100 text-slate-500',
    cancelled: 'bg-red-100 text-red-600',
    updated:   'bg-slate-100 text-slate-500',
    pending:   'bg-yellow-100 text-yellow-600',
    expired:   'bg-amber-100 text-amber-600',
  };

  if (activities.length === 0) {
    return <p className="text-sm text-slate-400 italic text-center py-6">No activity recorded yet.</p>;
  }

  return (
    <div className="space-y-0">
      {activities.map((act, i) => {
        const Icon = actionIcon[act.action] || Activity;
        const cls  = actionColor[act.action] || 'bg-slate-100 text-slate-500';
        return (
          <div key={act.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', cls)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              {i < activities.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-800 capitalize">{act.action}</span>
                <span className="text-xs text-slate-400">{fmtDate(act.created_at)}</span>
              </div>
              {act.details && <p className="text-xs text-slate-500 mt-0.5">{act.details}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'activity' | 'billing' | 'invoices' | 'payments';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',        icon: Layers    },
  { id: 'activity',  label: 'Activity',         icon: Activity  },
  { id: 'billing',   label: 'Billing History',  icon: CreditCard },
  { id: 'invoices',  label: 'Invoices',         icon: Receipt   },
  { id: 'payments',  label: 'Payments',         icon: DollarSign },
];

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Clock className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{label} — Coming Soon</h3>
      <p className="text-sm text-slate-400 max-w-xs">This module is not yet implemented. It will appear here in a future release.</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type DialogType = 'activate' | 'pause' | 'resume' | 'renew' | 'close' | 'cancel' | null;

const DIALOG_CONFIG: Record<NonNullable<DialogType>, {
  title: string; description: string; confirmLabel: string;
  variant: 'danger' | 'primary' | 'warning'; requireReason: boolean;
}> = {
  activate: { title: 'Activate Subscription', description: 'Activate and set to Active status?', confirmLabel: 'Activate', variant: 'primary', requireReason: false },
  pause:    { title: 'Pause Subscription',    description: 'Pause this subscription. Provide a reason.', confirmLabel: 'Pause',    variant: 'warning', requireReason: true  },
  resume:   { title: 'Resume Subscription',   description: 'Resume this subscription from pause?', confirmLabel: 'Resume',   variant: 'primary', requireReason: false },
  renew:    { title: 'Renew Subscription',     description: 'Advance the next billing date by one cycle?', confirmLabel: 'Renew', variant: 'primary', requireReason: false },
  close:    { title: 'Close Subscription',     description: 'Permanently close this subscription. This cannot be reversed.', confirmLabel: 'Close', variant: 'danger', requireReason: true },
  cancel:   { title: 'Cancel Subscription',    description: 'Cancel this subscription. Provide a reason.', confirmLabel: 'Cancel', variant: 'danger', requireReason: true },
};

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [sub,       setSub]       = useState<SubscriptionDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [apiError,  setApiError]  = useState('');
  const [tab,       setTab]       = useState<TabId>('overview');
  const [dialog,    setDialog]    = useState<DialogType>(null);
  const [actioning, setActioning] = useState(false);

  const subId = Number(id);

  const fetchSub = useCallback(async () => {
    setLoading(true); setApiError('');
    try { setSub(await getSubscriptionById(subId)); }
    catch (err: any) {
      setApiError(err?.response?.status === 404 ? 'Subscription not found.' : getApiErrorMessage(err));
    } finally { setLoading(false); }
  }, [subId]);

  useEffect(() => { fetchSub(); }, [fetchSub]);

  const doAction = async (dialog: DialogType, reason: string) => {
    if (!sub || !dialog) return;
    setActioning(true);
    try {
      switch (dialog) {
        case 'activate': await activateSubscription(sub.id); break;
        case 'pause':    await pauseSubscription(sub.id, reason); break;
        case 'resume':   await resumeSubscription(sub.id); break;
        case 'renew':    await renewSubscription(sub.id); break;
        case 'close':    await closeSubscription(sub.id, reason); break;
        case 'cancel':   await cancelSubscription(sub.id, reason); break;
      }
      success('Done', `Subscription ${dialog}d successfully.`);
      setDialog(null);
      fetchSub();
    } catch (err) { toastError('Failed', getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  // ── Loading / Error ───────────────────────────────────────────────────────

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

  if (apiError || !sub) {
    return (
      <div className="p-6">
        <div className="card p-8 flex flex-col items-center text-center">
          <p className="text-sm text-slate-600 mb-4">{apiError || 'Not found.'}</p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/subscriptions')}>Back to Subscriptions</Button>
        </div>
      </div>
    );
  }

  const cfg     = SUBSCRIPTION_STATUS_CONFIG[sub.status];
  const s       = sub.status;

  return (
    <div className="space-y-6 p-6">
      {/* Back */}
      <Link to="/subscriptions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Subscriptions
      </Link>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{sub.subscription_number}</h1>
              <StatusBadge status={sub.status} />
            </div>
            <p className="text-sm text-slate-500">
              {sub.snap_plan_name || 'Unknown plan'}
              {sub.snap_product_name ? ` · ${sub.snap_product_name}` : ''}
              {' · '}
              {BILLING_FREQUENCY_LABELS[sub.billing_frequency] || sub.billing_frequency}
            </p>
          </div>
          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {(s === 'draft' || s === 'pending') && (
              <Button variant="primary" size="sm" leftIcon={Play} onClick={() => setDialog('activate')}>Activate</Button>
            )}
            {s === 'active' && sub.snap_pause_allowed && (
              <Button variant="secondary" size="sm" leftIcon={Pause} onClick={() => setDialog('pause')}>Pause</Button>
            )}
            {s === 'paused' && (
              <Button variant="primary" size="sm" leftIcon={Play} onClick={() => setDialog('resume')}>Resume</Button>
            )}
            {s === 'active' && sub.snap_renewal_allowed && (
              <Button variant="secondary" size="sm" leftIcon={RotateCw} onClick={() => setDialog('renew')}>Renew</Button>
            )}
            {s === 'active' && (
              <Button variant="danger" size="sm" leftIcon={XCircle} onClick={() => setDialog('close')}>Close</Button>
            )}
            {['draft','pending','active','paused'].includes(s) && (
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
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {/* Overview */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main 2/3 */}
            <div className="lg:col-span-2 space-y-6">

              {/* Customer */}
              {sub.customer && (
                <div className="card p-5">
                  <SectionTitle icon={Users} title="Customer" />
                  <div className="grid grid-cols-2 gap-3">
                    <InfoCard label="Name">{sub.customer.full_name}</InfoCard>
                    <InfoCard label="Email">{sub.customer.email}</InfoCard>
                    {sub.customer.company_name && <InfoCard label="Company">{sub.customer.company_name}</InfoCard>}
                    {sub.customer.phone        && <InfoCard label="Phone">{sub.customer.phone}</InfoCard>}
                  </div>
                </div>
              )}

              {/* Plan */}
              <div className="card p-5">
                <SectionTitle icon={Layers} title="Plan & Billing" />
                <div className="grid grid-cols-3 gap-3">
                  <InfoCard label="Plan">{sub.snap_plan_name || '—'}</InfoCard>
                  <InfoCard label="Product">{sub.snap_product_name || '—'}</InfoCard>
                  <InfoCard label="Billing Frequency">{BILLING_FREQUENCY_LABELS[sub.billing_frequency] || sub.billing_frequency}</InfoCard>
                  <InfoCard label="Quantity">{sub.quantity}</InfoCard>
                  <InfoCard label="Auto Renew">{sub.auto_renew ? '✓ Enabled' : '✗ Disabled'}</InfoCard>
                  <InfoCard label="Currency">{sub.currency}</InfoCard>
                </div>
              </div>

              {/* Lifecycle events */}
              {(sub.pause_reason || sub.closure_reason) && (
                <div className="card p-5">
                  <SectionTitle icon={AlertTriangle} title="Status Notes" />
                  {sub.pause_reason    && <div className="mb-2"><p className="text-xs text-slate-400 uppercase mb-1">Pause Reason</p><p className="text-sm text-slate-700">{sub.pause_reason}</p></div>}
                  {sub.closure_reason  && <div><p className="text-xs text-slate-400 uppercase mb-1">Closure/Cancellation Reason</p><p className="text-sm text-slate-700">{sub.closure_reason}</p></div>}
                </div>
              )}
            </div>

            {/* Right: Financial + Dates */}
            <div className="space-y-6">
              <div className="card p-5">
                <SectionTitle icon={DollarSign} title="Financial Details" />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-600"><span>Unit Price</span><span>{formatMoney(sub.unit_price, sub.currency)}</span></div>
                  <div className="flex justify-between text-sm text-slate-600"><span>Quantity</span><span>× {sub.quantity}</span></div>
                  <div className="flex justify-between text-sm text-slate-600"><span>Discount</span><span className="text-red-600">– {formatMoney(sub.discount_amount, sub.currency)}</span></div>
                  <div className="flex justify-between text-sm text-slate-600"><span>Tax</span><span>{formatMoney(sub.tax_amount, sub.currency)}</span></div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="flex justify-between font-bold text-base text-slate-900">
                    <span>Total</span>
                    <span className="text-indigo-700">{formatMoney(sub.total_amount, sub.currency)}</span>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <SectionTitle icon={Calendar} title="Timeline" />
                <div className="space-y-2">
                  {[
                    ['Start Date',       fmtDate(sub.start_date)],
                    ['End Date',         fmtDate(sub.end_date)],
                    ['Next Billing',     fmtDate(sub.next_billing_date)],
                    ['Created',          fmtDate(sub.created_at)],
                    ['Last Updated',     fmtDate(sub.updated_at)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs text-slate-500">
                      <span>{k}</span><span className="font-medium text-slate-700">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plan permissions */}
              <div className="card p-5">
                <SectionTitle icon={Layers} title="Plan Permissions" />
                <div className="space-y-2">
                  {[
                    ['Pause',         sub.snap_pause_allowed],
                    ['Renewal',       sub.snap_renewal_allowed],
                    ['Early Closure', sub.snap_early_closure_allowed],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between text-xs">
                      <span className="text-slate-500">{k as string}</span>
                      <span className={v ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                        {v ? '✓ Allowed' : '✗ Not Allowed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity tab */}
        {tab === 'activity' && (
          <div className="card p-6 max-w-2xl">
            <SectionTitle icon={Activity} title="Activity Timeline" />
            <ActivityTimeline activities={sub.activities} />
          </div>
        )}

        {/* Placeholder tabs */}
        {tab === 'billing'   && <div className="card p-6"><ComingSoonTab label="Billing History" /></div>}
        {tab === 'invoices'  && <div className="card p-6"><ComingSoonTab label="Invoices" /></div>}
        {tab === 'payments'  && <div className="card p-6"><ComingSoonTab label="Payments" /></div>}
      </div>

      {/* Lifecycle dialogs */}
      {dialog && (
        <ReasonDialog
          open={true} onClose={() => setDialog(null)} loading={actioning}
          onConfirm={r => doAction(dialog, r)}
          {...DIALOG_CONFIG[dialog]}
        />
      )}
    </div>
  );
}
