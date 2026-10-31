/**
 * REVORA – Invoice TypeScript interfaces.
 */

export type InvoiceStatus =
  | 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id:                  number;
  invoice_id:          number;
  product_id:          number | null;
  variant_id:          number | null;
  plan_id:             number | null;
  description:         string;
  quantity:            string;
  unit_price:          string;
  discount_percentage: string;
  tax_percentage:      string;
  line_subtotal:       string;
  line_discount:       string;
  line_tax:            string;
  line_total:          string;
}

export interface InvoiceItemCreate {
  product_id?:         number;
  variant_id?:         number;
  plan_id?:            number;
  description:         string;
  quantity:            string;
  unit_price:          string;
  discount_percentage: string;
  tax_percentage:      string;
}

export interface CustomerSummary {
  id:            number;
  customer_code: string;
  full_name:     string;
  email:         string;
  company_name:  string | null;
  phone:         string | null;
}

export interface SubscriptionSummary {
  id:                  number;
  subscription_number: string;
  snap_plan_name:      string | null;
  billing_frequency:   string;
}

export interface Invoice {
  id:                   number;
  invoice_number:       string;
  customer_id:          number;
  subscription_id:      number | null;
  quotation_id:         number | null;
  invoice_date:         string;
  due_date:             string | null;
  billing_period_start: string | null;
  billing_period_end:   string | null;
  currency:             string;
  subtotal:             string;
  discount_amount:      string;
  tax_amount:           string;
  total_amount:         string;
  amount_paid:          string;
  amount_due:           string;
  status:               InvoiceStatus;
  notes:                string | null;
  terms_and_conditions: string | null;
  created_by:           number | null;
  created_at:           string;
  updated_at:           string;
}

export interface InvoiceDetail extends Invoice {
  customer:     CustomerSummary | null;
  subscription: SubscriptionSummary | null;
  items:        InvoiceItem[];
}

export interface InvoiceCreateRequest {
  customer_id:          number;
  subscription_id?:     number;
  quotation_id?:        number;
  invoice_date:         string;
  due_date?:            string;
  billing_period_start?: string;
  billing_period_end?:  string;
  currency?:            string;
  notes?:               string;
  terms_and_conditions?: string;
  items:                InvoiceItemCreate[];
}

export interface InvoiceUpdateRequest {
  due_date?:             string;
  notes?:                string;
  terms_and_conditions?: string;
}

export interface InvoiceListResponse {
  invoices:    Invoice[];
  total:       number;
  page:        number;
  page_size:   number;
  total_pages: number;
}

export interface InvoiceStats {
  total:              number;
  draft:              number;
  unpaid:             number;
  partially_paid:     number;
  paid:               number;
  overdue:            number;
  cancelled:          number;
  total_outstanding:  string;
  total_paid_amount:  string;
}

// ── Billing types ─────────────────────────────────────────────────────────────

export interface BillingRun {
  id:               number;
  triggered_by:     number | null;
  started_at:       string;
  finished_at:      string | null;
  status:           string;
  processed:        number;
  invoices_created: number;
  skipped:          number;
  errors:           number;
  error_detail:     string | null;
  dry_run:          boolean;
}

export interface BillingRunResult {
  billing_run_id:  number;
  processed:       number;
  invoices_created: number;
  skipped:         number;
  errors:          number;
  error_details:   string[];
  dry_run:         boolean;
}

export interface UpcomingBillingItem {
  subscription_id:     number;
  subscription_number: string;
  customer_id:         number;
  customer_name:       string;
  plan_name:           string | null;
  next_billing_date:   string;
  billing_frequency:   string;
  expected_amount:     string;
  currency:            string;
  days_until_due:      number;
}

export interface BillingStatus {
  due_today:      number;
  due_in_7_days:  number;
  due_in_30_days: number;
  total_expected: string;
}

// ── Display helpers ──────────────────────────────────────────────────────────

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, {
  label: string; bg: string; text: string; dot: string;
}> = {
  draft:          { label: 'Draft',          bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400'   },
  unpaid:         { label: 'Unpaid',         bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  partially_paid: { label: 'Partially Paid', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400'    },
  paid:           { label: 'Paid',           bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  overdue:        { label: 'Overdue',        bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'     },
  cancelled:      { label: 'Cancelled',      bg: 'bg-slate-100',  text: 'text-slate-400',   dot: 'bg-slate-300'   },
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
