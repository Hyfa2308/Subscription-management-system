/**
 * REVORA – CustomerDetailPage
 * Dedicated page at /customers/:id showing full customer profile,
 * overview metrics, tabbed sections (Subscriptions, Quotations, etc.),
 * and a real activity timeline.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Archive, Building2, Mail, Phone, MapPin,
  CalendarDays, Hash, Users, Clock, Layers, FileText, CreditCard,
  Receipt, Activity, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog';
import { useToast } from '@/components/common/Toast';
import { getCustomerById, archiveCustomer } from '@/services/customerApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { ROUTES } from '@/config/routes';
import { cn } from '@/utils/cn';
import type { CustomerDetail, CustomerActivity, CustomerStatus } from '@/types/customer';
import { STATUS_COLORS } from '@/types/customer';

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CustomerStatus }) {
  const s = STATUS_COLORS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', s.bg, s.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Info row ───────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <div className="text-sm text-slate-700 mt-0.5 font-medium">{value}</div>
      </div>
    </div>
  );
}

// ── Overview metric ────────────────────────────────────────────────────────────

function OverviewCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 italic">{note}</p>
    </div>
  );
}

// ── Activity timeline ──────────────────────────────────────────────────────────

const EVENT_ICONS: Record<string, React.ElementType> = {
  'customer.created':    Users,
  'customer.updated':    Edit3,
  'customer.archived':   Archive,
  'customer.activated':  CheckCircle2,
  'customer.deactivated': RefreshCw,
};

function ActivityTimeline({ activities }: { activities: CustomerActivity[] }) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
          <Activity className="w-5 h-5 text-slate-300" />
        </div>
        <p className="text-sm text-slate-500">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200" />
      <div className="space-y-4">
        {activities.map(a => {
          const Icon = EVENT_ICONS[a.event_type] ?? Activity;
          return (
            <div key={a.id} className="relative flex items-start gap-4">
              <div className="absolute -left-4 w-5 h-5 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center mt-0.5">
                <Icon className="w-2.5 h-2.5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 leading-snug">{a.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  {a.actor_name && (
                    <span className="text-xs text-slate-400">{a.actor_name}</span>
                  )}
                  <span className="text-xs text-slate-300">·</span>
                  <time className="text-xs text-slate-400">
                    {new Date(a.created_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </time>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Empty module tab ───────────────────────────────────────────────────────────

function ComingSoonTab({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-indigo-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-1">{label} will appear here</p>
      <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
        Related {label.toLowerCase()} records will be available once the {label} module is connected.
      </p>
    </div>
  );
}

// ── Tab navigation ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',       label: 'Overview'      },
  { id: 'subscriptions',  label: 'Subscriptions' },
  { id: 'quotations',     label: 'Quotations'    },
  { id: 'invoices',       label: 'Invoices'      },
  { id: 'payments',       label: 'Payments'      },
  { id: 'activity',       label: 'Activity'      },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [customer,       setCustomer]       = useState<CustomerDetail | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [apiError,       setApiError]       = useState('');
  const [activeTab,      setActiveTab]      = useState('overview');
  const [editOpen,       setEditOpen]       = useState(false);
  const [archiveOpen,    setArchiveOpen]    = useState(false);
  const [archiving,      setArchiving]      = useState(false);

  const customerId = Number(id);

  const fetchCustomer = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setApiError('');
    try {
      const data = await getCustomerById(customerId);
      setCustomer(data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setApiError('Customer not found.');
      } else {
        setApiError(getApiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

  const handleArchive = async () => {
    if (!customer) return;
    setArchiving(true);
    try {
      await archiveCustomer(customer.id);
      success('Customer archived', `${customer.full_name} has been archived.`);
      setArchiveOpen(false);
      fetchCustomer();
    } catch (err) {
      toastError('Archive failed', getApiErrorMessage(err));
    } finally {
      setArchiving(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="card p-6 space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${70 - i * 10}%` }} />)}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (apiError || !customer) {
    return (
      <div className="p-6">
        <div className="card p-8 flex flex-col items-center text-center">
          <p className="text-sm text-slate-600 mb-4">{apiError || 'Customer not found.'}</p>
          <Button variant="secondary" size="sm" onClick={() => navigate(ROUTES.CUSTOMERS)}>
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  // ── Address string ────────────────────────────────────────────────────────────
  const addressParts = [
    customer.billing_address,
    customer.city,
    customer.state,
    customer.country,
    customer.postal_code,
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : '—';

  return (
    <div className="space-y-6 p-6">
      {/* ── Back button ──────────────────────────────────────────────── */}
      <div>
        <Link
          to={ROUTES.CUSTOMERS}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Customers
        </Link>
      </div>

      {/* ── Header card ──────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            {customer.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{customer.full_name}</h1>
              <StatusBadge status={customer.status} />
            </div>
            {customer.company_name && (
              <p className="text-sm text-slate-500">{customer.company_name}</p>
            )}
            <p className="text-xs font-mono text-slate-400 mt-1">{customer.customer_code}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary" size="sm" leftIcon={Edit3}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
            {customer.status !== 'archived' && (
              <Button
                variant="danger" size="sm" leftIcon={Archive}
                onClick={() => setArchiveOpen(true)}
              >
                Archive
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Overview metrics (placeholder until modules connect) ──────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Subscriptions',  value: '—', note: 'Subscriptions module pending' },
          { label: 'Active Subscriptions', value: '—', note: 'Subscriptions module pending' },
          { label: 'Total Invoiced',       value: '—', note: 'Invoices module pending' },
          { label: 'Total Paid',           value: '—', note: 'Payments module pending' },
          { label: 'Outstanding Balance',  value: '—', note: 'Payments module pending' },
        ].map(m => (
          <OverviewCard key={m.label} {...m} />
        ))}
      </div>

      {/* ── Main content grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer info panel */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Customer Information</h2>
          <InfoRow icon={Mail}       label="Email"        value={<a href={`mailto:${customer.email}`} className="text-indigo-600 hover:underline">{customer.email}</a>} />
          <InfoRow icon={Phone}      label="Phone"        value={customer.phone || '—'} />
          <InfoRow icon={Building2}  label="Company"      value={customer.company_name || '—'} />
          <InfoRow icon={MapPin}     label="Address"      value={fullAddress} />
          <InfoRow icon={Hash}       label="Customer Code" value={<span className="font-mono text-xs">{customer.customer_code}</span>} />
          <InfoRow icon={CalendarDays} label="Registered" value={new Date(customer.registration_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
          <InfoRow icon={Activity}   label="Status"       value={<StatusBadge status={customer.status} />} />
        </div>

        {/* Tabs panel */}
        <div className="lg:col-span-2 card overflow-hidden">
          {/* Tab list */}
          <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-thin">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  activeTab === tab.id
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === 'overview' && (
              <div className="prose-sm">
                <p className="text-sm text-slate-500 leading-relaxed">
                  Full profile overview for <strong>{customer.full_name}</strong>.
                  Subscription activity, billing history, and analytics will appear here as
                  additional modules are connected.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-semibold text-slate-400 mb-1">Registration Date</p>
                    <p className="text-sm font-medium text-slate-700">
                      {new Date(customer.registration_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-semibold text-slate-400 mb-1">Account Status</p>
                    <StatusBadge status={customer.status} />
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'subscriptions' && <ComingSoonTab label="Subscriptions" icon={Layers} />}
            {activeTab === 'quotations'    && <ComingSoonTab label="Quotations"    icon={FileText} />}
            {activeTab === 'invoices'      && <ComingSoonTab label="Invoices"      icon={Receipt} />}
            {activeTab === 'payments'      && <ComingSoonTab label="Payments"      icon={CreditCard} />}
            {activeTab === 'activity'      && (
              <ActivityTimeline activities={customer.activities} />
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Dialog ──────────────────────────────────────────────── */}
      <CustomerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
        onSuccess={fetchCustomer}
      />

      {/* ── Archive Confirm ───────────────────────────────────────────── */}
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive Customer"
        description={`Are you sure you want to archive ${customer.full_name}? They cannot be used for new business transactions unless restored.`}
        confirmLabel="Archive"
        variant="danger"
        loading={archiving}
        onConfirm={handleArchive}
      />
    </div>
  );
}
