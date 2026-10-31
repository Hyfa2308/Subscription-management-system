/**
 * REVORA – Subscription Plan TypeScript interfaces.
 */

export type BillingFrequency =
  | 'daily' | 'weekly' | 'monthly'
  | 'quarterly' | 'half_yearly' | 'yearly';

export type PlanStatus = 'active' | 'inactive' | 'archived';

export interface ProductSummary {
  id:           number;
  product_code: string;
  product_name: string;
  base_price:   string;
  currency:     string;
}

export interface VariantSummary {
  id:           number;
  variant_code: string;
  variant_name: string;
  final_price:  string;
}

export interface SubscriptionPlan {
  id:        number;
  plan_code: string;
  plan_name: string;
  description: string | null;

  product_id: number;
  variant_id: number | null;

  plan_price:     string;
  currency:       string;
  setup_fee:      string;
  tax_percentage: string;

  billing_frequency: BillingFrequency;
  billing_interval:  number;
  trial_period_days: number;

  discount_allowed:      boolean;
  pause_allowed:         boolean;
  renewal_allowed:       boolean;
  early_closure_allowed: boolean;

  minimum_commitment_period: number | null;

  status:     PlanStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlanDetail extends SubscriptionPlan {
  product: ProductSummary | null;
  variant: VariantSummary | null;
}

export interface PlanCreateRequest {
  plan_name:    string;
  description?: string;
  product_id:   number;
  variant_id?:  number | null;
  plan_price:   string;
  currency:     string;
  setup_fee:    string;
  tax_percentage: string;
  billing_frequency: BillingFrequency;
  billing_interval:  number;
  trial_period_days: number;
  discount_allowed:      boolean;
  pause_allowed:         boolean;
  renewal_allowed:       boolean;
  early_closure_allowed: boolean;
  minimum_commitment_period?: number | null;
  status: PlanStatus;
}

export type PlanUpdateRequest = Partial<PlanCreateRequest>;

export interface PlanListResponse {
  plans:       SubscriptionPlan[];
  total:       number;
  page:        number;
  page_size:   number;
  total_pages: number;
}

export interface PlanStats {
  total:    number;
  active:   number;
  inactive: number;
  archived: number;
  most_popular_frequency: BillingFrequency | null;
}

export interface PlanFilters {
  search:            string;
  product_id:        number | '';
  billing_frequency: BillingFrequency | '';
  status:            PlanStatus | '';
  sort_by:           string;
  sort_dir:          'asc' | 'desc';
  page:              number;
  limit:             number;
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  daily:       'Daily',
  weekly:      'Weekly',
  monthly:     'Monthly',
  quarterly:   'Quarterly',
  half_yearly: 'Half-Yearly',
  yearly:      'Yearly',
};

export const PLAN_STATUS_COLORS: Record<PlanStatus, { bg: string; text: string; dot: string }> = {
  active:   { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  inactive: { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'  },
  archived: { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'  },
};

export const BILLING_FREQUENCY_COLORS: Record<BillingFrequency, { bg: string; text: string }> = {
  daily:       { bg: 'bg-red-50',    text: 'text-red-600'    },
  weekly:      { bg: 'bg-orange-50', text: 'text-orange-600' },
  monthly:     { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  quarterly:   { bg: 'bg-blue-50',   text: 'text-blue-700'   },
  half_yearly: { bg: 'bg-teal-50',   text: 'text-teal-700'   },
  yearly:      { bg: 'bg-violet-50', text: 'text-violet-700' },
};
