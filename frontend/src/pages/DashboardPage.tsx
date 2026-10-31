/**
 * REVORA – Dashboard / Overview page.
 * Visual foundation: KPI cards, chart containers, activity section.
 * No hardcoded business data — all values come from the API once modules are built.
 */

import React, { useEffect, useState } from 'react';
import {
  Users, RefreshCw, DollarSign, AlertTriangle,
  Calendar, Activity, ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { MetricCard } from '@/components/common/MetricCard';
import { ChartContainer } from '@/components/common/ChartContainer';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/common/Button';
import { checkHealth, type ConnectionStatus } from '@/services/healthService';
import { cn } from '@/utils/cn';

// ── Date filter placeholder ────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: 'This month', value: 'month' },
  { label: 'Last 3 months', value: '3m' },
  { label: 'This year', value: 'year' },
];

function DateRangeFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
      {DATE_RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            'px-3 py-1 rounded-md text-xs font-medium transition-all duration-150',
            value === r.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// ── Backend status banner ──────────────────────────────────────────────────────

function BackendBanner({ status }: { status: ConnectionStatus | null }) {
  if (!status) return null;
  if (status.connected) return null;

  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-amber-800">Backend Unavailable</p>
        <p className="text-xs text-amber-600 mt-0.5">
          {status.error ?? 'Cannot reach the REVORA backend. Start the server to see live data.'}
        </p>
        <code className="mt-1.5 inline-block text-[11px] bg-amber-100 px-2 py-1 rounded font-mono text-amber-800">
          uvicorn app.main:app --reload --port 8000
        </code>
      </div>
    </div>
  );
}

// ── KPI cards config ───────────────────────────────────────────────────────────

const KPI_CARDS = [
  {
    label:     'Total Customers',
    value:     '—',
    icon:      Users,
    iconColor: 'text-indigo-600',
    iconBg:    'bg-indigo-50',
    note:      'Awaiting backend data',
  },
  {
    label:     'Active Subscriptions',
    value:     '—',
    icon:      RefreshCw,
    iconColor: 'text-teal-600',
    iconBg:    'bg-teal-50',
    note:      'Awaiting backend data',
  },
  {
    label:     'Monthly Recurring Revenue',
    value:     '—',
    icon:      DollarSign,
    iconColor: 'text-emerald-600',
    iconBg:    'bg-emerald-50',
    note:      'Awaiting backend data',
  },
  {
    label:     'Revenue at Risk',
    value:     '—',
    icon:      AlertTriangle,
    iconColor: 'text-amber-600',
    iconBg:    'bg-amber-50',
    note:      'Awaiting backend data',
  },
];

// ── Recent activity placeholder ────────────────────────────────────────────────

function RecentActivity() {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
          <p className="text-xs text-slate-400 mt-0.5">Latest platform events</p>
        </div>
        <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors">
          View all <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="card-body">
        <EmptyState
          icon={Activity}
          title="No recent activity"
          description="Platform events, subscription changes, and billing activity will appear here once the backend integration is complete."
          compact
        />
      </div>
    </div>
  );
}

// ── Module status tracker ──────────────────────────────────────────────────────

const MODULES = [
  { label: 'Foundation & Setup',     status: 'done',    desc: 'Frontend + Backend initialized' },
  { label: 'Design System',          status: 'active',  desc: 'Component library and layout' },
  { label: 'Authentication',         status: 'planned', desc: 'JWT login, register, session' },
  { label: 'Customer Management',    status: 'planned', desc: 'CRUD, contacts, account types' },
  { label: 'Products & Plans',       status: 'planned', desc: 'Catalog, pricing, billing cycles' },
  { label: 'Subscriptions',          status: 'planned', desc: 'Lifecycle, renewals, cancellations' },
  { label: 'Invoicing & Billing',    status: 'planned', desc: 'Auto-generation, PDF export' },
  { label: 'Revenue Intelligence',   status: 'planned', desc: 'Churn prediction, MRR forecast, AI' },
];

function ModuleRoadmap() {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-slate-800">Development Roadmap</h3>
        <p className="text-xs text-slate-400 mt-0.5">Module build status</p>
      </div>
      <div className="card-body space-y-2">
        {MODULES.map(({ label, status, desc }) => (
          <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/70 hover:bg-slate-50 transition-colors">
            <div className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              status === 'done'    && 'bg-emerald-500',
              status === 'active'  && 'bg-indigo-500 animate-pulse',
              status === 'planned' && 'bg-slate-300',
            )} />
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-xs font-medium truncate',
                status === 'done'    && 'text-emerald-700',
                status === 'active'  && 'text-indigo-700',
                status === 'planned' && 'text-slate-500',
              )}>
                {label}
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{desc}</p>
            </div>
            {status === 'done' && <StatusBadge variant="success" label="Done" dot={false} />}
            {status === 'active' && <StatusBadge variant="indigo" label="Active" dot={false} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState('month');
  const [connStatus, setConnStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    checkHealth().then(setConnStatus);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Welcome to REVORA"
        description="Your subscription and revenue operations, all in one place."
        primaryAction={
          <Button variant="primary" size="sm" leftIcon={Calendar}>
            Schedule Demo
          </Button>
        }
      >
        {/* Date range filter */}
        <div className="mt-3">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
      </PageHeader>

      {/* Backend offline warning */}
      <BackendBanner status={connStatus} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI_CARDS.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartContainer
          title="Monthly Revenue Trend"
          description="MRR over the selected period"
          className="lg:col-span-2"
          height={260}
          hasData={false}
        />
        <ChartContainer
          title="Revenue by Plan"
          description="Distribution across subscription tiers"
          height={260}
          hasData={false}
        />
      </div>

      {/* Subscription growth */}
      <ChartContainer
        title="Subscription Growth"
        description="New, renewed, and churned subscriptions"
        height={220}
        hasData={false}
        action={
          <Button variant="ghost" size="sm">
            Export
          </Button>
        }
      />

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivity />
        <ModuleRoadmap />
      </div>
    </div>
  );
}
