/**
 * REVORA – InvoicesPage
 * KPI cards · filter toolbar · sortable table · PDF download · Cancel · Run Billing
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Receipt, CheckCircle2, AlertCircle, XCircle, DollarSign,
  Plus, Search, RefreshCw, X, MoreHorizontal,
  Eye, FileDown, Ban, Play, Clock,
} from 'lucide-react';
import { MetricCard } from '@/components/common/MetricCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { getInvoices, getInvoiceStats, cancelInvoice, finalizeInvoice } from '@/services/invoiceApi';
import { runBilling, getBillingStatus } from '@/services/billingApi';
import { getCustomers } from '@/services/customerApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';
import type { Invoice, InvoiceStatus, InvoiceStats } from '@/types/invoice';
import { INVOICE_STATUS_CONFIG, formatMoney, fmtDate } from '@/types/invoice';

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = INVOICE_STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', cfg.bg, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

async function downloadPdf(invId: number, invNumber: string, token: string) {
  const base = (window as any).__REVORA_API_BASE__ || 'http://localhost:8000/api/v1';
  const res = await fetch(`${base}/invoices/${invId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('PDF download failed');
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${invNumber}.pdf`; a.click();
  URL.revokeObjectURL(url);
}

function RowActions({ inv, token, onAction }: {
  inv: Invoice; token: string;
  onAction: (inv: Invoice, action: 'cancel' | 'finalize') => void;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { success, error: te } = useToast();
  const s = inv.status;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden animate-fade-in">
          <Link to={`/invoices/${inv.id}`}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <Eye className="w-3.5 h-3.5 opacity-60" /> View
          </Link>
          {s === 'draft' && (
            <button onClick={() => { setOpen(false); onAction(inv, 'finalize'); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-emerald-700 hover:bg-emerald-50">
              <CheckCircle2 className="w-3.5 h-3.5" /> Finalize
            </button>
          )}
          <button disabled={downloading} onClick={async () => {
            setOpen(false); setDownloading(true);
            try { await downloadPdf(inv.id, inv.invoice_number, token); success('Downloaded', 'Invoice PDF saved.'); }
            catch { te('Failed', 'Could not download PDF.'); }
            finally { setDownloading(false); }
          }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <FileDown className="w-3.5 h-3.5 opacity-60" /> {downloading ? 'Downloading…' : 'Download PDF'}
          </button>
          {!['paid','cancelled'].includes(s) && (
            <button onClick={() => { setOpen(false); onAction(inv, 'cancel'); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-red-600 hover:bg-red-50">
              <Ban className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth() as any;
  const { success, error: te } = useToast();
  const isAdmin = user?.role === 'admin';

  const [invoices,   setInvoices]   = useState<Invoice[]>([]);
  const [stats,      setStats]      = useState<InvoiceStats | null>(null);
  const [customers,  setCustomers]  = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [statsLoad,  setStatsLoad]  = useState(true);
  const [apiError,   setApiError]   = useState('');

  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState<InvoiceStatus | ''>('');
  const [custId,   setCustId]   = useState<number | ''>('');
  const [sortBy,   setSortBy]   = useState('created_at');
  const [sortDir,  setSortDir]  = useState<'asc'|'desc'>('desc');
  const [page,     setPage]     = useState(1);
  const [limit,    setLimit]    = useState(10);

  const dSearch = useDebounce(search, 400);

  type ActionDialog = { inv: Invoice; action: 'cancel' | 'finalize' } | null;
  const [dialog,    setDialog]    = useState<ActionDialog>(null);
  const [actioning, setActioning] = useState(false);
  const [runningBilling, setRunningBilling] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true); setApiError('');
    try {
      const res = await getInvoices({
        search: dSearch || undefined, status: status || undefined,
        customer_id: custId || undefined,
        sort_by: sortBy, sort_dir: sortDir, page, limit,
      });
      setInvoices(res.invoices); setTotal(res.total); setTotalPages(res.total_pages);
    } catch (err) { setApiError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [dSearch, status, custId, sortBy, sortDir, page, limit]);

  const fetchStats = useCallback(async () => {
    setStatsLoad(true);
    try { setStats(await getInvoiceStats()); } catch {}
    finally { setStatsLoad(false); }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { getCustomers({ limit: 200 }).then(r => setCustomers(r.customers)).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [dSearch, status, custId]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const handleConfirm = async () => {
    if (!dialog) return;
    setActioning(true);
    try {
      if (dialog.action === 'cancel')   await cancelInvoice(dialog.inv.id);
      if (dialog.action === 'finalize') await finalizeInvoice(dialog.inv.id);
      success('Done', `Invoice ${dialog.action}d.`);
      setDialog(null); fetchInvoices(); fetchStats();
    } catch (err) { te('Failed', getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  const handleRunBilling = async () => {
    setRunningBilling(true);
    try {
      const res = await runBilling(false);
      success('Billing Complete', `${res.invoices_created} invoice(s) created, ${res.skipped} skipped.`);
      fetchInvoices(); fetchStats();
    } catch (err) { te('Billing Failed', getApiErrorMessage(err)); }
    finally { setRunningBilling(false); }
  };

  const hasFilters = !!(search || status || custId);
  const clearFilters = () => { setSearch(''); setStatus(''); setCustId(''); setPage(1); };

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number', header: 'Invoice #', sortable: true,
      render: inv => <Link to={`/invoices/${inv.id}`} className="font-mono text-sm font-medium text-indigo-600 hover:text-indigo-800">{inv.invoice_number}</Link>,
    },
    {
      key: 'customer_id', header: 'Customer',
      render: inv => {
        const c = customers.find(x => x.id === inv.customer_id);
        return <span className="text-sm text-slate-700">{c ? c.full_name : `#${inv.customer_id}`}</span>;
      },
    },
    {
      key: 'subscription_id', header: 'Subscription',
      render: inv => inv.subscription_id
        ? <Link to={`/subscriptions/${inv.subscription_id}`} className="text-xs text-slate-500 hover:text-indigo-600">#{inv.subscription_id}</Link>
        : <span className="text-xs text-slate-300">—</span>,
    },
    {
      key: 'invoice_date', header: 'Invoice Date', sortable: true,
      render: inv => <span className="text-sm text-slate-600">{fmtDate(inv.invoice_date)}</span>,
    },
    {
      key: 'due_date', header: 'Due Date',
      render: inv => <span className="text-sm text-slate-600">{fmtDate(inv.due_date)}</span>,
    },
    {
      key: 'total_amount', header: 'Total', sortable: true,
      render: inv => <span className="text-sm font-semibold text-slate-900">{formatMoney(inv.total_amount, inv.currency)}</span>,
    },
    {
      key: 'amount_paid', header: 'Paid',
      render: inv => <span className="text-sm text-emerald-600">{formatMoney(inv.amount_paid, inv.currency)}</span>,
    },
    {
      key: 'amount_due', header: 'Due',
      render: inv => <span className={cn('text-sm font-semibold', Number(inv.amount_due) > 0 ? 'text-red-600' : 'text-slate-400')}>{formatMoney(inv.amount_due, inv.currency)}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: inv => <StatusBadge status={inv.status} />,
    },
    {
      key: 'actions', header: '', align: 'right' as const,
      render: inv => <RowActions inv={inv} token={token || ''} onAction={(i, a) => setDialog({ inv: i, action: a })} />,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage recurring billing, customer invoices, and outstanding balances.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="secondary" size="sm" leftIcon={Play} onClick={handleRunBilling} loading={runningBilling}>
              Run Billing
            </Button>
          )}
          <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => navigate('/invoices/new')}>
            Create Invoice
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Total"       value={stats ? String(stats.total)   : '—'} icon={Receipt}      iconBg="bg-indigo-50"  iconColor="text-indigo-600"  loading={statsLoad} />
        <MetricCard label="Paid"        value={stats ? String(stats.paid)    : '—'} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" loading={statsLoad} />
        <MetricCard label="Unpaid"      value={stats ? String(stats.unpaid)  : '—'} icon={Clock}        iconBg="bg-amber-50"   iconColor="text-amber-600"   loading={statsLoad} />
        <MetricCard label="Overdue"     value={stats ? String(stats.overdue) : '—'} icon={AlertCircle}  iconBg="bg-red-50"     iconColor="text-red-600"     loading={statsLoad} />
        <MetricCard label="Outstanding" value={stats ? formatMoney(stats.total_outstanding) : '—'} icon={DollarSign} iconBg="bg-violet-50" iconColor="text-violet-600" loading={statsLoad} />
      </div>

      {/* Table Card */}
      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input placeholder="Search invoice or customer…" value={search}
              onChange={e => setSearch(e.target.value)} className="form-input pl-9 py-2 text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-3 h-3" /></button>}
          </div>

          <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-input py-2 text-sm w-36">
            <option value="">All Status</option>
            {(['draft','unpaid','partially_paid','paid','overdue','cancelled'] as InvoiceStatus[]).map(s => (
              <option key={s} value={s}>{INVOICE_STATUS_CONFIG[s].label}</option>
            ))}
          </select>

          <select value={custId} onChange={e => setCustId(e.target.value ? Number(e.target.value) : '')} className="form-input py-2 text-sm w-44">
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
            <button onClick={() => { fetchInvoices(); fetchStats(); }} title="Refresh"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {apiError && !loading && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-700">{apiError}</p>
            <button onClick={fetchInvoices} className="text-xs text-red-600 hover:underline font-medium">Retry</button>
          </div>
        )}

        <DataTable
          columns={columns} data={invoices} keyExtractor={inv => inv.id}
          loading={loading} sort={{ field: sortBy, direction: sortDir }} onSort={handleSort}
          emptyTitle={hasFilters ? 'No invoices found' : 'No invoices yet'}
          emptyDescription={hasFilters ? 'Try adjusting filters.' : 'Create your first invoice or run billing.'}
        />

        {!loading && totalPages > 0 && (
          <div className="border-t border-slate-100 px-4">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={limit} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Confirm dialogs */}
      {dialog && (
        <ConfirmDialog
          open={true}
          onOpenChange={open => { if (!open) setDialog(null); }}
          loading={actioning}
          onConfirm={handleConfirm}
          title={dialog.action === 'cancel' ? 'Cancel Invoice' : 'Finalize Invoice'}
          description={dialog.action === 'cancel'
            ? `Cancel invoice ${dialog.inv.invoice_number}? This cannot be undone.`
            : `Finalize invoice ${dialog.inv.invoice_number} and set it to Unpaid?`}
          confirmLabel={dialog.action === 'cancel' ? 'Cancel Invoice' : 'Finalize'}
          variant={dialog.action === 'cancel' ? 'danger' : 'primary'}
        />
      )}
    </div>
  );
}
