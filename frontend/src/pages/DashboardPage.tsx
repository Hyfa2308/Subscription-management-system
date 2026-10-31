/**
 * REVORA – Dashboard page.
 * Professional overview shell with KPI cards, quick stats, and connection status.
 * Business data will populate from the API once modules are built.
 */

import React, { useEffect, useState } from 'react';
import {
  Users, RefreshCw, FileText, DollarSign,
  TrendingUp, TrendingDown, AlertTriangle,
  ArrowUpRight, Activity, Zap,
} from 'lucide-react';
import { checkHealth, type ConnectionStatus } from '@/services/healthService';
import { cn } from '@/utils/cn';
import { APP_NAME } from '@/config/app';

// ── Types ─────────────────────────────────────────────────────────────────────

interface KpiCard {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  note?: string;
}

// ── Static placeholder KPIs (will be replaced by API data in Module 2) ────────

const KPI_CARDS: KpiCard[] = [
  {
    label: 'Total Customers',
    value: '—',
    icon: Users,
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50',
    note: 'Connect backend to populate',
  },
  {
    label: 'Active Subscriptions',
    value: '—',
    icon: RefreshCw,
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-50',
    note: 'Connect backend to populate',
  },
  {
    label: 'Monthly Revenue (MRR)',
    value: '—',
    icon: DollarSign,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    note: 'Connect backend to populate',
  },
  {
    label: 'Open Invoices',
    value: '—',
    icon: FileText,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    note: 'Connect backend to populate',
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCardComponent({ card }: { card: KpiCard }) {
  const Icon = card.icon;
  const TrendIcon = card.trend === 'up' ? TrendingUp : TrendingDown;

  return (
    <div className="card card-hover p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 tracking-tight">{card.value}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', card.iconBg)}>
          <Icon className={cn('w-5 h-5', card.iconColor)} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {card.change && card.trend ? (
          <span className={cn(
            'flex items-center gap-1 text-xs font-semibold',
            card.trend === 'up' ? 'text-emerald-600' : 'text-red-600',
          )}>
            <TrendIcon className="w-3 h-3" />
            {card.change}
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">{card.note}</span>
        )}
      </div>
    </div>
  );
}

function BackendStatusPanel({ status }: { status: ConnectionStatus | null }) {
  if (!status) {
    return (
      <div className="card p-5 border-l-4 border-slate-300">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-slate-400 animate-pulse" />
          <p className="text-sm text-slate-500">Checking backend connection…</p>
        </div>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="card p-5 border-l-4 border-red-400 bg-red-50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">Backend Unavailable</p>
            <p className="text-xs text-red-600 mt-0.5">
              {status.error ?? 'Cannot reach the REVORA backend API.'}
            </p>
            <p className="text-xs text-red-500 mt-2">
              Start the backend: <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono">uvicorn app.main:app --reload</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const d = status.data!;
  return (
    <div className="card p-5 border-l-4 border-emerald-400 bg-emerald-50">
      <div className="flex items-start gap-3">
        <Activity className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-800">Backend Connected</p>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
            {[
              { label: 'Version', value: d.version },
              { label: 'Environment', value: d.environment },
              { label: 'Database', value: d.database },
              { label: 'Latency', value: status.latencyMs ? `${status.latencyMs} ms` : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-xs font-semibold text-emerald-900 capitalize">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { label: 'Add Customer', icon: Users, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' },
    { label: 'New Subscription', icon: RefreshCw, color: 'text-teal-600 bg-teal-50 hover:bg-teal-100' },
    { label: 'Create Invoice', icon: FileText, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
    { label: 'Revenue Rescue', icon: Zap, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
  ];
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-slate-700">Quick Actions</h3>
      </div>
      <div className="card-body grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map(({ label, icon: Icon, color }) => (
          <button
            key={label}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg text-xs font-medium transition-all duration-150',
              color,
            )}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WelcomeBanner() {
  return (
    <div className="rounded-xl bg-gradient-to-r from-[#14213D] to-[#1e3460] p-6 text-white mb-6 relative overflow-hidden">
      {/* Subtle decorative circles */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 right-24 w-32 h-32 bg-teal-500/10 rounded-full translate-y-1/2 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-500/30 text-indigo-200 rounded-full ring-1 ring-indigo-400/30">
            Foundation Ready
          </span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome to {APP_NAME}</h2>
        <p className="text-sm text-blue-200 mt-1 max-w-lg">
          Subscription Management & Revenue Intelligence Platform for Brightloop Software.
          The foundation is set — start building modules.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
            <ArrowUpRight className="w-3.5 h-3.5" />
            View API Docs
          </button>
          <button className="btn bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors ring-1 ring-white/20">
            Read README
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [connStatus, setConnStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    checkHealth().then(setConnStatus);
  }, []);

  return (
    <div className="space-y-6">
      <WelcomeBanner />

      {/* Backend Status */}
      <BackendStatusPanel status={connStatus} />

      {/* KPI Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Key Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {KPI_CARDS.map((card) => (
            <KpiCardComponent key={card.label} card={card} />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Module roadmap */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Development Roadmap</h3>
          <span className="badge badge-indigo">Phase 1 Complete</span>
        </div>
        <div className="card-body">
          <div className="space-y-3">
            {[
              { label: 'Foundation & Setup', status: 'done', desc: 'Frontend + Backend initialized, health check live' },
              { label: 'Customer Management', status: 'next', desc: 'CRUD for customers, contacts, account types' },
              { label: 'Products & Plans', status: 'pending', desc: 'Subscription products, pricing tiers, billing cycles' },
              { label: 'Subscription Lifecycle', status: 'pending', desc: 'Activation, renewal, cancellation workflows' },
              { label: 'Invoicing & Billing', status: 'pending', desc: 'Automated invoice generation, PDF export' },
              { label: 'Revenue Intelligence', status: 'pending', desc: 'Churn prediction, MRR forecasting, Revenue Rescue AI' },
            ].map(({ label, status, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                <div className={cn(
                  'mt-0.5 w-2 h-2 rounded-full flex-shrink-0',
                  status === 'done' ? 'bg-emerald-500' :
                  status === 'next' ? 'bg-indigo-500 animate-pulse' :
                  'bg-slate-300',
                )} />
                <div className="min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    status === 'done' ? 'text-emerald-700' :
                    status === 'next' ? 'text-indigo-700' :
                    'text-slate-600',
                  )}>{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                {status === 'done' && (
                  <span className="badge badge-success ml-auto text-[10px]">Done</span>
                )}
                {status === 'next' && (
                  <span className="badge badge-indigo ml-auto text-[10px]">Up Next</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
