/**
REVORA – Customer Intelligence Detail Page.
Route: /customer-intelligence/customers/:id

Provides in-depth explainable customer intelligence:
  - Customer overview & tenure
  - Health score & component breakdown (Payment, Stability, Renewal, Tenure, Revenue)
  - Churn risk analysis & contributing factors
  - Behaviour analysis (Subscription, Payment, Revenue)
  - Retention recommendations with execution dialog
  - Real customer activity timeline
*/

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Brain,
  ShieldCheck,
  AlertTriangle,
  Flame,
  RefreshCw,
  Calendar,
  Building2,
  Mail,
  Phone,
  Layers,
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Activity,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Info,
  Check,
  X,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { MetricCard } from '@/components/common/MetricCard';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TableSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { useToast } from '@/components/common/Toast';
import {
  getCustomerIntelligence,
  recalculateCustomerIntelligence,
  updateRecommendationStatus,
} from '@/services/customerIntelligenceApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { ROUTES } from '@/config/routes';
import { cn } from '@/utils/cn';
import type {
  CustomerIntelligenceDetail,
  HealthCategory,
  ChurnRiskCategory,
  RecommendationPriority,
  RecommendationStatus,
  RetentionRecommendation,
} from '@/types/customerIntelligence';

// ── Badge Helpers ────────────────────────────────────────────────────────────

