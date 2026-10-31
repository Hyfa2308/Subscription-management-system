/**
REVORA – Customer Intelligence Dashboard Page.
Route: /customer-intelligence

Features:
  - Header: Customer Intelligence (Understand customer health, predict churn risks, and improve retention.)
  - Real database-derived KPI cards (Total Analysed, Healthy, Needs Attention, High Churn Risk)
  - Interactive Recharts Visualizations:
      * Customer Health Overview (Healthy, Needs Attention, At Risk, Insufficient Data)
      * Churn Risk Distribution (Low Risk, Medium Risk, High Risk)
  - Customer Segments quick filters
  - Server-side paginated, filterable, sortable Customer Intelligence Table
  - Customer detail navigation (/customer-intelligence/customers/:id)
*/

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Search,
  Filter,
  RefreshCw,
  ArrowUpDown,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import { PageHeader } from '@/components/common/PageHeader';
import { MetricCard } from '@/components/common/MetricCard';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { TableSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useToast } from '@/components/common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getIntelligenceSummary,
  getSegments,
  getCustomersIntelligence,
} from '@/services/customerIntelligenceApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import type {
  CustomerIntelligenceItem,
  IntelligenceFilters,
  IntelligenceSummary,
  SegmentSummary,
  HealthCategory,
  ChurnRiskCategory,
} from '@/types/customerIntelligence';

// ── Color tokens ─────────────────────────────────────────────────────────────

const HEALTH_CONFIG: Record<HealthCategory, { label: string; bg: string; text: string; fill: string; dot: string }> = {
  healthy: {
    label: 'Healthy',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    text: 'text-emerald-700',
    fill: '#10B981',
    dot: 'bg-emerald-500',
  },
  needs_attention: {
    label: 'Needs Attention',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    text: 'text-amber-700',
    fill: '#F59E0B',
    dot: 'bg-amber-500',
  },
  at_risk: {
    label: 'At Risk',
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    text: 'text-rose-700',
    fill: '#EF4444',
    dot: 'bg-rose-500',
  },
  insufficient_data: {
    label: 'Insufficient Data',
    bg: 'bg-slate-100 text-slate-600 border-slate-200',
    text: 'text-slate-600',
    fill: '#94A3B8',
    dot: 'bg-slate-400',
  },
};

const RISK_CONFIG: Record<ChurnRiskCategory, { label: string; bg: string; text: string; fill: string; dot: string }> = {
  low_risk: {
    label: 'Low Risk',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    text: 'text-emerald-700',
    fill: '#10B981',
    dot: 'bg-emerald-500',
  },
  medium_risk: {
    label: 'Medium Risk',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    text: 'text-amber-700',
    fill: '#F59E0B',
    dot: 'bg-amber-500',
  },
  high_risk: {
    label: 'High Risk',
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    text: 'text-rose-700',
    fill: '#EF4444',
    dot: 'bg-rose-500',
  },
  insufficient_data: {
    label: 'Insufficient Data',
    bg: 'bg-slate-100 text-slate-600 border-slate-200',
    text: 'text-slate-600',
    fill: '#94A3B8',
    dot: 'bg-slate-400',
  },
};

// ── Badges ───────────────────────────────────────────────────────────────────

function HealthScoreBadge({ score, category }: { score: number | null; category: HealthCategory }) {
  const conf = HEALTH_CONFIG[category] ?? HEALTH_CONFIG.insufficient_data;

  if (score === null || category === 'insufficient_data') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Insufficient Data
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-12 bg-slate-100 rounded-full h-2 overflow-hidden flex-shrink-0">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
          )}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className={cn('text-xs font-bold font-mono', conf.text)}>
        {Math.round(score)}
      </span>
    </div>
  );
}

