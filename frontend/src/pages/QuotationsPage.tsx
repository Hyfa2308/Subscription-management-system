/**
 * REVORA – QuotationsPage
 * List page with KPI cards, filters, table, pagination.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, CheckCircle2, Send, Clock, X,
  Plus, Search, RefreshCw, MoreHorizontal,
  Eye, Edit3, Trash2, LayoutList, BookOpen,
} from 'lucide-react';
import { MetricCard } from '@/components/common/MetricCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { getQuotations, getQuotationStats, sendQuotation, deleteQuotation } from '@/services/quotationApi';
import { getCustomers } from '@/services/customerApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type { Quotation, QuotationStats, QuotationStatus } from '@/types/quotation';
import { QUOTATION_STATUS_CONFIG, formatMoney } from '@/types/quotation';

// ── Badge ──────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: QuotationStatus }) {
  const s = QUOTATION_STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', s.bg, s.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

// ── Row actions ────────────────────────────────────────────────────────────────

function RowActions({ q, onSend, onDelete }: {
  q: Quotation;
  onSend:   (q: Quotation) => void;
  onDelete: (q: Quotation) => void;
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
          <Link to={`/quotations/${q.id}`} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
            <Eye className="w-3.5 h-3.5 text-slate-400" /> View
          </Link>
          {q.status === 'draft' && (
            <Link to={`/quotations/${q.id}/edit`} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <Edit3 className="w-3.5 h-3.5 text-slate-400" /> Edit
            </Link>
          )}
          {q.status === 'draft' && (
            <button onClick={() => { setOpen(false); onSend(q); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors text-left">
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          )}
          {['draft', 'cancelled'].includes(q.status) && (
            <button onClick={() => { setOpen(false); onDelete(q); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuotationsPage() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [stats,      setStats]      = useState<QuotationStats | null>(null);
  const [customers,  setCustomers]  = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [statsLoad,  setStatsLoad]  = useState(true);
  const [apiError,   setApiError]   = useState('');

  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState<QuotationStatus | ''>('');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [sortBy,     setSortBy]     = useState('created_at');
  const [sortDir,    setSortDir]    = useState<'asc' | 'desc'>('desc');
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(10);

  const debouncedSearch = useDebounce(search, 400);

  const [sendTarget,   setSendTarget]   = useState<Quotation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [actioning, setActioning] = useState(false);

  const fetchQuotations = useCallback(async () => {
    setLoading(true); setApiError('');
    try {
      const res = await getQuotations({
        search:      debouncedSearch || undefined,
        status:      status          || undefined,
        customer_id: customerId      || undefined,
        sort_by:     sortBy, sort_dir: sortDir,
        page, limit,
      });
      setQuotations(res.quotations);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) { setApiError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [debouncedSearch, status, customerId, sortBy, sortDir, page, limit]);

  const fetchStats = useCallback(async () => {
    setStatsLoad(true);
    try { setStats(await getQuotationStats()); }
    catch { /* non-critical */ }
    finally { setStatsLoad(false); }
  }, []);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { getCustomers({ limit: 200 }).then(r => setCustomers(r.customers)).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [debouncedSearch, status, customerId]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
    setPage(1);
  };

  const handleSendConfirm = async () => {
    if (!sendTarget) return;
    setActioning(true);
    try {
      await sendQuotation(sendTarget.id);
      success('Sent', `${sendTarget.quotation_number} has been sent.`);
      setSendTarget(null);
      fetchQuotations(); fetchStats();
    } catch (err) { toastError('Failed', getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setActioning(true);
    try {
      await deleteQuotation(deleteTarget.id);
      success('Deleted', `${deleteTarget.quotation_number} has been deleted.`);
      setDeleteTarget(null);
      fetchQuotations(); fetchStats();
    } catch (err) { toastError('Failed', getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  const hasFilters = !!(search || status || customerId);
  const clearFilters = () => { setSearch(''); setStatus(''); setCustomerId(''); setPage(1); };

  const columns: Column<Quotation>[] = [
    {
      key: 'quotation_number', header: 'Quotation No.', sortable: true,
      render: q => <Link to={`/quotations/${q.id}`} className="text-sm font-mono font-medium text-indigo-600 hover:text-indigo-800">{q.quotation_number}</Link>,
    },
    {
      key: 'customer_id', header: 'Customer',
      render: q => {
        const c = customers.find(x => x.id === q.customer_id);
        return <span className="text-sm text-slate-700">{c ? c.full_name : `#${q.customer_id}`}</span>;
      },
    },
    {
      key: 'quotation_date', header: 'Date', sortable: true,
      render: q => <span className="text-sm text-slate-600">{new Date(q.quotation_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>,
    },
    {
      key: 'expiry_date', header: 'Expires',
      render: q => q.expiry_date
        ? <span className="text-sm text-slate-600">{new Date(q.expiry_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        : <span className="text-slate-300 text-sm">—</span>,
    },
    {
      key: 'total_amount', header: 'Total', sortable: true,
      render: q => <span className="text-sm font-semibold text-slate-900">{formatMoney(q.total_amount, q.currency)}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: q => <StatusBadge status={q.status} />,
    },
    {
      key: 'actions', header: '', align: 'right' as const,
      render: q => <RowActions q={q} onSend={setSendTarget} onDelete={setDeleteTarget} />,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quotations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create, manage, and track customer quotations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={BookOpen} onClick={() => navigate('/quotation-templates')}>
            Templates
          </Button>
          <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => navigate('/quotations/new')}>
            Create Quotation
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Total"    value={stats ? String(stats.total)    : '—'} icon={FileText}     iconBg="bg-indigo-50"  iconColor="text-indigo-600"  loading={statsLoad} />
        <MetricCard label="Draft"    value={stats ? String(stats.draft)    : '—'} icon={LayoutList}   iconBg="bg-slate-100"  iconColor="text-slate-500"   loading={statsLoad} />
        <MetricCard label="Sent"     value={stats ? String(stats.sent)     : '—'} icon={Send}         iconBg="bg-blue-50"    iconColor="text-blue-600"    loading={statsLoad} />
        <MetricCard label="Accepted" value={stats ? String(stats.accepted) : '—'} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" loading={statsLoad} />
        <MetricCard label="Expired"  value={stats ? String(stats.expired)  : '—'} icon={Clock}        iconBg="bg-amber-50"   iconColor="text-amber-600"   loading={statsLoad} />
      </div>

      {/* Table card */}
      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Search quotation or customer…" value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9 py-2 text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>}
          </div>
          <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-input py-2 text-sm w-32">
            <option value="">All Status</option>
            {(['draft','sent','accepted','rejected','expired','cancelled'] as QuotationStatus[]).map(s => (
              <option key={s} value={s}>{QUOTATION_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          <select value={customerId} onChange={e => setCustomerId(e.target.value ? Number(e.target.value) : '')} className="form-input py-2 text-sm w-44">
            <option value="">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="form-input py-2 text-sm w-24">
            <option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <div className="ml-auto">
            <button onClick={() => { fetchQuotations(); fetchStats(); }} title="Refresh"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {apiError && !loading && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-700">{apiError}</p>
            <button onClick={fetchQuotations} className="text-xs text-red-600 hover:underline font-medium">Retry</button>
          </div>
        )}

        <DataTable
          columns={columns} data={quotations} keyExtractor={q => q.id}
          loading={loading} sort={{ field: sortBy, direction: sortDir }}
          onSort={handleSort}
          emptyTitle={hasFilters ? 'No quotations found' : 'No quotations yet'}
          emptyDescription={hasFilters ? 'Try adjusting your filters.' : 'Create your first quotation to get started.'}
        />

        {!loading && totalPages > 0 && (
          <div className="border-t border-slate-100 px-4">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={limit} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={Boolean(sendTarget)} onOpenChange={o => !o && setSendTarget(null)}
        title="Send Quotation"
        description={`Send "${sendTarget?.quotation_number}" to the customer? The status will change to Sent.`}
        confirmLabel="Send" variant="primary" loading={actioning} onConfirm={handleSendConfirm}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)} onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Quotation"
        description={`Delete "${deleteTarget?.quotation_number}"? This cannot be undone.`}
        confirmLabel="Delete" variant="danger" loading={actioning} onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
