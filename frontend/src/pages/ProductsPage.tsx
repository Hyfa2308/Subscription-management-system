/**
 * REVORA – ProductsPage
 * Full product management page: KPI cards, search, filters, sortable table,
 * server-side pagination, add/edit/deactivate actions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Package, PackageCheck, PackageX, Repeat2, Plus, Search, RefreshCw,
  MoreHorizontal, Edit3, EyeOff, Eye, X, Layers,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MetricCard } from '@/components/common/MetricCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';
import { useToast } from '@/components/common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getProducts, getProductStats, deactivateProduct,
} from '@/services/productApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type {
  Product, ProductFilters, ProductStats, ProductType, BillingType,
} from '@/types/product';
import {
  PRODUCT_TYPE_LABELS, BILLING_TYPE_LABELS,
  PRODUCT_TYPE_COLORS, BILLING_TYPE_COLORS,
} from '@/types/product';

// ── Badge helpers ─────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ProductType }) {
  const s = PRODUCT_TYPE_COLORS[type];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', s.bg, s.text)}>
      {PRODUCT_TYPE_LABELS[type]}
    </span>
  );
}

function BillingBadge({ type }: { type: BillingType }) {
  const s = BILLING_TYPE_COLORS[type];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', s.bg, s.text)}>
      {BILLING_TYPE_LABELS[type]}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold',
      active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-400')} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Row actions dropdown ───────────────────────────────────────────────────────

function RowActions({
  product, onEdit, onDeactivate,
}: { product: Product; onEdit: (p: Product) => void; onDeactivate: (p: Product) => void }) {
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
          <Link
            to={`/products/${product.id}`}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-slate-400" /> View Details
          </Link>
          <button
            onClick={() => { setOpen(false); onEdit(product); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-400" /> Edit
          </button>
          {product.is_active && (
            <button
              onClick={() => { setOpen(false); onDeactivate(product); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 transition-colors text-left"
            >
              <EyeOff className="w-3.5 h-3.5" /> Deactivate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Currency formatter ────────────────────────────────────────────────────────

function formatPrice(price: string, currency: string): string {
  return `${currency} ${Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const { success, error: toastError } = useToast();

  const [products,     setProducts]     = useState<Product[]>([]);
  const [stats,        setStats]        = useState<ProductStats | null>(null);
  const [total,        setTotal]        = useState(0);
  const [totalPages,   setTotalPages]   = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [apiError,     setApiError]     = useState('');

  // Filters
  const [search,       setSearch]      = useState('');
  const [category,     setCategory]    = useState('');
  const [productType,  setProductType] = useState<ProductType | ''>('');
  const [billingType,  setBillingType] = useState<BillingType | ''>('');
  const [isActive,     setIsActive]    = useState<'' | 'true' | 'false'>('');
  const [sortBy,       setSortBy]      = useState('created_at');
  const [sortDir,      setSortDir]     = useState<'asc' | 'desc'>('desc');
  const [page,         setPage]        = useState(1);
  const [limit,        setLimit]       = useState(10);

  const debouncedSearch = useDebounce(search, 400);

  // UI state
  const [formOpen,         setFormOpen]         = useState(false);
  const [editTarget,       setEditTarget]       = useState<Product | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null);
  const [deactivating,     setDeactivating]     = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setApiError('');
    try {
      const res = await getProducts({
        search:       debouncedSearch || undefined,
        category:     category       || undefined,
        product_type: productType    || undefined,
        billing_type: billingType    || undefined,
        is_active:    isActive       || undefined,
        sort_by:      sortBy,
        sort_dir:     sortDir,
        page, limit,
      });
      setProducts(res.products);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, productType, billingType, isActive, sortBy, sortDir, page, limit]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await getProductStats()); }
    catch { /* non-critical */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(1); }, [debouncedSearch, category, productType, billingType, isActive]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
    setPage(1);
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await deactivateProduct(deactivateTarget.id);
      success('Product deactivated', `"${deactivateTarget.product_name}" has been deactivated.`);
      setDeactivateTarget(null);
      fetchProducts(); fetchStats();
    } catch (err) {
      toastError('Failed to deactivate', getApiErrorMessage(err));
    } finally {
      setDeactivating(false);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'product_name', header: 'Product', sortable: true,
      render: (p) => (
        <div>
          <Link to={`/products/${p.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors">
            {p.product_name}
          </Link>
          {p.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{p.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'product_code', header: 'Code',
      render: (p) => <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded-md">{p.product_code}</span>,
    },
    {
      key: 'category', header: 'Category',
      render: (p) => <span className="text-sm text-slate-600">{p.category || <span className="text-slate-300">—</span>}</span>,
    },
    {
      key: 'product_type', header: 'Type',
      render: (p) => <TypeBadge type={p.product_type} />,
    },
    {
      key: 'billing_type', header: 'Billing',
      render: (p) => <BillingBadge type={p.billing_type} />,
    },
    {
      key: 'base_price', header: 'Base Price', sortable: true,
      render: (p) => (
        <div>
          <span className="text-sm font-semibold text-slate-900">{formatPrice(p.base_price, p.currency)}</span>
          {Number(p.tax_percentage) > 0 && (
            <span className="text-xs text-slate-400 ml-1">+{p.tax_percentage}% tax</span>
          )}
        </div>
      ),
    },
    {
      key: 'variants', header: 'Variants',
      render: (p) => (
        <Link
          to={`/products/${p.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <Layers className="w-3 h-3" />
          View
        </Link>
      ),
    },
    {
      key: 'is_active', header: 'Status',
      render: (p) => <StatusBadge active={p.is_active} />,
    },
    {
      key: 'actions', header: '', align: 'right' as const,
      render: (p) => (
        <RowActions
          product={p}
          onEdit={(prod) => { setEditTarget(prod); setFormOpen(true); }}
          onDeactivate={(prod) => setDeactivateTarget(prod)}
        />
      ),
    },
  ];

  const hasFilters = !!(search || category || productType || billingType || isActive);
  const clearFilters = () => { setSearch(''); setCategory(''); setProductType(''); setBillingType(''); setIsActive(''); setPage(1); };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your products, pricing, and available variants.
          </p>
        </div>
        <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => { setEditTarget(null); setFormOpen(true); }}>
          Add Product
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Products"      value={stats ? String(stats.total)        : '—'} icon={Package}      iconBg="bg-indigo-50"   iconColor="text-indigo-600"  loading={statsLoading} />
        <MetricCard label="Active Products"     value={stats ? String(stats.active)       : '—'} icon={PackageCheck}  iconBg="bg-emerald-50"  iconColor="text-emerald-600" loading={statsLoading} />
        <MetricCard label="Subscription"        value={stats ? String(stats.subscription) : '—'} icon={Repeat2}       iconBg="bg-teal-50"     iconColor="text-teal-600"    loading={statsLoading} />
        <MetricCard label="Inactive Products"   value={stats ? String(stats.inactive)     : '—'} icon={PackageX}      iconBg="bg-slate-100"   iconColor="text-slate-500"   loading={statsLoading} />
      </div>

      {/* Table Card */}
      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3 flex-1 w-full">
            {/* Search */}
            <div className="relative min-w-0 w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text" placeholder="Search name, code…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="form-input pl-9 py-2 text-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category */}
            <input
              type="text" placeholder="Category…"
              value={category} onChange={e => setCategory(e.target.value)}
              className="form-input py-2 text-sm w-32"
            />

            {/* Product type */}
            <select value={productType} onChange={e => setProductType(e.target.value as ProductType | '')} className="form-input py-2 text-sm w-36">
              <option value="">All Types</option>
              <option value="subscription">Subscription</option>
              <option value="one_time">One-time</option>
            </select>

            {/* Billing type */}
            <select value={billingType} onChange={e => setBillingType(e.target.value as BillingType | '')} className="form-input py-2 text-sm w-36">
              <option value="">All Billing</option>
              <option value="recurring">Recurring</option>
              <option value="one_time">One-time</option>
            </select>

            {/* Active status */}
            <select value={isActive} onChange={e => setIsActive(e.target.value as '' | 'true' | 'false')} className="form-input py-2 text-sm w-28">
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            {/* Page size */}
            <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="form-input py-2 text-sm w-24">
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>

            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 whitespace-nowrap">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <button
            onClick={() => { fetchProducts(); fetchStats(); }}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
            title="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {apiError && !loading && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-700">{apiError}</p>
            <button onClick={fetchProducts} className="text-xs text-red-600 hover:underline font-medium">Retry</button>
          </div>
        )}

        <DataTable
          columns={columns} data={products}
          keyExtractor={(p) => p.id} loading={loading}
          sort={{ field: sortBy, direction: sortDir }} onSort={handleSort}
          emptyTitle={hasFilters ? 'No products found' : 'No products yet'}
          emptyDescription={hasFilters ? 'Try adjusting your search or filters.' : 'Add your first product to get started.'}
        />

        {!loading && totalPages > 0 && (
          <div className="border-t border-slate-100 px-4">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={limit} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ProductFormDialog
        open={formOpen} onOpenChange={setFormOpen}
        product={editTarget}
        onSuccess={() => { fetchProducts(); fetchStats(); }}
      />
      <ConfirmDialog
        open={Boolean(deactivateTarget)} onOpenChange={(o) => !o && setDeactivateTarget(null)}
        title="Deactivate Product"
        description={`"${deactivateTarget?.product_name}" and all its variants will be deactivated. Existing subscriptions and invoices referencing this product will not be affected.`}
        confirmLabel="Deactivate" variant="danger"
        loading={deactivating} onConfirm={handleDeactivateConfirm}
      />
    </div>
  );
}
