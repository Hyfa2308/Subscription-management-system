/**
 * REVORA – PlanDetailPage
 * Full plan detail at /plans/:id.
 * Shows all plan fields, product/variant info, feature flags, and actions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Archive, LayoutList, ShoppingBag, DollarSign,
  RefreshCw, Clock, Shield, Calendar, CheckCircle2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PlanFormDialog } from '@/components/plans/PlanFormDialog';
import { useToast } from '@/components/common/Toast';
import { getPlanById, archivePlan } from '@/services/planApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type { SubscriptionPlanDetail } from '@/types/plan';
import {
  BILLING_FREQUENCY_LABELS, PLAN_STATUS_COLORS, BILLING_FREQUENCY_COLORS,
} from '@/types/plan';

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

function Flag({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      {enabled
        ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Yes</span>
        : <span className="flex items-center gap-1 text-slate-400 text-xs font-semibold"><XCircle className="w-3.5 h-3.5" /> No</span>
      }
    </div>
  );
}

function formatPrice(price: string, currency: string) {
  return `${currency} ${Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [plan,        setPlan]        = useState<SubscriptionPlanDetail | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [apiError,    setApiError]    = useState('');
  const [editOpen,    setEditOpen]    = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving,   setArchiving]   = useState(false);

  const planId = Number(id);

  const fetchPlan = useCallback(async () => {
    if (!planId) return;
    setLoading(true); setApiError('');
    try { setPlan(await getPlanById(planId)); }
    catch (err: any) {
      setApiError(err?.response?.status === 404 ? 'Plan not found.' : getApiErrorMessage(err));
    } finally { setLoading(false); }
  }, [planId]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const handleArchive = async () => {
    if (!plan) return;
    setArchiving(true);
    try {
      await archivePlan(plan.id);
      success('Plan archived', `"${plan.plan_name}" has been archived.`);
      setArchiveOpen(false);
      fetchPlan();
    } catch (err) {
      toastError('Failed', getApiErrorMessage(err));
    } finally { setArchiving(false); }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="card p-6 space-y-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${70 - i * 8}%` }} />)}
        </div>
      </div>
    );
  }

  if (apiError || !plan) {
    return (
      <div className="p-6">
        <div className="card p-8 flex flex-col items-center text-center">
          <p className="text-sm text-slate-600 mb-4">{apiError || 'Plan not found.'}</p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/plans')}>Back to Plans</Button>
        </div>
      </div>
    );
  }

  const statusStyle = PLAN_STATUS_COLORS[plan.status];
  const freqStyle   = BILLING_FREQUENCY_COLORS[plan.billing_frequency];

  return (
    <div className="space-y-6 p-6">
      {/* Back */}
      <Link to="/plans" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Subscription Plans
      </Link>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <LayoutList className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{plan.plan_name}</h1>
              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', statusStyle.bg, statusStyle.text)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', statusStyle.dot)} />
                {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
              </span>
            </div>
            {plan.description && <p className="text-sm text-slate-500 mb-1">{plan.description}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs font-mono text-slate-400">{plan.plan_code}</span>
              <span className="text-slate-200">·</span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', freqStyle.bg, freqStyle.text)}>
                {BILLING_FREQUENCY_LABELS[plan.billing_frequency]}
              </span>
            </div>
          </div>
          {plan.status !== 'archived' && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="secondary" size="sm" leftIcon={Edit3} onClick={() => setEditOpen(true)}>Edit</Button>
              <Button variant="danger" size="sm" leftIcon={Archive} onClick={() => setArchiveOpen(true)}>Archive</Button>
            </div>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Product + Pricing */}
        <div className="lg:col-span-2 space-y-6">

          {/* Product info */}
          <div className="card p-5">
            <SectionTitle icon={ShoppingBag} title="Product & Variant" />
            {plan.product ? (
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Product">
                  <Link to={`/products/${plan.product_id}`} className="text-indigo-600 hover:underline text-sm">
                    {plan.product.product_name}
                  </Link>
                </InfoCard>
                <InfoCard label="Product Code">
                  <span className="font-mono text-xs">{plan.product.product_code}</span>
                </InfoCard>
                <InfoCard label="Base Price">
                  {formatPrice(plan.product.base_price, plan.product.currency)}
                </InfoCard>
                <InfoCard label="Variant">
                  {plan.variant ? (
                    <span>{plan.variant.variant_name} <span className="text-slate-400 text-xs">({formatPrice(plan.variant.final_price, plan.currency)})</span></span>
                  ) : <span className="text-slate-400">No variant</span>}
                </InfoCard>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Product details unavailable.</p>
            )}
          </div>

          {/* Pricing */}
          <div className="card p-5">
            <SectionTitle icon={DollarSign} title="Pricing" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoCard label="Plan Price">{formatPrice(plan.plan_price, plan.currency)}</InfoCard>
              <InfoCard label="Currency">{plan.currency}</InfoCard>
              <InfoCard label="Setup Fee">{formatPrice(plan.setup_fee, plan.currency)}</InfoCard>
              <InfoCard label="Tax">{Number(plan.tax_percentage) > 0 ? `${plan.tax_percentage}%` : 'None'}</InfoCard>
            </div>
          </div>

          {/* Billing */}
          <div className="card p-5">
            <SectionTitle icon={RefreshCw} title="Billing Configuration" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <InfoCard label="Frequency">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', freqStyle.bg, freqStyle.text)}>
                  {BILLING_FREQUENCY_LABELS[plan.billing_frequency]}
                </span>
              </InfoCard>
              <InfoCard label="Interval">Every {plan.billing_interval} {BILLING_FREQUENCY_LABELS[plan.billing_frequency].toLowerCase()}</InfoCard>
              <InfoCard label="Trial Period">
                {plan.trial_period_days > 0 ? `${plan.trial_period_days} days` : 'No trial'}
              </InfoCard>
            </div>
          </div>
        </div>

        {/* Right: Permissions + Dates */}
        <div className="space-y-6">

          {/* Feature flags */}
          <div className="card p-5">
            <SectionTitle icon={Shield} title="Permissions" />
            <div>
              <Flag enabled={plan.discount_allowed}      label="Allow Discounts" />
              <Flag enabled={plan.pause_allowed}         label="Allow Pause" />
              <Flag enabled={plan.renewal_allowed}       label="Allow Renewal" />
              <Flag enabled={plan.early_closure_allowed} label="Allow Early Closure" />
            </div>
          </div>

          {/* Commitment */}
          <div className="card p-5">
            <SectionTitle icon={Calendar} title="Commitment" />
            <InfoCard label="Minimum Commitment">
              {plan.minimum_commitment_period
                ? `${plan.minimum_commitment_period} months`
                : <span className="text-slate-400">None required</span>}
            </InfoCard>
          </div>

          {/* Dates */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Timeline</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Created</span>
                <span>{new Date(plan.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Last updated</span>
                <span>{new Date(plan.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {/* Future modules */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Used In</h2>
            <p className="text-xs text-slate-400 italic">
              Quotations, subscriptions, and invoices referencing this plan will appear here in future modules.
            </p>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <PlanFormDialog
        open={editOpen} onOpenChange={setEditOpen}
        plan={plan} onSuccess={fetchPlan}
      />
      <ConfirmDialog
        open={archiveOpen} onOpenChange={setArchiveOpen}
        title="Archive Plan"
        description={`"${plan.plan_name}" will be archived. Existing subscriptions will not be affected. You can reactivate it later.`}
        confirmLabel="Archive" variant="danger"
        loading={archiving} onConfirm={handleArchive}
      />
    </div>
  );
}
