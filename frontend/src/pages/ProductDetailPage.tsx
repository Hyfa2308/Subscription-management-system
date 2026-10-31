/**
 * REVORA – ProductDetailPage
 * Full product detail at /products/:id showing product information,
 * live variant management table with add/edit/deactivate.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit3, EyeOff, Package, Tag, Layers, Plus,
  MoreHorizontal, CheckCircle2, XCircle, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';
import { VariantFormDialog } from '@/components/products/VariantFormDialog';
import { useToast } from '@/components/common/Toast';
import { getProductById, deactivateProduct, deactivateVariant } from '@/services/productApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { ROUTES } from '@/config/routes';
import { cn } from '@/utils/cn';
import type { ProductDetail, ProductVariant, ProductType, BillingType } from '@/types/product';
import {
  PRODUCT_TYPE_LABELS, BILLING_TYPE_LABELS,
  PRODUCT_TYPE_COLORS, BILLING_TYPE_COLORS,
} from '@/types/product';

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm font-medium text-slate-800">{children}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: ProductType }) {
  const s = PRODUCT_TYPE_COLORS[type];
  return <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-semibold', s.bg, s.text)}>{PRODUCT_TYPE_LABELS[type]}</span>;
}

function BillingBadge({ type }: { type: BillingType }) {
  const s = BILLING_TYPE_COLORS[type];
  return <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-semibold', s.bg, s.text)}>{BILLING_TYPE_LABELS[type]}</span>;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
      active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-400')} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function formatPrice(price: string, currency: string): string {
  return `${currency} ${Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Variant row actions ────────────────────────────────────────────────────────

function VariantRowActions({
  variant, onEdit, onDeactivate,
}: { variant: ProductVariant; onEdit: () => void; onDeactivate: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden animate-fade-in">
          <button onClick={() => { setOpen(false); onEdit(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left">
            <Edit3 className="w-3.5 h-3.5 text-slate-400" /> Edit
          </button>
          {variant.is_active && (
            <button onClick={() => { setOpen(false); onDeactivate(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 text-left">
              <EyeOff className="w-3.5 h-3.5" /> Deactivate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [product,          setProduct]          = useState<ProductDetail | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [apiError,         setApiError]         = useState('');
  const [editProductOpen,  setEditProductOpen]  = useState(false);
  const [deactivatePOpen,  setDeactivatePOpen]  = useState(false);
  const [deactivatingP,    setDeactivatingP]    = useState(false);

  const [variantFormOpen,  setVariantFormOpen]  = useState(false);
  const [editVariant,      setEditVariant]      = useState<ProductVariant | null>(null);
  const [deactivateVariantTarget, setDeactivateVariantTarget] = useState<ProductVariant | null>(null);
  const [deactivatingV,    setDeactivatingV]    = useState(false);

  const productId = Number(id);

  const fetchProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true); setApiError('');
    try {
      setProduct(await getProductById(productId));
    } catch (err: any) {
      setApiError(err?.response?.status === 404 ? 'Product not found.' : getApiErrorMessage(err));
    } finally { setLoading(false); }
  }, [productId]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const handleDeactivateProduct = async () => {
    if (!product) return;
    setDeactivatingP(true);
    try {
      await deactivateProduct(product.id);
      success('Product deactivated', `"${product.product_name}" has been deactivated.`);
      setDeactivatePOpen(false);
      fetchProduct();
    } catch (err) {
      toastError('Failed', getApiErrorMessage(err));
    } finally { setDeactivatingP(false); }
  };

  const handleDeactivateVariant = async () => {
    if (!product || !deactivateVariantTarget) return;
    setDeactivatingV(true);
    try {
      await deactivateVariant(product.id, deactivateVariantTarget.id);
      success('Variant deactivated', `"${deactivateVariantTarget.variant_name}" has been deactivated.`);
      setDeactivateVariantTarget(null);
      fetchProduct();
    } catch (err) {
      toastError('Failed', getApiErrorMessage(err));
    } finally { setDeactivatingV(false); }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="card p-6 space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${70 - i * 8}%` }} />)}
        </div>
      </div>
    );
  }

  if (apiError || !product) {
    return (
      <div className="p-6">
        <div className="card p-8 flex flex-col items-center text-center">
          <p className="text-sm text-slate-600 mb-4">{apiError || 'Product not found.'}</p>
          <Button variant="secondary" size="sm" onClick={() => navigate(ROUTES.PRODUCTS)}>Back to Products</Button>
        </div>
      </div>
    );
  }

  const activeVariants   = product.variants.filter(v => v.is_active);
  const inactiveVariants = product.variants.filter(v => !v.is_active);

  return (
    <div className="space-y-6 p-6">
      {/* Back */}
      <Link to={ROUTES.PRODUCTS} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Products
      </Link>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{product.product_name}</h1>
              <StatusBadge active={product.is_active} />
            </div>
            {product.description && <p className="text-sm text-slate-500 mb-1">{product.description}</p>}
            <p className="text-xs font-mono text-slate-400">{product.product_code}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" leftIcon={Edit3} onClick={() => setEditProductOpen(true)}>Edit</Button>
            {product.is_active && (
              <Button variant="danger" size="sm" leftIcon={EyeOff} onClick={() => setDeactivatePOpen(true)}>Deactivate</Button>
            )}
          </div>
        </div>
      </div>

      {/* Product details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info panel */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-400" /> Product Information
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Product Code">
              <span className="font-mono text-xs">{product.product_code}</span>
            </InfoCard>
            <InfoCard label="Category">{product.category || '—'}</InfoCard>
            <InfoCard label="Product Type"><TypeBadge type={product.product_type} /></InfoCard>
            <InfoCard label="Billing Type"><BillingBadge type={product.billing_type} /></InfoCard>
            <InfoCard label="Base Price">{formatPrice(product.base_price, product.currency)}</InfoCard>
            <InfoCard label="Tax">
              {Number(product.tax_percentage) > 0 ? `${product.tax_percentage}%` : 'None'}
            </InfoCard>
            <InfoCard label="Currency">{product.currency}</InfoCard>
            <InfoCard label="Status"><StatusBadge active={product.is_active} /></InfoCard>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Created</span>
              <span>{new Date(product.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Last updated</span>
              <span>{new Date(product.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Variants panel */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800">
                Variants
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {activeVariants.length} active · {inactiveVariants.length} inactive
                </span>
              </h2>
            </div>
            <Button
              variant="primary" size="sm" leftIcon={Plus}
              onClick={() => { setEditVariant(null); setVariantFormOpen(true); }}
              disabled={!product.is_active}
            >
              Add Variant
            </Button>
          </div>

          {product.variants.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-6">
              <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center mb-3">
                <Layers className="w-5 h-5 text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">No variants yet</p>
              <p className="text-xs text-slate-400">
                Add variants to offer different pricing tiers for this product.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {product.variants.map(v => (
                <div key={v.id} className={cn('flex items-center gap-4 px-5 py-3', !v.is_active && 'bg-slate-50 opacity-70')}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{v.variant_name}</p>
                      {v.is_active
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        : <XCircle className="w-3.5 h-3.5 text-slate-400" />
                      }
                    </div>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">{v.variant_code}</p>
                    {v.description && <p className="text-xs text-slate-500 mt-0.5">{v.description}</p>}
                  </div>

                  {/* Price info */}
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatPrice(v.final_price, product.currency)}</p>
                    {Number(v.price_adjustment) !== 0 && (
                      <p className={cn('text-xs', Number(v.price_adjustment) > 0 ? 'text-emerald-600' : 'text-red-500')}>
                        {Number(v.price_adjustment) > 0 ? '+' : ''}{formatPrice(v.price_adjustment, product.currency)}
                      </p>
                    )}
                  </div>

                  <VariantRowActions
                    variant={v}
                    onEdit={() => { setEditVariant(v); setVariantFormOpen(true); }}
                    onDeactivate={() => setDeactivateVariantTarget(v)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Future modules placeholder */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Used In</h2>
        <p className="text-sm text-slate-400 italic">
          Subscription plans, quotations, and invoices referencing this product will appear here once those modules are connected.
        </p>
      </div>

      {/* Dialogs */}
      <ProductFormDialog
        open={editProductOpen} onOpenChange={setEditProductOpen}
        product={product} onSuccess={fetchProduct}
      />
      <ConfirmDialog
        open={deactivatePOpen} onOpenChange={setDeactivatePOpen}
        title="Deactivate Product"
        description={`"${product.product_name}" and all its variants will be deactivated. This action is reversible.`}
        confirmLabel="Deactivate" variant="danger"
        loading={deactivatingP} onConfirm={handleDeactivateProduct}
      />

      {product && (
        <VariantFormDialog
          open={variantFormOpen} onOpenChange={setVariantFormOpen}
          product={product} variant={editVariant}
          onSuccess={fetchProduct}
        />
      )}
      <ConfirmDialog
        open={Boolean(deactivateVariantTarget)}
        onOpenChange={(o) => !o && setDeactivateVariantTarget(null)}
        title="Deactivate Variant"
        description={`"${deactivateVariantTarget?.variant_name}" will be deactivated. This is reversible.`}
        confirmLabel="Deactivate" variant="danger"
        loading={deactivatingV} onConfirm={handleDeactivateVariant}
      />
    </div>
  );
}
