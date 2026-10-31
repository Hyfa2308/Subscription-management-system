/**
 * REVORA – DiscountDetailPage
 * Route: /discounts/:id
 * Tabs: Overview | Redemption History | Validate
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Tag, Calendar, Users, Layers, CheckCircle2,
  XCircle, AlertTriangle, Pencil, Ban, Archive,
  BarChart3, Search, Clock,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { getDiscountById, archiveDiscount, updateDiscount, validateDiscount, getRedemptions } from '@/services/discountApi';
import { getCustomers } from '@/services/customerApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type { Discount, DiscountRedemption, RedemptionStatus } from '@/types/discount';
import {
  DISCOUNT_STATUS_CONFIG, REDEMPTION_STATUS_CONFIG,
  formatDiscountValue, fmtDate, APPLICABLE_TO_LABELS,
} from '@/types/discount';

function StatusBadge({ status }: { status: string }) {
  const cfg = DISCOUNT_STATUS_CONFIG[status as keyof typeof DISCOUNT_STATUS_CONFIG];
  if (!cfg) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', cfg.bg, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} /> {cfg.label}
    </span>
  );
}

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

type TabId = 'overview' | 'history' | 'validate';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',           icon: Tag         },
  { id: 'history',   label: 'Redemption History',  icon: BarChart3   },
  { id: 'validate',  label: 'Validate Discount',   icon: Search      },
];

/* ── Validate Panel ─────────────────────────────────────────────────────────── */