function RiskBadge({ category, score }: { category: ChurnRiskCategory; score: number | null }) {
  const conf = RISK_CONFIG[category] ?? RISK_CONFIG.insufficient_data;

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', conf.bg)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', conf.dot)} />
      {conf.label}
      {score !== null && category !== 'insufficient_data' && (
        <span className="text-[10px] opacity-75 font-mono">({Math.round(score)})</span>
      )}
    </span>
  );
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function CustomerIntelligencePage() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  // State
  const [summary, setSummary] = useState<IntelligenceSummary | null>(null);
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerIntelligenceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [healthCategory, setHealthCategory] = useState<HealthCategory | ''>('');
  const [churnRisk, setChurnRisk] = useState<ChurnRiskCategory | ''>('');
  const [selectedSegment, setSelectedSegment] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('health_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 10;

  const debouncedSearch = useDebounce(search, 300);

  // ── Fetch summary & segments ───────────────────────────────────────────────
  const fetchOverviewData = useCallback(async () => {
    try {
      const [sumRes, segRes] = await Promise.all([
        getIntelligenceSummary(),
        getSegments(),
      ]);
      setSummary(sumRes);
      setSegments(segRes.segments);
    } catch (err) {
      console.error('Failed to load intelligence summary:', err);
    }
  }, []);

  // ── Fetch table list ───────────────────────────────────────────────────────
  const fetchCustomers = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setTableLoading(true);
    setError(null);

    try {
      const res = await getCustomersIntelligence({
        search: debouncedSearch || undefined,
        health_category: healthCategory || undefined,
        churn_risk: churnRisk || undefined,
        segment: selectedSegment || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        limit,
      });

      setCustomers(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg);
      toastError('Error loading intelligence data', msg);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [debouncedSearch, healthCategory, churnRisk, selectedSegment, sortBy, sortDir, page, limit, toastError]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  useEffect(() => {
    fetchCustomers(loading && !summary);
  }, [fetchCustomers]);

  const handleRefresh = async () => {
    await Promise.all([fetchOverviewData(), fetchCustomers()]);
    success('Intelligence Refreshed', 'Customer health scores and churn indicators updated.');
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <PageHeader
        title="Customer Intelligence"
        description="Understand customer health, predict churn risks, and improve retention."
        primaryAction={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            leftIcon={RefreshCw}
            className="flex items-center gap-2"
          >
            Refresh Data
          </Button>
        }
      />

      {/* ── Top KPI Cards (Real DB-Derived Metrics) ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Analysed Customers"
          value={summary ? summary.total_analysed_customers.toLocaleString() : '—'}
          icon={Brain}
          note="Monitored in intelligence engine"
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <MetricCard
          label="Healthy Customers"
          value={summary ? summary.healthy_customers.toLocaleString() : '—'}
          icon={ShieldCheck}
          note={
            summary && summary.total_analysed_customers > 0
              ? `${Math.round((summary.healthy_customers / summary.total_analysed_customers) * 100)}% of customer base (75–100)`
              : 'Score 75–100'
          }
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <MetricCard
          label="Needs Attention"
          value={summary ? summary.needs_attention_customers.toLocaleString() : '—'}
          icon={AlertTriangle}
          note={
            summary && summary.total_analysed_customers > 0
              ? `${Math.round((summary.needs_attention_customers / summary.total_analysed_customers) * 100)}% of customer base (50–74)`
              : 'Score 50–74'
          }
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <MetricCard
          label="High Churn Risk Customers"
          value={summary ? summary.high_churn_risk_customers.toLocaleString() : '—'}
          icon={Flame}
          note={
            summary && summary.total_analysed_customers > 0
              ? `${summary.high_churn_risk_customers} accounts requiring immediate retention`
              : 'Immediate action needed'
          }
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
        />
      </div>

      {/* ── Visual Analytics (Charts Section) ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Health Overview */}
        <div className="card p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Customer Health Overview</h3>
              <p className="text-xs text-slate-500">Distribution across operational health categories</p>
            </div>
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
              Score: 0–100
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            <div className="sm:col-span-6 h-52">
              {summary && summary.health_distribution.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.health_distribution}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {summary.health_distribution.map((entry, index) => {
                        const fill =
                          HEALTH_CONFIG[entry.category as HealthCategory]?.fill ?? '#94A3B8';
                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any, _: any, item: any) => [
                        `${val} customers (${item.payload.percentage}%)`,
                        item.payload.label,
                      ]}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400">
                  No health distribution data
                </div>
              )}
            </div>

            <div className="sm:col-span-6 space-y-2.5">
              {summary?.health_distribution.map(item => {
                const conf = HEALTH_CONFIG[item.category as HealthCategory] ?? HEALTH_CONFIG.insufficient_data;
                return (
                  <div
                    key={item.category}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer"
                    onClick={() => {
                      setHealthCategory(prev => (prev === item.category ? '' : (item.category as HealthCategory)));
                      setPage(1);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2.5 h-2.5 rounded-full', conf.dot)} />
                      <span className="text-xs font-medium text-slate-700">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{item.count}</span>
                      <span className="text-[11px] text-slate-400 w-10 text-right">({item.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Churn Risk Distribution */}
        <div className="card p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Churn Risk Distribution</h3>
              <p className="text-xs text-slate-500">Predicted customer attrition risk breakdown</p>
            </div>
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
              Rule-based Engine
            </span>
          </div>

          <div className="mt-4 h-52">
            {summary && summary.churn_risk_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.churn_risk_distribution}
                  margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="category"
                    tickFormatter={(cat) => RISK_CONFIG[cat as ChurnRiskCategory]?.label || cat}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    formatter={(val: any, _: any, item: any) => [
                      `${val} customers (${item.payload.percentage}%)`,
                      item.payload.label,
                    ]}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[6, 6, 0, 0]}
                  >
                    {summary.churn_risk_distribution.map((entry, index) => {
                      const fill = RISK_CONFIG[entry.category as ChurnRiskCategory]?.fill ?? '#94A3B8';
                      return (
                        <Cell
                          key={`bar-${index}`}
                          fill={fill}
                          cursor="pointer"
                          onClick={() => {
                            setChurnRisk(prev => (prev === entry.category ? '' : (entry.category as ChurnRiskCategory)));
                            setPage(1);
                          }}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                No churn distribution data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Customer Segments Quick Filter Tabs ─────────────────────────────── */}
      {segments.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => { setSelectedSegment(''); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5',
              selectedSegment === ''
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            All Customers ({total})
          </button>
          {segments.map(seg => (
            <button
              key={seg.segment_id}
              onClick={() => {
                setSelectedSegment(prev => (prev === seg.segment_id ? '' : seg.segment_id));
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 border',
                selectedSegment === seg.segment_id
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <span>{seg.name}</span>
              <span className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px]',
                selectedSegment === seg.segment_id ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'
              )}>
                {seg.customer_count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Customer Intelligence Table Card ───────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* Filters and Search Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer name, code, or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Health Category Filter */}
            <select
              value={healthCategory}
              onChange={(e) => { setHealthCategory(e.target.value as HealthCategory | ''); setPage(1); }}
              aria-label="Filter by Health Category"
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Health Categories</option>
              <option value="healthy">Healthy (75–100)</option>
              <option value="needs_attention">Needs Attention (50–74)</option>
              <option value="at_risk">At Risk (0–49)</option>
              <option value="insufficient_data">Insufficient Data</option>
            </select>

            {/* Churn Risk Filter */}
            <select
              value={churnRisk}
              onChange={(e) => { setChurnRisk(e.target.value as ChurnRiskCategory | ''); setPage(1); }}
              aria-label="Filter by Churn Risk"
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Churn Risks</option>
              <option value="low_risk">Low Risk</option>
              <option value="medium_risk">Medium Risk</option>
              <option value="high_risk">High Risk</option>
              <option value="insufficient_data">Insufficient Data</option>
            </select>

            {/* Clear filters button */}
            {(search || healthCategory || churnRisk || selectedSegment) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setHealthCategory('');
                  setChurnRisk('');
                  setSelectedSegment('');
                  setPage(1);
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} cols={8} />
          </div>
        ) : error ? (
          <div className="p-8">
            <ErrorState
              title="Failed to load intelligence data"
              message={error}
              onRetry={handleRefresh}
            />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Brain}
              title="No customer intelligence records found"
              description="Try adjusting your search criteria or clearing filters to view customer health and churn data."
              action={
                (search || healthCategory || churnRisk || selectedSegment) ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setHealthCategory('');
                      setChurnRisk('');
                      setSelectedSegment('');
                    }}
                  >
                    Reset Filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 cursor-pointer select-none" onClick={() => handleSort('customer_name')}>
                    <div className="flex items-center gap-1.5">
                      <span>Customer</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4 text-center">Active Subs</th>
                  <th className="py-3.5 px-4 cursor-pointer select-none" onClick={() => handleSort('health_score')}>
                    <div className="flex items-center gap-1.5">
                      <span>Health Score</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Health Category</th>
                  <th className="py-3.5 px-4 cursor-pointer select-none" onClick={() => handleSort('risk_score')}>
                    <div className="flex items-center gap-1.5">
                      <span>Churn Risk</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer select-none text-right" onClick={() => handleSort('recurring_revenue')}>
                    <div className="flex items-center justify-end gap-1.5">
                      <span>MRR</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Recommended Action</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {customers.map((c) => (
                  <tr
                    key={c.customer_id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/customer-intelligence/customers/${c.customer_id}`)}
                  >
                    {/* Customer Name & Email */}
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                          <span>{c.customer_name}</span>
                          {c.is_demo_data && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                              Demo Telemetry
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{c.customer_email}</div>
                      </div>
                    </td>

                    {/* Customer Code */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {c.customer_code}
                      </span>
                    </td>

                    {/* Active Subscriptions */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        {c.active_subscriptions}
                      </span>
                    </td>

                    {/* Health Score */}
                    <td className="py-3.5 px-4">
                      <HealthScoreBadge score={c.health_score} category={c.health_category} />
                    </td>

                    {/* Health Category */}
                    <td className="py-3.5 px-4">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
                        HEALTH_CONFIG[c.health_category]?.bg || HEALTH_CONFIG.insufficient_data.bg
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', HEALTH_CONFIG[c.health_category]?.dot || HEALTH_CONFIG.insufficient_data.dot)} />
                        {HEALTH_CONFIG[c.health_category]?.label || 'Insufficient Data'}
                      </span>
                    </td>

                    {/* Churn Risk */}
                    <td className="py-3.5 px-4">
                      <RiskBadge category={c.churn_risk} score={c.churn_risk_score} />
                    </td>

                    {/* Recurring Revenue */}
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900 font-mono">
                      ${c.recurring_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Recommended Action */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-xs text-slate-600 truncate" title={c.recommended_action}>
                        {c.recommended_action}
                      </p>
                    </td>

                    {/* Row Detail Navigation */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/customer-intelligence/customers/${c.customer_id}`)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                        rightIcon={ArrowRight}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination */}
        {!loading && !error && customers.length > 0 && (
          <div className="border-t border-slate-100 bg-white">
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
    </div>
  );
}
