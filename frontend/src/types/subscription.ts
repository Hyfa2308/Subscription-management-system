/**
 * REVORA – Subscription TypeScript interfaces.
 */

export type SubscriptionStatus =
  | 'draft' | 'pending' | 'active' | 'paused' | 'expired' | 'closed' | 'cancelled';

export type BillingFrequency =
  | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';

export interface CustomerSummary {
  id:           number;
  customer_code: string;
  full_name:    string;
  email:        string;
  company_name: string | null;
  phone:        string | null;
}

export interface PlanSummary {
  id:                number;
  plan_code:         string;
  plan_name:         string;
  billing_frequency: string;
  billing_interval:  number;
  plan_price:        string;
  currency:          string;
}

export interface ActivityItem {
  id:              number;
  subscription_id: number;
  actor_id:        number | null;
  action:          string;
  details:         string | null;
  created_at:      string;
}

export interface Subscription {
  id:                  number;
  subscription_number: string;
  customer_id:         number;
  plan_id:             number;
  product_id:          number | null;
  variant_id:          number | null;
  quotation_id:        number | null;
  start_date:          string;
  end_date:            string | null;
  next_billing_date:   string | null;
  billing_frequency:   BillingFrequency;
  billing_interval:    number;
  currency:            string;
  unit_price:          string;
  quantity:            string;
  discount_amount:     string;
  tax_amount:          string;
  total_amount:        string;
  status:              SubscriptionStatus;
  auto_renew:          boolean;
  pause_reason:        string | null;
  closure_reason:      string | null;
  snap_plan_name:      string | null;
  snap_product_name:   string | null;
  snap_pause_allowed:         boolean;
  snap_renewal_allowed:       boolean;
  snap_early_closure_allowed: boolean;
  created_by:          number | null;
  created_at:          string;
  updated_at:          string;
}

export interface SubscriptionDetail extends Subscription {
  customer:   CustomerSummary | null;
  plan:       PlanSummary | null;
  activities: ActivityItem[];
}

export interface SubscriptionCreateRequest {
  customer_id:  number;
  plan_id:      number;
  variant_id?:  number;
  quotation_id?: number;
  start_date:   string;
  end_date?:    string;
  quantity:     string;
  auto_renew:   boolean;
}

export interface SubscriptionUpdateRequest {
  end_date?:   string;
  quantity?:   string;
  auto_renew?: boolean;
}

export interface SubscriptionListResponse {
  subscriptions: Subscription[];
  total:         number;
  page:          number;
  page_size:     number;
  total_pages:   number;
}

export interface SubscriptionStats {
  total:         number;
  draft:         number;
  pending:       number;
  active:        number;
  paused:        number;
  expired:       number;
  closed:        number;
  cancelled:     number;
  expiring_soon: number;
}

// ── Display helpers ──────────────────────────────────────────────────────────

export const SUBSCRIPTION_STATUS_CONFIG: Record<SubscriptionStatus, {
  label: string; bg: string; text: string; dot: string;
}> = {
  draft:     { label: 'Draft',     bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
  pending:   { label: 'Pending',   bg: 'bg-yellow-50',   text: 'text-yellow-700',  dot: 'bg-yellow-400'  },
  active:    { label: 'Active',    bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  paused:    { label: 'Paused',    bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-400'    },
  expired:   { label: 'Expired',   bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500'   },
  closed:    { label: 'Closed',    bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400'   },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-400'     },
};

export const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  daily:       'Daily',
  weekly:      'Weekly',
  monthly:     'Monthly',
  quarterly:   'Quarterly',
  half_yearly: 'Half-Yearly',
  yearly:      'Yearly',
};

export function formatMoney(amount: string | number, currency = 'INR'): string {
  return `${currency} ${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

export function fmtDate(dt?: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
