/**
 * REVORA – SubscriptionsPage
 * Full list with KPI cards, filters, sortable table, and lifecycle action dialogs.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers, CheckCircle2, PauseCircle, Clock, XCircle,
  Plus, Search, RefreshCw, X, MoreHorizontal,
  Eye, Play, Pause, RotateCw, Ban, ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { MetricCard } from '@/components/common/MetricCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getSubscriptions, getSubscriptionStats,
  activateSubscription, pauseSubscription, resumeSubscription,
  renewSubscription, closeSubscription, cancelSubscription,
} from '@/services/subscriptionApi';
import { getCustomers } from '@/services/customerApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type { Subscription, SubscriptionStatus, SubscriptionStats } from '@/types/subscription';
import {
  SUBSCRIPTION_STATUS_CONFIG, BILLING_FREQUENCY_LABELS, formatMoney, fmtDate,
} from '@/types/subscription';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const cfg = SUBSCRIPTION_STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', cfg.bg, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Lifecycle action dialog with reason input ─────────────────────────────────

function ReasonDialog({
  open, onClose, title, description, confirmLabel, variant, loading,
  requireReason, onConfirm,
}: {
  open:          boolean;
  onClose:       () => void;
  title:         string;
  description:   string;
  confirmLabel:  string;
  variant:       'danger' | 'primary' | 'warning';
  loading:       boolean;
  requireReason: boolean;
  onConfirm:     (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [err, setErr]       = useState('');

  useEffect(() => { if (!open) { setReason(''); setErr(''); } }, [open]);

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setErr('Please provide a reason.'); return;
    }
    onConfirm(reason.trim());
  };

  if (!open) return null;

  const btnClasses = {
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
              <AlertTriangle className={cn('w-4.5 h-4.5',
                variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-amber-600' : 'text-indigo-600')} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>
          {requireReason && (
            <div className="mt-2">
              <label className="form-label">Reason <span className="text-red-500">*</span></label>
              <textarea rows={3} value={reason} onChange={e => { setReason(e.target.value); setErr(''); }}
                placeholder="Enter reason…" className={cn('form-input resize-none', err && 'border-red-400')} />
              {err && <p className="form-error">{err}</p>}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={loading} className={cn('px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50', btnClasses)}>
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row actions ────────────────────────────────────────────────────────────────

type ActionType = 'activate' | 'pause' | 'resume' | 'renew' | 'close' | 'cancel';

function RowActions({ sub, onAction }: {
  sub:      Subscription;
  onAction: (sub: Subscription, action: ActionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const s = sub.status;

  const items: { label: string; action: ActionType; icon: React.ElementType; cls?: string }[] = [
    ...(s === 'draft' || s === 'pending' ? [{ label: 'Activate', action: 'activate' as ActionType, icon: Play }] : []),
    ...(s === 'active' && sub.snap_pause_allowed ? [{ label: 'Pause', action: 'pause' as ActionType, icon: Pause }] : []),
    ...(s === 'paused' ? [{ label: 'Resume', action: 'resume' as ActionType, icon: Play }] : []),
    ...(s === 'active' && sub.snap_renewal_allowed ? [{ label: 'Renew', action: 'renew' as ActionType, icon: RotateCw }] : []),
    ...(s === 'active' ? [{ label: 'Close', action: 'close' as ActionType, icon: XCircle, cls: 'text-red-600 hover:bg-red-50' }] : []),
    ...(['draft','pending','active','paused'].includes(s) ? [{ label: 'Cancel', action: 'cancel' as ActionType, icon: Ban, cls: 'text-red-600 hover:bg-red-50' }] : []),
  ];

  if (items.length === 0) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden animate-fade-in">
          <Link to={`/subscriptions/${sub.id}`} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <Eye className="w-3.5 h-3.5 text-slate-400" /> View
          </Link>
          {items.map(({ label, action, icon: Icon, cls }) => (
            <button key={action} onClick={() => { setOpen(false); onAction(sub, action); }}
              className={cn('w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors', cls || 'text-slate-700')}>
              <Icon className="w-3.5 h-3.5 opacity-60" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [subs,       setSubs]       = useState<Subscription[]>([]);
  const [stats,      setStats]      = useState<SubscriptionStats | null>(null);
  const [customers,  setCustomers]  = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [statsLoad,  setStatsLoad]  = useState(true);
  const [apiError,   setApiError]   = useState('');

  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState<SubscriptionStatus | ''>('');
  const [custId,    setCustId]    = useState<number | ''>('');
  const [billingFq, setBillingFq] = useState('');
  const [sortBy,    setSortBy]    = useState('created_at');
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('desc');
  const [page,      setPage]      = useState(1);
  const [limit,     setLimit]     = useState(10);

  const debouncedSearch = useDebounce(search, 400);

  // Lifecycle dialog state
  type DialogState = { sub: Subscription; action: ActionType } | null;
  const [dialog,    setDialog]    = useState<DialogState>(null);
  const [actioning, setActioning] = useState(false);

  const fetchSubs = useCallback(async () => {
    setLoading(true); setApiError('');
    try {
      const res = await getSubscriptions({
        search:            debouncedSearch || undefined,
        status:            status          || undefined,
        customer_id:       custId          || undefined,
        billing_frequency: billingFq       || undefined,
        sort_by: sortBy, sort_dir: sortDir,
        page, limit,
      });
      setSubs(res.subscriptions); setTotal(res.total); setTotalPages(res.total_pages);
    } catch (err) { setApiError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [debouncedSearch, status, custId, billingFq, sortBy, sortDir, page, limit]);

  const fetchStats = useCallback(async () => {
    setStatsLoad(true);
    try { setStats(await getSubscriptionStats()); }
    catch { /* non-critical */ }
    finally { setStatsLoad(false); }
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { getCustomers({ limit: 200 }).then(r => setCustomers(r.customers)).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [debouncedSearch, status, custId, billingFq]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
    setPage(1);
  };

  const handleAction = (sub: Subscription, action: ActionType) => setDialog({ sub, action });

  const handleConfirmAction = async (reason: string) => {
    if (!dialog) return;
    const { sub, action } = dialog;
    setActioning(true);
    try {
      switch (action) {
        case 'activate': await activateSubscription(sub.id);             break;
        case 'pause':    await pauseSubscription(sub.id, reason);        break;
        case 'resume':   await resumeSubscription(sub.id);               break;
        case 'renew':    await renewSubscription(sub.id);                break;
        case 'close':    await closeSubscription(sub.id, reason);        break;
        case 'cancel':   await cancelSubscription(sub.id, reason);       break;
      }
      success('Done', `Subscription ${sub.subscription_number} ${action}d.`);
      setDialog(null);
      fetchSubs(); fetchStats();
    } catch (err) { toastError('Failed', getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  const hasFilters = !!(search || status || custId || billingFq);
  const clearFilters = () => { setSearch(''); setStatus(''); setCustId(''); setBillingFq(''); setPage(1); };

  const dialogConfig: Record<ActionType, { title: string; description: string; confirmLabel: string; variant: 'danger'|'primary'|'warning'; requireReason: boolean }> = {
    activate: { title: 'Activate Subscription', description: 'Activate this subscription and set it to active status?', confirmLabel: 'Activate', variant: 'primary', requireReason: false },
    pause:    { title: 'Pause Subscription',    description: 'Pause this subscription. A reason is required.',          confirmLabel: 'Pause',    variant: 'warning', requireReason: true  },
    resume:   { title: 'Resume Subscription',   description: 'Resume this subscription from its paused state?',         confirmLabel: 'Resume',   variant: 'primary', requireReason: false },
    renew:    { title: 'Renew Subscription',     description: 'Advance the next billing date by one billing cycle?',    confirmLabel: 'Renew',    variant: 'primary', requireReason: false },
    close:    { title: 'Close Subscription',     description: 'Permanently close this subscription. A reason is required.', confirmLabel: 'Close', variant: 'danger', requireReason: true },
    cancel:   { title: 'Cancel Subscription',    description: 'Cancel this subscription. A reason is required.',        confirmLabel: 'Cancel',   variant: 'danger',  requireReason: true  },
  };

  const columns: Column<Subscription>[] = [
    {
      key: 'subscription_number', header: 'Sub. Number', sortable: true,
      render: s => <Link to={`/subscriptions/${s.id}`} className="text-sm font-mono font-medium text-indigo-600 hover:text-indigo-800">{s.subscription_number}</Link>,
    },
    {
      key: 'customer_id', header: 'Customer',
      render: s => {
        const c = customers.find(x => x.id === s.customer_id);
        return <span className="text-sm text-slate-700">{c ? c.full_name : `#${s.customer_id}`}</span>;
      },
    },
    {
      key: 'snap_plan_name', header: 'Plan',
      render: s => (
        <div>
          <p className="text-sm text-slate-800">{s.snap_plan_name || '—'}</p>
          {s.snap_product_name && <p className="text-xs text-slate-400">{s.snap_product_name}</p>}
        </div>
      ),
    },
    {
      key: 'start_date', header: 'Start Date', sortable: true,
      render: s => <span className="text-sm text-slate-600">{fmtDate(s.start_date)}</span>,
    },
    {
      key: 'next_billing_date', header: 'Next Billing',
      render: s => <span className="text-sm text-slate-600">{fmtDate(s.next_billing_date)}</span>,
    },
    {
      key: 'billing_frequency', header: 'Frequency',
      render: s => <span className="text-xs text-slate-500 font-medium">{BILLING_FREQUENCY_LABELS[s.billing_frequency] || s.billing_frequency}</span>,
    },
    {
      key: 'total_amount', header: 'Amount', sortable: true,
      render: s => <span className="text-sm font-semibold text-slate-900">{formatMoney(s.total_amount, s.currency)}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: s => <StatusBadge status={s.status} />,
    },
    {
      key: 'auto_renew', header: 'Auto Renew',
      render: s => (
        <span className={cn('text-xs font-semibold', s.auto_renew ? 'text-emerald-600' : 'text-slate-400')}>
          {s.auto_renew ? '✓ Yes' : '— No'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', align: 'right' as const,
      render: s => <RowActions sub={s} onAction={handleAction} />,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Subscriptions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Monitor and manage customer subscription lifecycles.</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => navigate('/subscriptions/new')}>
          Create Subscription
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Total"        value={stats ? String(stats.total)         : '—'} icon={Layers}       iconBg="bg-indigo-50"  iconColor="text-indigo-600"  loading={statsLoad} />
        <MetricCard label="Active"       value={stats ? String(stats.active)        : '—'} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" loading={statsLoad} />
        <MetricCard label="Paused"       value={stats ? String(stats.paused)        : '—'} icon={PauseCircle}  iconBg="bg-blue-50"    iconColor="text-blue-600"    loading={statsLoad} />
        <MetricCard label="Expiring Soon"value={stats ? String(stats.expiring_soon) : '—'} icon={Clock}        iconBg="bg-amber-50"   iconColor="text-amber-600"   loading={statsLoad} />
        <MetricCard label="Closed"       value={stats ? String(stats.closed)        : '—'} icon={XCircle}      iconBg="bg-slate-100"  iconColor="text-slate-500"   loading={statsLoad} />
      </div>

      {/* Table card */}
      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          {/* Search */}
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Search subscription or customer…" value={search}
              onChange={e => setSearch(e.target.value)} className="form-input pl-9 py-2 text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>}
          </div>

          {/* Status filter */}
          <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-input py-2 text-sm w-32">
            <option value="">All Status</option>
            {(['draft','pending','active','paused','expired','closed','cancelled'] as SubscriptionStatus[]).map(s => (
              <option key={s} value={s}>{SUBSCRIPTION_STATUS_CONFIG[s].label}</option>
            ))}
          </select>

          {/* Customer filter */}
          <select value={custId} onChange={e => setCustId(e.target.value ? Number(e.target.value) : '')} className="form-input py-2 text-sm w-44">
            <option value="">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>

          {/* Billing frequency filter */}
          <select value={billingFq} onChange={e => setBillingFq(e.target.value)} className="form-input py-2 text-sm w-36">
            <option value="">All Frequencies</option>
            {Object.entries(BILLING_FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {/* Page size */}
          <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="form-input py-2 text-sm w-24">
            <option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option>
          </select>

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}

          <div className="ml-auto">
            <button onClick={() => { fetchSubs(); fetchStats(); }} title="Refresh"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {apiError && !loading && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-700">{apiError}</p>
            <button onClick={fetchSubs} className="text-xs text-red-600 hover:underline font-medium">Retry</button>
          </div>
        )}

        <DataTable
          columns={columns} data={subs} keyExtractor={s => s.id}
          loading={loading} sort={{ field: sortBy, direction: sortDir }}
          onSort={handleSort}
          emptyTitle={hasFilters ? 'No subscriptions found' : 'No subscriptions yet'}
          emptyDescription={hasFilters ? 'Try adjusting your filters.' : 'Create your first subscription to get started.'}
        />

        {!loading && totalPages > 0 && (
          <div className="border-t border-slate-100 px-4">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={limit} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Lifecycle action dialog */}
      {dialog && (
        <ReasonDialog
          open={true} onClose={() => setDialog(null)}
          loading={actioning} onConfirm={handleConfirmAction}
          {...dialogConfig[dialog.action]}
        />
      )}
    </div>
  );
}