function ValidatePanel({ discount, customers }: { discount: Discount; customers: any[] }) {
  const { error: te } = useToast();
  const [customerId, setCustomerId] = useState('');
  const [amount,     setAmount]     = useState('');
  const [currency,   setCurrency]   = useState('INR');
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<any | null>(null);

  const run = async () => {
    if (!customerId || !amount) return;
    setLoading(true); setResult(null);
    try {
      const r = await validateDiscount({
        discount_code:   discount.discount_code,
        customer_id:     Number(customerId),
        purchase_amount: amount,
        currency,
      });
      setResult(r);
    } catch (err) { te('Error', getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="card p-5 max-w-xl">
      <SectionTitle icon={Search} title="Test Discount Eligibility" />
      <div className="space-y-4">
        <div>
          <label className="form-label">Customer *</label>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="form-input">
            <option value="">— Select customer —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Purchase Amount *</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="form-input" placeholder="0.00" />
          </div>
          <div>
            <label className="form-label">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="form-input">
              <option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option>
            </select>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={run} loading={loading} className="w-full">
          Validate Discount
        </Button>

        {result && (
          <div className={cn('p-4 rounded-xl border-2', result.valid ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50')}>
            <div className="flex items-center gap-2 mb-3">
              {result.valid
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                : <XCircle     className="w-5 h-5 text-red-600" />}
              <span className={cn('font-semibold text-sm', result.valid ? 'text-emerald-700' : 'text-red-700')}>
                {result.reason}
              </span>
            </div>
            {result.valid && (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Purchase Amount</span>
                  <span className="font-medium">{currency} {Number(amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>– {currency} {Number(result.discount_amount).toFixed(2)}</span>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Final Amount</span>
                  <span>{currency} {Number(result.final_amount).toFixed(2)}</span>
                </div>
              </div>
            )}
            {result.applicable_rules?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-1">Rules checked:</p>
                <ul className="space-y-0.5">
                  {result.applicable_rules.map((r: string, i: number) => (
                    <li key={i} className="text-xs text-slate-600 flex items-center gap-1">
                      <span className="text-emerald-500">✓</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */

export default function DiscountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: te } = useToast();

  const [disc,       setDisc]      = useState<Discount | null>(null);
  const [redemptions,setRedemptions]=useState<DiscountRedemption[]>([]);
  const [customers,  setCustomers] = useState<any[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [apiError,   setApiError]  = useState('');
  const [tab,        setTab]       = useState<TabId>('overview');
  const [dialog,     setDialog]    = useState<'deactivate' | 'archive' | null>(null);
  const [actioning,  setActioning] = useState(false);

  const discId = Number(id);

  const fetchDisc = useCallback(async () => {
    setLoading(true); setApiError('');
    try { setDisc(await getDiscountById(discId)); }
    catch (err: any) { setApiError(err?.response?.status === 404 ? 'Discount not found.' : getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [discId]);

  useEffect(() => { fetchDisc(); }, [fetchDisc]);
  useEffect(() => {
    if (tab === 'history')  getRedemptions(discId).then(setRedemptions).catch(() => {});
    if (tab === 'validate') getCustomers({ limit: 200 }).then(r => setCustomers(r.customers)).catch(() => {});
  }, [tab, discId]);

  const handleAction = async () => {
    if (!disc || !dialog) return;
    setActioning(true);
    try {
      if (dialog === 'deactivate') { await updateDiscount(disc.id, { status: 'inactive' }); success('Deactivated', ''); }
      else                         { await archiveDiscount(disc.id);                        success('Archived',     ''); }
      setDialog(null); fetchDisc();
    } catch (err) { te('Failed', getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-60 bg-slate-200 rounded animate-pulse" />
        <div className="card p-6 space-y-3">{[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${70 - i * 8}%` }} />
        ))}</div>
      </div>
    );
  }

  if (apiError || !disc) {
    return (
      <div className="p-6"><div className="card p-8 flex flex-col items-center">
        <p className="text-sm text-slate-600 mb-4">{apiError || 'Not found.'}</p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/discounts')}>Back</Button>
      </div></div>
    );
  }

  const usedUp = disc.usage_limit != null
    ? Math.round((disc.usage_count / disc.usage_limit) * 100)
    : null;

  return (
    <div className="space-y-6 p-6">
      <Link to="/discounts" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="w-4 h-4" /> Discounts
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Tag className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{disc.discount_name}</h1>
              <StatusBadge status={disc.status} />
              {disc.is_stackable && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Stackable</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{disc.discount_code}</span>
              <span className="text-2xl font-black text-indigo-700">{formatDiscountValue(disc)}</span>
            </div>
            {disc.description && <p className="text-sm text-slate-500 mt-1">{disc.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" leftIcon={Pencil} onClick={() => navigate(`/discounts/${disc.id}/edit`)}>Edit</Button>
            {disc.status === 'active' && (
              <Button variant="secondary" size="sm" leftIcon={Ban} onClick={() => setDialog('deactivate')}>Deactivate</Button>
            )}
            {disc.status !== 'archived' && (
              <Button variant="danger" size="sm" leftIcon={Archive} onClick={() => setDialog('archive')}>Archive</Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1 px-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Configuration */}
            <div className="card p-5">
              <SectionTitle icon={Tag} title="Configuration" />
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Type">{disc.discount_type === 'percentage' ? 'Percentage' : 'Fixed Amount'}</InfoCard>
                <InfoCard label="Value">{formatDiscountValue(disc)}</InfoCard>
                {disc.maximum_discount_amount && <InfoCard label="Max Discount">{disc.currency} {disc.maximum_discount_amount}</InfoCard>}
                {disc.minimum_purchase_amount && <InfoCard label="Min Purchase">{disc.currency} {disc.minimum_purchase_amount}</InfoCard>}
                <InfoCard label="Applies To">{APPLICABLE_TO_LABELS[disc.applicable_to]}</InfoCard>
                <InfoCard label="Requires Coupon">{disc.requires_coupon_code ? 'Yes' : 'No'}</InfoCard>
              </div>
            </div>
            {/* Validity */}
            <div className="card p-5">
              <SectionTitle icon={Calendar} title="Validity Period" />
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Start Date">{fmtDate(disc.start_date)}</InfoCard>
                <InfoCard label="End Date">{fmtDate(disc.end_date)}</InfoCard>
              </div>
            </div>
            {/* Applicability detail */}
            {(disc.applicable_product_ids?.length || disc.applicable_plan_ids?.length) && (
              <div className="card p-5">
                <SectionTitle icon={Layers} title="Applicable Items" />
                {disc.applicable_product_ids?.length && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-400 mb-1">Product IDs</p>
                    <div className="flex flex-wrap gap-1">
                      {disc.applicable_product_ids.map(pid => (
                        <span key={pid} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">#{pid}</span>
                      ))}
                    </div>
                  </div>
                )}
                {disc.applicable_plan_ids?.length && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Plan IDs</p>
                    <div className="flex flex-wrap gap-1">
                      {disc.applicable_plan_ids.map(pid => (
                        <span key={pid} className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded">#{pid}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-6">
            {/* Usage */}
            <div className="card p-5">
              <SectionTitle icon={Users} title="Usage" />
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Used</span>
                  <span className="font-bold text-slate-900">{disc.usage_count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Limit</span>
                  <span className="font-medium">{disc.usage_limit ?? '∞'}</span>
                </div>
                {disc.usage_limit_per_customer && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Per Customer</span>
                    <span className="font-medium">{disc.usage_limit_per_customer}</span>
                  </div>
                )}
                {usedUp !== null && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Used</span><span>{usedUp}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={cn('h-2 rounded-full transition-all',
                        usedUp >= 90 ? 'bg-red-500' : usedUp >= 60 ? 'bg-amber-400' : 'bg-emerald-500')}
                        style={{ width: `${Math.min(usedUp, 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Audit */}
            <div className="card p-5">
              <SectionTitle icon={Clock} title="Audit" />
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex justify-between"><span>Created</span><span className="font-medium text-slate-700">{fmtDate(disc.created_at)}</span></div>
                <div className="flex justify-between"><span>Updated</span><span className="font-medium text-slate-700">{fmtDate(disc.updated_at)}</span></div>
                {disc.created_by && <div className="flex justify-between"><span>Created by</span><span className="font-medium text-slate-700">#{disc.created_by}</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Redemption History */}
      {tab === 'history' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>{['#','Customer','Invoice','Subscription','Quotation','Amount','Date','Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {redemptions.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No redemptions recorded.</td></tr>
              ) : redemptions.map((r, i) => {
                const rCfg = REDEMPTION_STATUS_CONFIG[r.status as RedemptionStatus];
                return (
                  <tr key={r.id} className={cn('border-b border-slate-100', i % 2 === 0 ? 'bg-white' : 'bg-slate-50')}>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.id}</td>
                    <td className="px-4 py-3 text-slate-700">#{r.customer_id}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.invoice_id ? `#${r.invoice_id}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.subscription_id ? `#${r.subscription_id}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.quotation_id ? `#${r.quotation_id}` : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {disc.currency} {Number(r.redemption_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(r.redeemed_at || r.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', rCfg?.bg, rCfg?.text)}>
                        {rCfg?.label ?? r.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Validate tab */}
      {tab === 'validate' && <ValidatePanel discount={disc} customers={customers} />}

      {/* Confirm dialogs */}
      {dialog && (
        <ConfirmDialog
          open={true}
          onOpenChange={o => { if (!o) setDialog(null); }}
          loading={actioning}
          onConfirm={handleAction}
          title={dialog === 'deactivate' ? 'Deactivate Discount' : 'Archive Discount'}
          description={dialog === 'deactivate'
            ? `Deactivate "${disc.discount_name}"? Customers cannot use it while inactive.`
            : `Archive "${disc.discount_name}"? This is a soft-delete.`}
          confirmLabel={dialog === 'deactivate' ? 'Deactivate' : 'Archive'}
          variant={dialog === 'archive' ? 'danger' : 'primary'}
        />
      )}
    </div>
  );
}
