/**
 * REVORA – Discount TypeScript interfaces.
 */

export type DiscountType       = 'percentage' | 'fixed_amount';
export type DiscountApplicableTo = 'all' | 'products' | 'subscription_plans';
export type DiscountStatus     = 'active' | 'inactive' | 'expired' | 'archived';
export type RedemptionStatus   = 'reserved' | 'redeemed' | 'reversed';

export interface Discount {
  id:                       number;
  discount_code:            string;
  discount_name:            string;
  description:              string | null;
  discount_type:            DiscountType;
  discount_value:           string;
  currency:                 string;
  maximum_discount_amount:  string | null;
  minimum_purchase_amount:  string | null;
  start_date:               string;
  end_date:                 string | null;
  usage_limit:              number | null;
  usage_limit_per_customer: number | null;
  usage_count:              number;
  applicable_to:            DiscountApplicableTo;
  applicable_product_ids:   number[] | null;
  applicable_plan_ids:      number[] | null;
  is_stackable:             boolean;
  requires_coupon_code:     boolean;
  status:                   DiscountStatus;
  created_by:               number | null;
  created_at:               string;
  updated_at:               string;
}

export interface DiscountCreateRequest {
  discount_code?:            string;
  discount_name:             string;
  description?:              string;
  discount_type:             DiscountType;
  discount_value:            string;
  currency?:                 string;
  maximum_discount_amount?:  string;
  minimum_purchase_amount?:  string;
  start_date:                string;
  end_date?:                 string;
  usage_limit?:              number;
  usage_limit_per_customer?: number;
  applicable_to?:            DiscountApplicableTo;
  applicable_product_ids?:   number[];
  applicable_plan_ids?:      number[];
  is_stackable?:             boolean;
  requires_coupon_code?:     boolean;
  status?:                   DiscountStatus;
}

export interface DiscountUpdateRequest {
  discount_name?:            string;
  description?:              string;
  discount_value?:           string;
  maximum_discount_amount?:  string;
  minimum_purchase_amount?:  string;
  end_date?:                 string;
  usage_limit?:              number;
  usage_limit_per_customer?: number;
  applicable_to?:            DiscountApplicableTo;
  applicable_product_ids?:   number[];
  applicable_plan_ids?:      number[];
  is_stackable?:             boolean;
  status?:                   DiscountStatus;
}

export interface DiscountListResponse {
  discounts:   Discount[];
  total:       number;
  page:        number;
  page_size:   number;
  total_pages: number;
}

export interface DiscountStats {
  total:             number;
  active:            number;
  inactive:          number;
  expired:           number;
  archived:          number;
  total_redemptions: number;
}

export interface DiscountValidateRequest {
  discount_code:   string;
  customer_id:     number;
  purchase_amount: string;
  currency?:       string;
  product_ids?:    number[];
  plan_ids?:       number[];
  context?:        string;
}

export interface DiscountValidateResponse {
  valid:             boolean;
  reason:            string;
  discount_code:     string | null;
  discount_amount:   string;
  final_amount:      string;
  applicable_rules:  string[];
  discount_id:       number | null;
}

export interface DiscountRedemption {
  id:                number;
  discount_id:       number;
  customer_id:       number;
  quotation_id:      number | null;
  subscription_id:   number | null;
  invoice_id:        number | null;
  redemption_amount: string;
  redeemed_at:       string | null;
  status:            RedemptionStatus;
  created_at:        string;
}

export interface RedeemRequest {
  customer_id:      number;
  purchase_amount:  string;
  currency?:        string;
  product_ids?:     number[];
  plan_ids?:        number[];
  quotation_id?:    number;
  subscription_id?: number;
  invoice_id?:      number;
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const DISCOUNT_STATUS_CONFIG: Record<DiscountStatus, {
  label: string; bg: string; text: string; dot: string;
}> = {
  active:   { label: 'Active',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  inactive: { label: 'Inactive', bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
  expired:  { label: 'Expired',  bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  archived: { label: 'Archived', bg: 'bg-slate-100',  text: 'text-slate-400',   dot: 'bg-slate-300'   },
};

export const REDEMPTION_STATUS_CONFIG: Record<RedemptionStatus, {
  label: string; bg: string; text: string;
}> = {
  reserved: { label: 'Reserved', bg: 'bg-blue-50',    text: 'text-blue-700'    },
  redeemed: { label: 'Redeemed', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  reversed: { label: 'Reversed', bg: 'bg-red-50',     text: 'text-red-600'     },
};

export function fmtDate(dt?: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function formatDiscountValue(d: Discount): string {
  if (d.discount_type === 'percentage') return `${d.discount_value}%`;
  return `${d.currency} ${Number(d.discount_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export const APPLICABLE_TO_LABELS: Record<DiscountApplicableTo, string> = {
  all:                'All',
  products:           'Products',
  subscription_plans: 'Plans',
};
