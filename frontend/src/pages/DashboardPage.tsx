/**
 * REVORA – Executive Dashboard
 * Route: /dashboard
 * "One dashboard. Complete business visibility."
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCw, Download, TrendingUp, TrendingDown, Minus,
  Users, Activity, DollarSign, AlertCircle, AlertTriangle,
  CheckCircle2, Clock, XCircle, BarChart3, Zap,
  UserPlus, Package, FileText, Receipt, Layers,
  Bell, ChevronRight, ArrowRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';
import {
  getDashboardOverview, getRevenueTrend, getSubscriptionTrend,
  getCustomerTrend, getRecentActivities, getUpcomingRenewals, getDashboardAlerts,
} from '@/services/dashboardApi';
import type {
  DashboardOverview, TrendPoint, Activity as ActivityT,
  UpcomingRenewal, DashboardAlert,
} from '@/services/dashboardApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(val: string | number, compact = false): string {
  const n = Number(val);
  if (compact) {
    if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

function fmtDate(dt?: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtRelative(dt?: string | null): string {
  if (!dt) return '';
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const PIE_COLORS: Record<string, string> = {
  active: '#6366f1', paused: '#f59e0b', pending: '#3b82f6',
  expired: '#94a3b8', cancelled: '#ef4444',
  paid: '#10b981', unpaid: '#f59e0b', partially_paid: '#6366f1',
  overdue: '#ef4444', draft: '#94a3b8',
};

const ALERT_CFG = {
  high:   { icon: AlertCircle,   bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   badge: 'bg-red-100 text-red-700'    },
  medium: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  low:    { icon: Bell,          bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700',  badge: 'bg-blue-100 text-blue-700'   },
};

const QUICK_ACTIONS = [
  { label: 'Add Customer',        icon: UserPlus,  to: '/customers',         color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { label: 'Add Product',         icon: Package,   to: '/products',          color: 'bg-blue-50 text-blue-700 hover:bg-blue-100'       },
  { label: 'Create Plan',         icon: Layers,    to: '/plans',             color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  { label: 'Create Quotation',    icon: FileText,  to: '/quotations/new',    color: 'bg-amber-50 text-amber-700 hover:bg-amber-100'    },
  { label: 'Create Subscription', icon: Activity,  to: '/subscriptions/new', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { label: 'Create Invoice',      icon: Receipt,   to: '/invoices/new',      color: 'bg-rose-50 text-rose-700 hover:bg-rose-100'       },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-slate-100 rounded-lg', className)} />;
}

function TrendBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
        active ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>
      {label}
    </button>
  );
}

function SectionHeader({ title, sub, cta, ctaTo }: { title: string; sub?: string; cta?: string; ctaTo?: string }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {cta && ctaTo && (
        <Link to={ctaTo} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          {cta} <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, trend, trendLabel, loading, unavailable }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  trend?: 'up' | 'down' | 'flat'; trendLabel?: string;
  loading?: boolean; unavailable?: boolean;
}) {
  const TI = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const tc = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400';
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
      </div>
      {loading ? (<><Skeleton className="h-8 w-28" /><Skeleton className="h-3 w-20" /></>) :
       unavailable ? (
        <div><p className="text-2xl font-black text-slate-300">—</p><p className="text-xs text-slate-400 mt-1">Not available</p></div>
      ) : (
        <div>
          <p className="text-2xl font-black text-slate-900">{value}</p>
          {(sub || trendLabel) && (
            <div className="flex items-center gap-1.5 mt-1">
              {trend && <TI className={cn('w-3 h-3', tc)} />}
              {trendLabel && <span className={cn('text-xs font-medium', tc)}>{trendLabel}</span>}
              {sub && <span className="text-xs text-slate-400">{sub}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const isMonetary = (name: string) =>
    ['collected','invoiced','outstanding','revenue','mrr','arr'].some(k => name.toLowerCase().includes(k));
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">
            {isMonetary(p.name) ? fmtCurrency(p.value, true) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function activityIcon(action: string): React.ElementType {
  const a = action.toLowerCase();
  if (a.includes('activated')) return CheckCircle2;
  if (a.includes('paused'))    return Clock;
  if (a.includes('resumed'))   return Activity;
  if (a.includes('renewed'))   return RefreshCw;
  if (a.includes('cancelled')) return XCircle;
  return BarChart3;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();

  const [overview,   setOverview]   = useState<DashboardOverview | null>(null);
  const [revTrend,   setRevTrend]   = useState<TrendPoint[]>([]);
  const [subTrend,   setSubTrend]   = useState<TrendPoint[]>([]);
  const [custTrend,  setCustTrend]  = useState<TrendPoint[]>([]);
  const [activities, setActivities] = useState<ActivityT[]>([]);
  const [renewals,   setRenewals]   = useState<UpcomingRenewal[]>([]);
  const [alerts,     setAlerts]     = useState<DashboardAlert[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const [revMonths,  setRevMonths]  = useState(6);
  const [subMonths,  setSubMonths]  = useState(6);
  const [custMonths, setCustMonths] = useState(6);
  const [periodDays, setPeriodDays] = useState(30);

  const lastFetched = useRef<Date | null>(null);

  const fetchAll = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const [ov, rv, sv, cv, act, ren, al] = await Promise.allSettled([
        getDashboardOverview(periodDays),
        getRevenueTrend(revMonths),
        getSubscriptionTrend(subMonths),
        getCustomerTrend(custMonths),
        getRecentActivities(15),
        getUpcomingRenewals(30, 8),
        getDashboardAlerts(),
      ]);
      if (ov.status  === 'fulfilled') setOverview(ov.value);   else setError('Failed to load overview.');
      if (rv.status  === 'fulfilled') setRevTrend(rv.value);
      if (sv.status  === 'fulfilled') setSubTrend(sv.value);
      if (cv.status  === 'fulfilled') setCustTrend(cv.value);
      if (act.status === 'fulfilled') setActivities(act.value);
      if (ren.status === 'fulfilled') setRenewals(ren.value);
      if (al.status  === 'fulfilled') setAlerts(al.value);
      lastFetched.current = new Date();
    } catch { setError('Unexpected error loading dashboard.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [periodDays, revMonths, subMonths, custMonths]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => { if (!loading) getRevenueTrend(revMonths).then(setRevTrend).catch(() => {}); }, [revMonths]);
  useEffect(() => { if (!loading) getSubscriptionTrend(subMonths).then(setSubTrend).catch(() => {}); }, [subMonths]);
  useEffect(() => { if (!loading) getCustomerTrend(custMonths).then(setCustTrend).catch(() => {}); }, [custMonths]);

  const ov = overview;
  const growthPct = ov?.revenue.revenue_growth_pct ?? 0;
  const custGrowth = ov?.customers.growth_rate_pct ?? 0;

  const subPieData = ov ? [
    { name: 'Active',    value: ov.subscriptions.active,    color: PIE_COLORS.active    },
    { name: 'Paused',    value: ov.subscriptions.paused,    color: PIE_COLORS.paused    },
    { name: 'Pending',   value: ov.subscriptions.pending,   color: PIE_COLORS.pending   },
    { name: 'Expired',   value: ov.subscriptions.expired,   color: PIE_COLORS.expired   },
    { name: 'Cancelled', value: ov.subscriptions.cancelled, color: PIE_COLORS.cancelled },
  ].filter(d => d.value > 0) : [];

  const invPieData = ov ? [
    { name: 'Paid',           value: ov.invoices.paid,           color: PIE_COLORS.paid          },
    { name: 'Unpaid',         value: ov.invoices.unpaid,         color: PIE_COLORS.unpaid        },
    { name: 'Partially Paid', value: ov.invoices.partially_paid, color: PIE_COLORS.partially_paid },
    { name: 'Overdue',        value: ov.invoices.overdue,        color: PIE_COLORS.overdue       },
    { name: 'Draft',          value: ov.invoices.draft,          color: PIE_COLORS.draft         },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-7 p-6 pb-16">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Monitor business performance and subscription operations from one place.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={periodDays} onChange={e => { setPeriodDays(Number(e.target.value)); }}
            className="form-input text-sm py-2 w-36">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
          <button onClick={() => fetchAll(true)} title="Refresh"
            className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-colors">
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:border-slate-300 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Customers"       loading={loading} unavailable={!ov}
          value={ov ? fmtNum(ov.customers.total) : '0'}
          sub={ov ? `${ov.customers.active} active` : undefined}
          icon={Users} iconBg="bg-violet-50" iconColor="text-violet-600"
          trend={custGrowth > 0 ? 'up' : custGrowth < 0 ? 'down' : 'flat'}
          trendLabel={custGrowth !== 0 ? `${custGrowth > 0 ? '+' : ''}${custGrowth}%` : undefined}
        />
        <KpiCard label="Active Subscriptions"  loading={loading} unavailable={!ov}
          value={ov ? fmtNum(ov.subscriptions.active) : '0'}
          sub={ov?.subscriptions.expiring_soon ? `${ov.subscriptions.expiring_soon} expiring soon` : undefined}
          icon={Activity} iconBg="bg-emerald-50" iconColor="text-emerald-600"
        />
        <KpiCard label="MRR"                   loading={loading} unavailable={!ov}
          value={ov ? fmtCurrency(ov.revenue.mrr, true) : '₹0'}
          sub={ov ? `ARR ${fmtCurrency(ov.revenue.arr, true)}` : undefined}
          icon={TrendingUp} iconBg="bg-indigo-50" iconColor="text-indigo-600"
        />
        <KpiCard label="Revenue Collected"     loading={loading} unavailable={!ov}
          value={ov ? fmtCurrency(ov.revenue.collected, true) : '₹0'}
          icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          trend={growthPct > 0 ? 'up' : growthPct < 0 ? 'down' : 'flat'}
          trendLabel={growthPct !== 0 ? `${growthPct > 0 ? '+' : ''}${growthPct}%` : undefined}
        />
        <KpiCard label="Outstanding Revenue"   loading={loading} unavailable={!ov}
          value={ov ? fmtCurrency(ov.revenue.outstanding, true) : '₹0'}
          icon={AlertCircle} iconBg="bg-amber-50" iconColor="text-amber-600"
        />
        <KpiCard label="Overdue Invoices"      loading={loading} unavailable={!ov}
          value={ov ? fmtNum(ov.invoices.overdue) : '0'}
          sub={ov ? `${fmtCurrency(ov.invoices.outstanding_amount, true)} outstanding` : undefined}
          icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-600"
          trend={ov && ov.invoices.overdue > 0 ? 'down' : 'flat'}
        />
        <KpiCard label="Failed Payments"       loading={loading}
          unavailable={!ov?.payments.available}
          value={ov?.payments.available ? fmtNum(ov.payments.failed) : '—'}
          icon={XCircle} iconBg="bg-slate-100" iconColor="text-slate-400"
        />
        <KpiCard label="Revenue Growth"        loading={loading} unavailable={!ov}
          value={ov ? `${growthPct >= 0 ? '+' : ''}${growthPct}%` : '—'}
          sub="vs. previous period"
          icon={TrendingUp} iconBg="bg-violet-50" iconColor="text-violet-600"
          trend={growthPct > 0 ? 'up' : growthPct < 0 ? 'down' : 'flat'}
          trendLabel={growthPct > 0 ? 'Growth' : growthPct < 0 ? 'Decline' : 'Stable'}
        />
      </div>

      {/* Revenue Performance */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900">Revenue Performance</h2>
            <p className="text-xs text-slate-500 mt-0.5">Total invoiced vs. collected vs. outstanding per month.</p>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {[3,6,12].map(m => <TrendBtn key={m} label={`${m}M`} active={revMonths === m} onClick={() => setRevMonths(m)} />)}
          </div>
        </div>
        {loading ? <Skeleton className="h-64 w-full" /> : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revTrend} margin={{ left: -10, right: 10 }}>
              <defs>
                <linearGradient id="gCollected"   x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gInvoiced"    x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOutstanding" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => fmtCurrency(v, true)} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="total_invoiced" name="Invoiced"    stroke="#10b981" fill="url(#gInvoiced)"    strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="collected"      name="Collected"   stroke="#6366f1" fill="url(#gCollected)"   strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="outstanding"    name="Outstanding" stroke="#f59e0b" fill="url(#gOutstanding)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Subscription Distribution + Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="card p-6 lg:col-span-2">
          <SectionHeader title="Subscription Distribution" sub="By current status" cta="View All" ctaTo="/subscriptions" />
          {loading ? <Skeleton className="h-52 w-full" /> : subPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={subPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                  {subPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [fmtNum(Number(v)), '']} />

                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-52 text-slate-400">
              <Activity className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No subscription data yet.</p>
            </div>
          )}
        </div>
        <div className="card p-6 lg:col-span-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex-1">
              <h2 className="text-base font-bold text-slate-900">Subscription Growth</h2>
              <p className="text-xs text-slate-500 mt-0.5">New subscriptions per month.</p>
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {[3,6,12].map(m => <TrendBtn key={m} label={`${m}M`} active={subMonths === m} onClick={() => setSubMonths(m)} />)}
            </div>
          </div>
          {loading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={subTrend} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="new" name="New Subscriptions" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Customer Growth */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900">Customer Growth</h2>
            <p className="text-xs text-slate-500 mt-0.5">New registrations per month.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {[3,6,12].map(m => <TrendBtn key={m} label={`${m}M`} active={custMonths === m} onClick={() => setCustMonths(m)} />)}
            </div>
            <Link to="/customers" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total',  val: ov?.customers.total         ?? 0 },
            { label: 'Active', val: ov?.customers.active        ?? 0 },
            { label: 'New',    val: ov?.customers.new_customers ?? 0 },
          ].map(({ label, val }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-slate-900">{loading ? '—' : fmtNum(val)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        {loading ? <Skeleton className="h-52 w-full" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={custTrend} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="new" name="New Customers" stroke="#6366f1" strokeWidth={2.5}
                dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Invoice Status + Upcoming Renewals */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="card p-6 lg:col-span-2">
          <SectionHeader title="Invoice Status" sub="Distribution by status" cta="View All" ctaTo="/invoices" />
          {loading ? <Skeleton className="h-52 w-full" /> : invPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={invPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                  {invPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [fmtNum(Number(v)), '']} />

                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-52 text-slate-400">
              <Receipt className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No invoice data yet.</p>
            </div>
          )}
          {!loading && ov && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Paid',   val: ov.invoices.paid,   bg: 'bg-emerald-50', text: 'text-emerald-700' },
                { label: 'Unpaid', val: ov.invoices.unpaid, bg: 'bg-amber-50',   text: 'text-amber-700'   },
                { label: 'Overdue',val: ov.invoices.overdue,bg: 'bg-red-50',     text: 'text-red-700'     },
              ].map(({ label, val, bg, text }) => (
                <div key={label} className={cn('p-2 rounded-lg', bg)}>
                  <p className={cn('text-sm font-bold', text)}>{fmtNum(val)}</p>
                  <p className={cn('text-xs', text)}>{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6 lg:col-span-3">
          <SectionHeader title="Upcoming Renewals" sub="Active subscriptions due within 30 days" cta="View All" ctaTo="/subscriptions" />
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : renewals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Clock className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No renewals in the next 30 days.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {renewals.map(r => (
                <Link key={r.subscription_id} to={`/subscriptions/${r.subscription_id}`}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors group">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black',
                    (r.days_until_due ?? 99) <= 3 ? 'bg-red-100 text-red-700' :
                    (r.days_until_due ?? 99) <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700')}>
                    {r.days_until_due}d
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{r.customer_name}</p>
                    <p className="text-xs text-slate-500">{r.subscription_number} · {r.billing_frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{fmtCurrency(r.expected_amount, true)}</p>
                    <p className="text-xs text-slate-400">{fmtDate(r.next_billing_date)}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="card p-6 lg:col-span-3">
          <SectionHeader title="Recent Activity" sub="Latest subscription lifecycle events" />
          {loading ? (
            <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Activity className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No subscription activity recorded yet.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100" />
              <div className="space-y-4 pl-10">
                {activities.map(act => {
                  const Icon = activityIcon(act.action);
                  return (
                    <div key={act.id} className="relative">
                      <div className="absolute -left-6 w-5 h-5 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center">
                        <Icon className="w-2.5 h-2.5 text-indigo-600" />
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{act.description}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{act.customer_name} · {act.subscription_number}</p>
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">{fmtRelative(act.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="card p-6 lg:col-span-2">
          <SectionHeader title="Business Alerts" sub={`${alerts.length} active alert(s)`} />
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mb-2 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-600">All clear!</p>
              <p className="text-xs text-slate-400 mt-1">No business alerts at this time.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((a, i) => {
                const cfg = ALERT_CFG[a.severity];
                const Icon = cfg.icon;
                return (
                  <Link key={i} to={a.link}
                    className={cn('flex items-start gap-3 p-3 rounded-xl border transition-colors hover:shadow-sm', cfg.bg, cfg.border)}>
                    <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', cfg.text)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={cn('text-xs font-bold truncate', cfg.text)}>{a.title}</p>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0', cfg.badge)}>{a.severity}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{a.description}</p>
                      <p className={cn('text-xs font-semibold mt-1 flex items-center gap-1', cfg.text)}>
                        {a.action} <ChevronRight className="w-3 h-3" />
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quotation Snapshot */}
      {ov && (
        <div className="card p-6">
          <SectionHeader title="Quotation Snapshot"
            sub={`${ov.quotations.conversion_rate_pct}% conversion rate (accepted / sent+accepted+rejected+expired)`}
            cta="View All" ctaTo="/quotations" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total',    val: ov.quotations.total,    bg: 'bg-slate-50',   text: 'text-slate-800' },
              { label: 'Draft',    val: ov.quotations.draft,    bg: 'bg-slate-50',   text: 'text-slate-500' },
              { label: 'Sent',     val: ov.quotations.sent,     bg: 'bg-blue-50',    text: 'text-blue-700'  },
              { label: 'Accepted', val: ov.quotations.accepted, bg: 'bg-emerald-50', text: 'text-emerald-700'},
              { label: 'Rejected', val: ov.quotations.rejected, bg: 'bg-red-50',     text: 'text-red-700'   },
              { label: 'Expired',  val: ov.quotations.expired,  bg: 'bg-amber-50',   text: 'text-amber-700' },
            ].map(({ label, val, bg, text }) => (
              <div key={label} className={cn('rounded-xl p-3 text-center', bg)}>
                <p className={cn('text-2xl font-black', text)}>{fmtNum(val)}</p>
                <p className={cn('text-xs mt-0.5', text)}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card p-6">
        <SectionHeader title="Quick Actions" sub="Common operations at your fingertips." />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map(a => (
            <Link key={a.label} to={a.to}
              className={cn('flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 border-transparent transition-all hover:border-current hover:shadow-sm', a.color)}>
              <a.icon className="w-6 h-6" />
              <span className="text-xs font-semibold text-center leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {lastFetched.current && (
        <p className="text-center text-xs text-slate-400">
          Last updated {fmtRelative(lastFetched.current.toISOString())}
        </p>
      )}
    </div>
  );
}
