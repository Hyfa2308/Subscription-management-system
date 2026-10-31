/**
 * REVORA – CustomersPage
 * Full customer management page: KPI cards, search, filter, sortable table,
 * server-side pagination, add/edit/archive actions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Users, UserCheck, UserX, UserPlus, Plus, Search, RefreshCw,
  MoreHorizontal, Edit3, Archive, Eye, X, Filter,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MetricCard } from '@/components/common/MetricCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog';
import { useToast } from '@/components/common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { getCustomers, getCustomerStats, archiveCustomer, changeCustomerStatus } from '@/services/customerApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { ROUTES } from '@/config/routes';
import { cn } from '@/utils/cn';
import type { Customer, CustomerFilters, CustomerStats, CustomerStatus } from '@/types/customer';
import { STATUS_COLORS } from '@/types/customer';

// ── Status badge ───────────────────────────────────────────────────────────────

function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const s = STATUS_COLORS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', s.bg, s.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Avatar with initials ───────────────────────────────────────────────────────

function CustomerAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const colors = [
    'bg-indigo-500', 'bg-teal-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500',
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0', color)}>
      {initials || '?'}
    </div>
  );
}

// ── Row actions dropdown ───────────────────────────────────────────────────────

function RowActions({
  customer,
  onEdit,
  onArchive,
}: {
  customer: Customer;
  onEdit: (c: Customer) => void;
  onArchive: (c: Customer) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden animate-fade-in">
          <Link
            to={`/customers/${customer.id}`}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            View Details
          </Link>
          <button
            onClick={() => { setOpen(false); onEdit(customer); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
            Edit
          </button>
          {customer.status !== 'archived' && (
            <button
              onClick={() => { setOpen(false); onArchive(customer); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const { success, error: toastError } = useToast();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [stats,       setStats]       = useState<CustomerStats | null>(null);
  const [total,       setTotal]       = useState(0);
  const [totalPages,  setTotalPages]  = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [statsLoading,setStatsLoading]= useState(true);
  const [apiError,    setApiError]    = useState('');

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState<CustomerStatus | ''>('');
  const [sortBy,    setSortBy]    = useState('created_at');
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('desc');
  const [page,      setPage]      = useState(1);
  const [limit,     setLimit]     = useState(10);

  const debouncedSearch = useDebounce(search, 400);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [formOpen,    setFormOpen]    = useState(false);
  const [editTarget,  setEditTarget]  = useState<Customer | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);
  const [archiving,   setArchiving]   = useState(false);

  // ── Fetch customers ──────────────────────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await getCustomers({
        search:   debouncedSearch || undefined,
        status:   status         || undefined,
        sort_by:  sortBy,
        sort_dir: sortDir,
        page,
        limit,
      });
      setCustomers(res.customers);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, sortBy, sortDir, page, limit]);

  // ── Fetch stats ──────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await getCustomerStats();
      setStats(s);
    } catch {
      // Stats are non-critical — fail silently
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  // ── Sort toggle ──────────────────────────────────────────────────────────────
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  // ── Archive ──────────────────────────────────────────────────────────────────
  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveCustomer(archiveTarget.id);
      success('Customer archived', `${archiveTarget.full_name} has been archived.`);
      setArchiveTarget(null);
      fetchCustomers();
      fetchStats();
    } catch (err) {
      toastError('Archive failed', getApiErrorMessage(err));
    } finally {
      setArchiving(false);
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns: Column<Customer>[] = [
    {
      key: 'full_name', header: 'Customer', sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <CustomerAvatar name={c.full_name} />
          <div>
            <Link
              to={`/customers/${c.id}`}
              className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors"
            >
              {c.full_name}
            </Link>
            <p className="text-xs text-slate-400 font-mono">{c.customer_code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'company_name', header: 'Company',
      render: (c) => (
        <span className="text-sm text-slate-600">{c.company_name || <span className="text-slate-300">—</span>}</span>
      ),
    },
    {
      key: 'email', header: 'Email',
      render: (c) => <span className="text-sm text-slate-600">{c.email}</span>,
    },
    {
      key: 'phone', header: 'Phone',
      render: (c) => (
        <span className="text-sm text-slate-600">{c.phone || <span className="text-slate-300">—</span>}</span>
      ),
    },
    {
      key: 'customer_code', header: 'Code',
      render: (c) => (
        <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded-md">{c.customer_code}</span>
      ),
    },
    {
      key: 'registration_date', header: 'Registered', sortable: true,
      render: (c) => (
        <span className="text-sm text-slate-600">
          {new Date(c.registration_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (c) => <CustomerStatusBadge status={c.status} />,
    },
    {
      key: 'actions', header: '', align: 'right' as const,
      render: (c) => (
        <RowActions
          customer={c}
          onEdit={(cust) => { setEditTarget(cust); setFormOpen(true); }}
          onArchive={(cust) => setArchiveTarget(cust)}
        />
      ),
    },
  ];

  const hasFilters = !!search || !!status;

  return (
    <div className="space-y-6 p-6">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage customer profiles, relationships, and subscription activity.
          </p>
        </div>
        <Button
          variant="primary" size="sm"
          leftIcon={Plus}
          onClick={() => { setEditTarget(null); setFormOpen(true); }}
        >
          Add Customer
        </Button>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Customers" value={stats ? String(stats.total) : '—'}
          icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-600"
          loading={statsLoading}
        />
        <MetricCard
          label="Active" value={stats ? String(stats.active) : '—'}
          icon={UserCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          loading={statsLoading}
        />
        <MetricCard
          label="Inactive" value={stats ? String(stats.inactive) : '—'}
          icon={UserX} iconBg="bg-amber-50" iconColor="text-amber-600"
          loading={statsLoading}
        />
        <MetricCard
          label="New This Month" value={stats ? String(stats.new_this_month) : '—'}
          icon={UserPlus} iconBg="bg-teal-50" iconColor="text-teal-600"
          loading={statsLoading}
          note="Current month"
        />
      </div>

      {/* ── Table card ───────────────────────────────────────────────────── */}
      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1 w-full">
            {/* Search */}
            <div className="relative flex-1 min-w-0 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, email, company…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input pl-9 py-2 text-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <select
              value={status}
              onChange={e => setStatus(e.target.value as CustomerStatus | '')}
              className="form-input py-2 text-sm w-36"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>

            {/* Page size */}
            <select
              value={limit}
              onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
              className="form-input py-2 text-sm w-24"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setStatus(''); setPage(1); }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 whitespace-nowrap"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => { fetchCustomers(); fetchStats(); }}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
            title="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* API Error */}
        {apiError && !loading && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-700">{apiError}</p>
            <button onClick={fetchCustomers} className="text-xs text-red-600 hover:underline font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <DataTable
          columns={columns}
          data={customers}
          keyExtractor={(c) => c.id}
          loading={loading}
          sort={{ field: sortBy, direction: sortDir }}
          onSort={handleSort}
          emptyTitle={hasFilters ? 'No results found' : 'No customers yet'}
          emptyDescription={
            hasFilters
              ? 'Try adjusting your search or filter criteria.'
              : 'Add your first customer to get started.'
          }
        />

        {/* Pagination */}
        {!loading && totalPages > 0 && (
          <div className="border-t border-slate-100 px-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={limit}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* ── Customer Form Dialog ─────────────────────────────────────────── */}
      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editTarget}
        onSuccess={() => { fetchCustomers(); fetchStats(); }}
      />

      {/* ── Archive Confirmation ─────────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Archive Customer"
        description={`Are you sure you want to archive ${archiveTarget?.full_name}? They will not be available for new business transactions unless restored by an administrator.`}
        confirmLabel="Archive"
        variant="danger"
        loading={archiving}
        onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}