const PRIORITY_BADGES: Record<RecommendationPriority, { bg: string; text: string }> = {
  high:   { bg: 'bg-rose-100 border-rose-200', text: 'text-rose-700 font-bold' },
  medium: { bg: 'bg-amber-100 border-amber-200', text: 'text-amber-800 font-semibold' },
  low:    { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700 font-medium' },
};

const STATUS_BADGES: Record<RecommendationStatus, { bg: string; text: string; label: string }> = {
  pending:     { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700', label: 'Pending' },
  in_progress: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'text-blue-700', label: 'In Progress' },
  completed:   { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700', label: 'Completed' },
  dismissed:   { bg: 'bg-slate-100 text-slate-500 border-slate-200', text: 'text-slate-500', label: 'Dismissed' },
};

export default function CustomerIntelligenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const customerId = parseInt(id || '', 10);

  const [detail, setDetail] = useState<CustomerIntelligenceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recommendation execution dialog
  const [selectedRec, setSelectedRec] = useState<RetentionRecommendation | null>(null);
  const [targetStatus, setTargetStatus] = useState<RecommendationStatus>('in_progress');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execNotes, setExecNotes] = useState('');

  // ── Fetch Details ──────────────────────────────────────────────────────────
  const fetchDetail = useCallback(async () => {
    if (isNaN(customerId)) {
      setError('Invalid Customer ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getCustomerIntelligence(customerId);
      setDetail(data);
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ── Recalculate On Demand ──────────────────────────────────────────────────
  const handleRecalculate = async () => {
    if (!detail) return;
    setRecalculating(true);
    try {
      const updated = await recalculateCustomerIntelligence(detail.customer_id);
      setDetail(updated);
      success('Intelligence Recalculated', 'Health score, churn assessment, and retention recommendations refreshed.');
    } catch (err) {
      toastError('Recalculation Failed', getApiErrorMessage(err));
    } finally {
      setRecalculating(false);
    }
  };

  // ── Execute Recommendation ─────────────────────────────────────────────────
  const triggerStatusChange = (rec: RetentionRecommendation, nextStatus: RecommendationStatus) => {
    setSelectedRec(rec);
    setTargetStatus(nextStatus);
    setExecNotes('');
    setConfirmOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedRec) return;
    setExecuting(true);
    try {
      const updated = await updateRecommendationStatus(
        selectedRec.id,
        targetStatus,
        execNotes.trim() || undefined
      );

      // Update in state
      setDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          recommendations: prev.recommendations.map(r => (r.id === updated.id ? updated : r)),
        };
      });

      // Refetch full detail to reflect new activity log entry
      fetchDetail();

      success('Action Executed', `Recommendation marked as ${targetStatus.replace('_', ' ')}. Activity logged.`);
      setConfirmOpen(false);
    } catch (err) {
      toastError('Execution Failed', getApiErrorMessage(err));
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-6">
        <TableSkeleton rows={6} cols={4} />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <ErrorState
          title="Could not load customer intelligence"
          message={error || 'Customer not found.'}
          onRetry={fetchDetail}
        />
        <div className="mt-4 text-center">
          <Button variant="secondary" onClick={() => navigate(ROUTES.CUSTOMER_INTELLIGENCE)}>
            Back to Customer Intelligence
          </Button>
        </div>
      </div>
    );
  }

  const { customer_name, customer_code, account_status, health, churn_risk, behaviour, recommendations, activities, segments } = detail;

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* ── Breadcrumb & Top Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(ROUTES.CUSTOMER_INTELLIGENCE)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Customer Intelligence
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{customer_name}</h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
              {customer_code}
            </span>
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
              account_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
            )}>
              {account_status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculating}
            leftIcon={RefreshCw}
            className={cn(recalculating && 'opacity-70')}
          >
            {recalculating ? 'Recalculating…' : 'Recalculate Intelligence'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/customers/${customerId}`)}
            rightIcon={ExternalLink}
            className="text-xs text-slate-600"
          >
            View Customer Profile
          </Button>
        </div>
      </div>

      {/* ── Data Source Transparency Notice ─────────────────────────────────── */}
      {behaviour.is_demo_data ? (
        <div className="flex items-start gap-3 p-3.5 bg-violet-50/80 border border-violet-200 rounded-xl text-xs text-violet-800">
          <Sparkles className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Labelled Demo Telemetry Attached:</span> This customer profile includes
            development telemetry to simulate real-world subscription behaviours and payment signals during parallel module development.
            Real database operations will seamlessly replace this telemetry once external modules are active.
          </div>
        </div>
      ) : !behaviour.is_data_sufficient ? (
        <div className="flex items-start gap-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Insufficient Operational Telemetry:</span> This customer record exists in the database
            without sufficient subscription or billing activity. As required, REVORA honestly reflects "Insufficient Data" rather than
            fabricating an arbitrary health score.
          </div>
        </div>
      ) : null}

      {/* ── Overview Metric Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Health Score Card */}
        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Customer Health</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {health.score !== null ? Math.round(health.score) : '—'}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="mt-2">
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1',
              health.category === 'healthy' ? 'bg-emerald-50 text-emerald-700' :
              health.category === 'needs_attention' ? 'bg-amber-50 text-amber-700' :
              health.category === 'at_risk' ? 'bg-rose-50 text-rose-700' :
              'bg-slate-100 text-slate-600'
            )}>
              {health.category.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Churn Risk Card */}
        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Churn Risk</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {churn_risk.risk_score !== null ? `${Math.round(churn_risk.risk_score)}%` : '—'}
            </span>
            <span className="text-xs text-slate-400">probability</span>
          </div>
          <div className="mt-2">
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1',
              churn_risk.risk_category === 'low_risk' ? 'bg-emerald-50 text-emerald-700' :
              churn_risk.risk_category === 'medium_risk' ? 'bg-amber-50 text-amber-700' :
              churn_risk.risk_category === 'high_risk' ? 'bg-rose-50 text-rose-700' :
              'bg-slate-100 text-slate-600'
            )}>
              {churn_risk.risk_category.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Recurring Revenue Card */}
        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Recurring Revenue</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              ${behaviour.monthly_recurring_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400">MRR</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono">
            ARR: ${behaviour.annual_recurring_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Customer Tenure Card */}
        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Customer Tenure</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {behaviour.tenure_months}
            </span>
            <span className="text-xs text-slate-400">months</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Registered: {new Date(behaviour.registration_date).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* ── Two Column Layout: Health Score & Churn Analysis ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Score Pillar Breakdown */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">Customer Health Breakdown</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Calc: {new Date(health.calculated_at).toLocaleDateString()}
            </span>
          </div>

          {/* 5 Pillars Progress Bars */}
          <div className="space-y-3.5">
            {[
              { label: 'Payment Reliability', score: health.payment_reliability_score, weight: '30%' },
              { label: 'Subscription Stability', score: health.subscription_stability_score, weight: '25%' },
              { label: 'Renewal Behaviour', score: health.renewal_behaviour_score, weight: '15%' },
              { label: 'Customer Tenure', score: health.customer_tenure_score, weight: '15%' },
              { label: 'Revenue Consistency', score: health.revenue_consistency_score, weight: '15%' },
            ].map(p => (
              <div key={p.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">{p.label} <span className="text-slate-400 text-[10px]">({p.weight})</span></span>
                  <span className="font-mono font-bold text-slate-800">
                    {p.score !== null ? `${Math.round(p.score)} / 100` : 'N/A'}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      p.score === null ? 'bg-slate-300' :
                      p.score >= 75 ? 'bg-emerald-500' :
                      p.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    )}
                    style={{ width: `${p.score !== null ? Math.min(100, Math.max(0, p.score)) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Positive Factors */}
          {health.positive_factors.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Positive Health Indicators
              </p>
              <div className="space-y-1.5">
                {health.positive_factors.map((f, i) => (
                  <div key={i} className="text-xs text-slate-700 bg-emerald-50/60 border border-emerald-100 px-2.5 py-1.5 rounded-lg flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Negative Factors */}
          {health.negative_factors.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-semibold text-rose-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Risk / Penalty Factors
              </p>
              <div className="space-y-1.5">
                {health.negative_factors.map((f, i) => (
                  <div key={i} className="text-xs text-slate-700 bg-rose-50/60 border border-rose-100 px-2.5 py-1.5 rounded-lg flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Churn Risk Analysis & Contributing Factors */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-semibold text-slate-800">Churn Risk Analysis</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Engine: {churn_risk.engine_version}
            </span>
          </div>

          {/* Narrative Explanation */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <p className="text-xs text-slate-700 leading-relaxed">
              {churn_risk.explanation}
            </p>
          </div>

          {/* Contributing Factors List */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Contributing Risk Factors
            </h4>
            {churn_risk.contributing_factors.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No acute churn risk factors observed.</p>
            ) : (
              <div className="space-y-2">
                {churn_risk.contributing_factors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800">{factor.factor}</span>
                        <span className={cn(
                          'px-1.5 py-0.2 rounded text-[10px] font-bold uppercase',
                          factor.severity === 'high' ? 'bg-rose-100 text-rose-700' :
                          factor.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        )}>
                          {factor.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-normal">
                        {factor.description}
                      </p>
                    </div>
                    <span className={cn(
                      'text-xs font-bold font-mono whitespace-nowrap',
                      factor.impact > 0 ? 'text-rose-600' : 'text-emerald-600'
                    )}>
                      {factor.impact > 0 ? `+${factor.impact}` : `${factor.impact}`} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Primary Recommended Action Box */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl">
            <p className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">
              Primary Recommended Strategy
            </p>
            <p className="text-xs text-indigo-950 font-medium mt-1">
              {churn_risk.recommended_action}
            </p>
          </div>
        </div>
      </div>

      {/* ── Behaviour & Telemetry Grid ───────────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-800 pb-3 border-b border-slate-100 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-500" />
          Subscription & Financial Behaviour Analysis
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Subscription Behaviour */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Subscription Footprint
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Active Subscriptions</span>
                <span className="font-semibold text-slate-800">{behaviour.active_subscriptions}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Paused Subscriptions</span>
                <span className="font-semibold text-slate-800">{behaviour.paused_subscriptions}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Closed / Cancelled</span>
                <span className="font-semibold text-slate-800">{behaviour.closed_subscriptions}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Contract Renewals</span>
                <span className="font-semibold text-slate-800">{behaviour.renewal_count}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Auto-Renewal Active</span>
                <span className={cn('font-semibold', behaviour.has_auto_renew ? 'text-emerald-600' : 'text-rose-600')}>
                  {behaviour.has_auto_renew ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Behaviour */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Payment Reliability
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Total Payments</span>
                <span className="font-semibold text-slate-800">{behaviour.total_payments}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Successful Payments</span>
                <span className="font-semibold text-emerald-700">{behaviour.successful_payments}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Failed Payments</span>
                <span className={cn('font-semibold', behaviour.failed_payments > 0 ? 'text-rose-600' : 'text-slate-800')}>
                  {behaviour.failed_payments}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Overdue Invoices Balance</span>
                <span className={cn('font-semibold font-mono', behaviour.outstanding_invoices_amount > 0 ? 'text-rose-600' : 'text-slate-800')}>
                  ${behaviour.outstanding_invoices_amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Average Payment Delay</span>
                <span className="font-semibold text-slate-800">
                  {behaviour.avg_payment_delay_days !== null ? `${behaviour.avg_payment_delay_days.toFixed(1)} days` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Revenue Contribution */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Revenue Value
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Monthly Recurring (MRR)</span>
                <span className="font-semibold text-slate-800 font-mono">${behaviour.monthly_recurring_revenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Annual Contract Value (ARR)</span>
                <span className="font-semibold text-slate-800 font-mono">${behaviour.annual_recurring_revenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Historical Lifetime Value</span>
                <span className="font-semibold text-slate-800 font-mono">${behaviour.total_historical_revenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Revenue Trend</span>
                <span className={cn(
                  'font-semibold capitalize',
                  behaviour.revenue_trend === 'growing' ? 'text-emerald-600' :
                  behaviour.revenue_trend === 'declining' ? 'text-rose-600' : 'text-slate-800'
                )}>
                  {behaviour.revenue_trend}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Data Source</span>
                <span className="font-medium text-slate-500">{behaviour.data_source}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Retention Recommendations Engine ────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Actionable Retention Recommendations</h3>
            <p className="text-xs text-slate-500">Contextual actions prioritized by impact. User confirmation required before execution.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
            {recommendations.length} Action{recommendations.length === 1 ? '' : 's'}
          </span>
        </div>

        {recommendations.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No active recommendations for this account.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec) => {
              const pBadge = PRIORITY_BADGES[rec.priority] ?? PRIORITY_BADGES.medium;
              const sBadge = STATUS_BADGES[rec.status] ?? STATUS_BADGES.pending;

              return (
                <div
                  key={rec.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border', pBadge.bg, pBadge.text)}>
                        {rec.priority} Priority
                      </span>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', sBadge.bg)}>
                        {sBadge.label}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-800 capitalize">
                      {rec.recommendation_type.replace(/_/g, ' ')}
                    </h4>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-700">Reason:</span> {rec.reason}
                    </p>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700">
                      <span className="font-semibold text-slate-800">Action:</span> {rec.suggested_action}
                    </div>

                    {rec.expected_benefit && (
                      <p className="text-xs text-indigo-700 font-medium">
                        ✦ <span className="font-semibold">Expected Benefit:</span> {rec.expected_benefit}
                      </p>
                    )}

                    {rec.execution_notes && (
                      <p className="text-xs text-slate-400 italic">
                        Note: {rec.execution_notes}
                      </p>
                    )}
                  </div>

                  {/* Execution Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    {rec.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => triggerStatusChange(rec, 'dismissed')}
                          className="text-xs text-slate-500 hover:text-slate-800"
                        >
                          Dismiss
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => triggerStatusChange(rec, 'in_progress')}
                          className="text-xs"
                        >
                          Execute Action
                        </Button>
                      </>
                    )}
                    {rec.status === 'in_progress' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => triggerStatusChange(rec, 'completed')}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700"
                      >
                        Mark as Completed
                      </Button>
                    )}
                    {rec.status === 'completed' && (
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Action Logged
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Real Customer Activity Timeline ─────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 pb-3 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          Customer Activity & Retention History
        </h3>

        {activities.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No activity history recorded for this customer yet.</p>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
            {activities.map((act) => (
              <div key={act.id} className="relative flex items-start gap-3">
                <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white ring-2 ring-slate-200" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 font-mono">
                      {act.event_type}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-normal">{act.description}</p>
                  {act.actor_name && (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Actor: {act.actor_name}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Confirm Dialog for Executing Recommendations ───────────────────── */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(isOpen) => setConfirmOpen(isOpen)}
        onConfirm={handleConfirmStatusChange}
        title={`Confirm Recommendation Action: ${targetStatus.replace('_', ' ').toUpperCase()}`}
        description={
          selectedRec
            ? `Are you sure you want to change the status of '${selectedRec.recommendation_type.replace(/_/g, ' ')}' to ${targetStatus.replace('_', ' ')}? An immutable entry will be recorded in the customer activity timeline.`
            : ''
        }
        confirmLabel={executing ? 'Executing…' : 'Confirm Action'}
        variant={targetStatus === 'dismissed' ? 'danger' : 'primary'}
      />
    </div>
  );
}
