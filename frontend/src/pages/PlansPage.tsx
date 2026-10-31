/**
 * REVORA – PlansPage
 * Subscription plan management with KPI cards, filter toolbar,
 * sortable table, server-side pagination, and action dialogs.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutList, CheckCircle2, XCircle, Archive, Plus, Search,
  RefreshCw, MoreHorizontal, Edit3, EyeOff, Eye, X, TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MetricCard } from '@/components/common/MetricCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PlanFormDialog } from '@/components/plans/PlanFormDialog';
import { useToast } from '@/components/common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { getPlans, getPlanStats, archivePlan } from '@/services/planApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type { SubscriptionPlan, PlanStatus, BillingFrequency, PlanStats } from '@/types/plan';
import {
  BILLING_FREQUENCY_LABELS, PLAN_STATUS_COLORS, BILLING_FREQUENCY_COLORS,
} from '@/types/plan';

// ── Badge helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PlanStatus }) {
  const s = PLAN_STATUS_COLORS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', s.bg, s.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function FreqBadge({ freq }: { freq: BillingFrequency }) {
  const s = BILLING_FREQUENCY_COLORS[freq];
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', s.bg, s.text)}>
      {BILLING_FREQUENCY_LABELS[freq]}
    </span>
  );
}

function formatPrice(price: string, currency: string) {
  return `${currency} ${Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// ── Row actions ───────────────────────────────────────────────────────────────

function RowActions({
  plan, onEdit, onArchive,
}: { plan: SubscriptionPlan; onEdit: (p: SubscriptionPlan) => void; onArchive: (p: SubscriptionPlan) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden animate-fade-in">
          <Link to={`/plans/${plan.id}`} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
            <Eye className="w-3.5 h-3.5 text-slate-400" /> View Details
          </Link>
          {plan.status !== 'archived' && (
            <button onClick={() => { setOpen(false); onEdit(plan); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left">
              <Edit3 className="w-3.5 h-3.5 text-slate-400" /> Edit
            </button>
          )}
          {plan.status !== 'archived' && (
            <button onClick={() => { setOpen(false); onArchive(plan); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 transition-colors text-left">
              <EyeOff className="w-3.5 h-3.5" /> Archive
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const { success, error: toastError } = useToast();

  const [plans,        setPlans]        = useState<SubscriptionPlan[]>([]);
  const [stats,        setStats]        = useState<PlanStats | null>(null);
  const [total,        setTotal]        = useState(0);
  const [totalPages,   setTotalPages]   = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [apiError,     setApiError]     = useState('');

  const [search,     setSearch]     = useState('');
  const [freqFilter, setFreqFilter] = useState<BillingFrequency | ''>('');
  const [statusFilter, setStatusFilter] = useState<PlanStatus | ''>('');
  const [sortBy,     setSortBy]     = useState('created_at');
  const [sortDir,    setSortDir]    = useState<'asc' | 'desc'>('desc');
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(10);

  const debouncedSearch = useDebounce(search, 400);

  const [formOpen,      setFormOpen]      = useState(false);
  const [editTarget,    setEditTarget]    = useState<SubscriptionPlan | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<SubscriptionPlan | null>(null);
  const [archiving,     setArchiving]     = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true); setApiError('');
    try {
      const res = await getPlans({
        search:            debouncedSearch || undefined,
        billing_frequency: freqFilter      || undefined,
        status:            statusFilter    || undefined,
        sort_by:           sortBy,
        sort_dir:          sortDir,
        page, limit,
      });
      setPlans(res.plans);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    } finally { setLoading(false); }
  }, [debouncedSearch, freqFilter, statusFilter, sortBy, sortDir, page, limit]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await getPlanStats()); }
    catch { /* non-critical */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(1); }, [debouncedSearch, freqFilter, statusFilter]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
    setPage(1);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archivePlan(archiveTarget.id);
      success('Plan archived', `"${archiveTarget.plan_name}" has been archived.`);
      setArchiveTarget(null);
      fetchPlans(); fetchStats();
    } catch (err) {
      toastError('Failed to archive', getApiErrorMessage(err));
    } finally { setArchiving(false); }
  };

  const popularFreq = stats?.most_popular_frequency
    ? BILLING_FREQUENCY_LABELS[stats.most_popular_frequency]
    : '—';

  const columns: Column<SubscriptionPlan>[] = [
    {
      key: 'plan_name', header: 'Plan Name', sortable: true,
      render: (p) => (
        <div>
          <Link to={`/plans/${p.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors">
            {p.plan_name}
          </Link>
        </div>
      ),
    },
    {
      key: 'plan_code', header: 'Code',
      render: (p) => <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded-md">{p.plan_code}</span>,
    },
    {
      key: 'billing_frequency', header: 'Frequency',
      render: (p) => <FreqBadge freq={p.billing_frequency} />,
    },
    {
      key: 'billing_interval', header: 'Interval',
      render: (p) => <span className="text-sm text-slate-600">Every {p.billing_interval} {BILLING_FREQUENCY_LABELS[p.billing_frequency].toLowerCase().replace('-yearly', '').replace('-', ' ')}</span>,
    },
    {
      key: 'plan_price', header: 'Plan Price', sortable: true,
      render: (p) => (
        <div>
          <span className="text-sm font-semibold text-slate-900">{formatPrice(p.plan_price, p.currency)}</span>
          {Number(p.tax_percentage) > 0 && <span className="text-xs text-slate-400 ml-1">+{p.tax_percentage}%</span>}
        </div>
      ),
    },
    {
      key: 'trial_period_days', header: 'Trial',
      render: (p) => (
        <span className="text-sm text-slate-600">
          {p.trial_period_days > 0 ? `${p.trial_period_days} days` : <span className="text-slate-300">None</span>}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'actions', header: '', align: 'right' as const,
      render: (p) => (
        <RowActions
          plan={p}
          onEdit={plan => { setEditTarget(plan); setFormOpen(true); }}
          onArchive={plan => setArchiveTarget(plan)}
        />
      ),
    },
  ];

  const hasFilters = !!(search || freqFilter || statusFilter);
  const clearFilters = () => { setSearch(''); setFreqFilter(''); setStatusFilter(''); setPage(1); };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Subscription Plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create and manage flexible subscription plans for your products.
          </p>
        </div>
        <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => { setEditTarget(null); setFormOpen(true); }}>
          Add Subscription Plan
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Plans"    value={stats ? String(stats.total)    : '—'} icon={LayoutList}   iconBg="bg-indigo-50"  iconColor="text-indigo-600"  loading={statsLoading} />
        <MetricCard label="Active Plans"   value={stats ? String(stats.active)   : '—'} icon={CheckCircle2}  iconBg="bg-emerald-50" iconColor="text-emerald-600" loading={statsLoading} />
        <MetricCard label="Inactive Plans" value={stats ? String(stats.inactive) : '—'} icon={XCircle}       iconBg="bg-slate-100"  iconColor="text-slate-500"   loading={statsLoading} />
        <MetricCard label="Top Frequency"  value={popularFreq}                          icon={TrendingUp}    iconBg="bg-violet-50"  iconColor="text-violet-600"  loading={statsLoading} />
      </div>

      {/* Table card */}
      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          {/* Search */}
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text" placeholder="Search plan name, code…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="form-input pl-9 py-2 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
            )}
          </div>

          {/* Billing frequency filter */}
          <select value={freqFilter} onChange={e => setFreqFilter(e.target.value as BillingFrequency | '')} className="form-input py-2 text-sm w-36">
            <option value="">All Frequencies</option>
            {Object.entries(BILLING_FREQUENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as PlanStatus | '')} className="form-input py-2 text-sm w-28">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>

          {/* Page size */}
          <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="form-input py-2 text-sm w-24">
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}

          <div className="ml-auto">
            <button
              onClick={() => { fetchPlans(); fetchStats(); }}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {apiError && !loading && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-700">{apiError}</p>
            <button onClick={fetchPlans} className="text-xs text-red-600 hover:underline font-medium">Retry</button>
          </div>
        )}

        <DataTable
          columns={columns} data={plans}
          keyExtractor={p => p.id} loading={loading}
          sort={{ field: sortBy, direction: sortDir }} onSort={handleSort}
          emptyTitle={hasFilters ? 'No plans found' : 'No subscription plans yet'}
          emptyDescription={hasFilters ? 'Try adjusting your filters.' : 'Create your first subscription plan to get started.'}
        />

        {!loading && totalPages > 0 && (
          <div className="border-t border-slate-100 px-4">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={limit} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Dialogs */}
      <PlanFormDialog
        open={formOpen} onOpenChange={setFormOpen}
        plan={editTarget as any}
        onSuccess={() => { fetchPlans(); fetchStats(); }}
      />
      <ConfirmDialog
        open={Boolean(archiveTarget)} onOpenChange={o => !o && setArchiveTarget(null)}
        title="Archive Plan"
        description={`"${archiveTarget?.plan_name}" will be archived. Existing subscriptions referencing this plan will not be affected. This action is reversible.`}
        confirmLabel="Archive" variant="danger"
        loading={archiving} onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}
