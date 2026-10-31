/**
 * REVORA – DiscountsPage
 * Route: /discounts
 * KPI cards · filter toolbar · sortable table · action menu
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Tag, CheckCircle2, Clock, Archive, TrendingDown,
  Plus, Search, RefreshCw, X, MoreHorizontal, Eye, Pencil, Ban,
} from 'lucide-react';
import { MetricCard } from '@/components/common/MetricCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { getDiscounts, getDiscountStats, archiveDiscount, updateDiscount } from '@/services/discountApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type { Discount, DiscountStatus, DiscountStats } from '@/types/discount';
import {
  DISCOUNT_STATUS_CONFIG, formatDiscountValue, fmtDate, APPLICABLE_TO_LABELS,
} from '@/types/discount';

function StatusBadge({ status }: { status: DiscountStatus }) {
  const cfg = DISCOUNT_STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', cfg.bg, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function RowActions({ d, onDeactivate, onArchive }: {
  d: Discount;
  onDeactivate: (d: Discount) => void;
  onArchive:    (d: Discount) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden animate-fade-in">
          <Link to={`/discounts/${d.id}`}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <Eye className="w-3.5 h-3.5 opacity-60" /> View
          </Link>
          <Link to={`/discounts/${d.id}/edit`}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <Pencil className="w-3.5 h-3.5 opacity-60" /> Edit
          </Link>
          {d.status === 'active' && (
            <button onClick={() => { setOpen(false); onDeactivate(d); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-amber-600 hover:bg-amber-50">
              <Ban className="w-3.5 h-3.5" /> Deactivate
            </button>
          )}
          {d.status !== 'archived' && (
            <button onClick={() => { setOpen(false); onArchive(d); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-red-600 hover:bg-red-50">
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DiscountsPage() {
  const navigate = useNavigate();
  const { success, error: te } = useToast();

  const [discounts,  setDiscounts]  = useState<Discount[]>([]);
  const [stats,      setStats]      = useState<DiscountStats | null>(null);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [statsLoad,  setStatsLoad]  = useState(true);
  const [apiError,   setApiError]   = useState('');

  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState<DiscountStatus | ''>('');
  const [dtype,   setDtype]   = useState('');
  const [sortBy,  setSortBy]  = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [page,    setPage]    = useState(1);
  const [limit,   setLimit]   = useState(10);
  const dSearch = useDebounce(search, 400);

  type ConfirmType = { discount: Discount; action: 'deactivate' | 'archive' } | null;
  const [confirm,   setConfirm]   = useState<ConfirmType>(null);
  const [actioning, setActioning] = useState(false);

  const fetchDiscounts = useCallback(async () => {
    setLoading(true); setApiError('');
    try {
      const res = await getDiscounts({
        search: dSearch || undefined, status: status || undefined,
        discount_type: dtype || undefined,
        sort_by: sortBy, sort_dir: sortDir, page, limit,
      });
      setDiscounts(res.discounts); setTotal(res.total); setTotalPages(res.total_pages);
    } catch (err) { setApiError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [dSearch, status, dtype, sortBy, sortDir, page, limit]);

  const fetchStats = useCallback(async () => {
    setStatsLoad(true);
    try { setStats(await getDiscountStats()); } catch {}
    finally { setStatsLoad(false); }
  }, []);

  useEffect(() => { fetchDiscounts(); }, [fetchDiscounts]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(1); }, [dSearch, status, dtype]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setActioning(true);
    try {
      if (confirm.action === 'deactivate') {
        await updateDiscount(confirm.discount.id, { status: 'inactive' });
        success('Deactivated', 'Discount set to inactive.');
      } else {
        await archiveDiscount(confirm.discount.id);
        success('Archived', 'Discount archived.');
      }
      setConfirm(null); fetchDiscounts(); fetchStats();
    } catch (err) { te('Failed', getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  const hasFilters = !!(search || status || dtype);
  const clearFilters = () => { setSearch(''); setStatus(''); setDtype(''); setPage(1); };

  const columns: Column<Discount>[] = [
    {
      key: 'discount_name', header: 'Name', sortable: true,
      render: d => (
        <Link to={`/discounts/${d.id}`} className="text-sm font-semibold text-slate-800 hover:text-indigo-600">
          {d.discount_name}
        </Link>
      ),
    },
    {
      key: 'discount_code', header: 'Code',
      render: d => (
        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
          {d.discount_code}
        </span>
      ),
    },
    {
      key: 'discount_type', header: 'Type',
      render: d => (
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
          d.discount_type === 'percentage' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700')}>
          {d.discount_type === 'percentage' ? '%' : 'Fixed'}
        </span>
      ),
    },
    {
      key: 'discount_value', header: 'Value', sortable: true,
      render: d => <span className="text-sm font-bold text-indigo-700">{formatDiscountValue(d)}</span>,
    },
    {
      key: 'applicable_to', header: 'Applies To',
      render: d => <span className="text-xs text-slate-500">{APPLICABLE_TO_LABELS[d.applicable_to]}</span>,
    },
    {
      key: 'start_date', header: 'Validity',
      render: d => (
        <div className="text-xs text-slate-500">
          <div>{fmtDate(d.start_date)}</div>
          <div className="text-slate-400">→ {fmtDate(d.end_date)}</div>
        </div>
      ),
    },
    {
      key: 'usage_count', header: 'Usage', sortable: true,
      render: d => (
        <div className="text-xs text-center">
          <div className="font-semibold text-slate-800">{d.usage_count}</div>
          <div className="text-slate-400">{d.usage_limit != null ? `/ ${d.usage_limit}` : '∞'}</div>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: d => <StatusBadge status={d.status} />,
    },
    {
      key: 'actions', header: '', align: 'right' as const,
      render: d => (
        <RowActions
          d={d}
          onDeactivate={disc => setConfirm({ discount: disc, action: 'deactivate' })}
          onArchive={disc => setConfirm({ discount: disc, action: 'archive' })}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Discount Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create promotional offers and manage discount eligibility.</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => navigate('/discounts/new')}>
          Create Discount
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total"       value={stats ? String(stats.total)             : '—'} icon={Tag}          iconBg="bg-indigo-50"  iconColor="text-indigo-600"  loading={statsLoad} />
        <MetricCard label="Active"      value={stats ? String(stats.active)            : '—'} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" loading={statsLoad} />
        <MetricCard label="Expired"     value={stats ? String(stats.expired)           : '—'} icon={Clock}        iconBg="bg-amber-50"   iconColor="text-amber-600"   loading={statsLoad} />
        <MetricCard label="Redemptions" value={stats ? String(stats.total_redemptions) : '—'} icon={TrendingDown}  iconBg="bg-violet-50"  iconColor="text-violet-600"  loading={statsLoad} />
      </div>

      {/* Table Card */}
      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input placeholder="Search name or code…" value={search}
              onChange={e => setSearch(e.target.value)} className="form-input pl-9 py-2 text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-3 h-3" /></button>}
          </div>

          <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-input py-2 text-sm w-36">
            <option value="">All Status</option>
            {(['active','inactive','expired','archived'] as DiscountStatus[]).map(s => (
              <option key={s} value={s}>{DISCOUNT_STATUS_CONFIG[s].label}</option>
            ))}
          </select>

          <select value={dtype} onChange={e => setDtype(e.target.value)} className="form-input py-2 text-sm w-40">
            <option value="">All Types</option>
            <option value="percentage">Percentage</option>
            <option value="fixed_amount">Fixed Amount</option>
          </select>

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
            <button onClick={() => { fetchDiscounts(); fetchStats(); }} title="Refresh"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {apiError && !loading && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-700">{apiError}</p>
            <button onClick={fetchDiscounts} className="text-xs text-red-600 hover:underline font-medium">Retry</button>
          </div>
        )}

        <DataTable
          columns={columns} data={discounts} keyExtractor={d => d.id}
          loading={loading} sort={{ field: sortBy, direction: sortDir }} onSort={handleSort}
          emptyTitle={hasFilters ? 'No discounts found' : 'No discounts yet'}
          emptyDescription={hasFilters ? 'Try adjusting filters.' : 'Create your first promotional discount.'}
        />

        {!loading && totalPages > 0 && (
          <div className="border-t border-slate-100 px-4">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={limit} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          open={true}
          onOpenChange={o => { if (!o) setConfirm(null); }}
          loading={actioning}
          onConfirm={handleConfirm}
          title={confirm.action === 'deactivate' ? 'Deactivate Discount' : 'Archive Discount'}
          description={confirm.action === 'deactivate'
            ? `Deactivate "${confirm.discount.discount_name}"? It cannot be applied while inactive.`
            : `Archive "${confirm.discount.discount_name}"? This is a soft-delete and can be reviewed.`}
          confirmLabel={confirm.action === 'deactivate' ? 'Deactivate' : 'Archive'}
          variant={confirm.action === 'archive' ? 'danger' : 'primary'}
        />
      )}
    </div>
  );
}
