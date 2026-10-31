/**
 * REVORA – Quotation TypeScript interfaces.
 */

export type QuotationStatus =
  | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface QuotationItemCreate {
  product_id?:          number | null;
  variant_id?:          number | null;
  plan_id?:             number | null;
  description:          string;
  quantity:             string;
  unit_price:           string;
  discount_percentage:  string;
  tax_percentage:       string;
}

export interface QuotationItem extends QuotationItemCreate {
  id:            number;
  quotation_id:  number;
  line_subtotal: string;
  line_discount: string;
  line_tax:      string;
  line_total:    string;
}

export interface CustomerSummary {
  id:           number;
  customer_code: string;
  full_name:    string;
  email:        string;
  company_name: string | null;
  phone:        string | null;
}

export interface Quotation {
  id:               number;
  quotation_number: string;
  customer_id:      number;
  quotation_date:   string;
  expiry_date:      string | null;
  status:           QuotationStatus;
  currency:         string;
  subtotal:         string;
  discount_amount:  string;
  tax_amount:       string;
  total_amount:     string;
  notes:            string | null;
  terms_and_conditions: string | null;
  created_by:       number | null;
  created_at:       string;
  updated_at:       string;
}

export interface QuotationDetail extends Quotation {
  customer: CustomerSummary | null;
  items:    QuotationItem[];
}

export interface QuotationCreateRequest {
  customer_id:          number;
  quotation_date?:      string;
  expiry_date?:         string;
  currency:             string;
  notes?:               string;
  terms_and_conditions?: string;
  items:                QuotationItemCreate[];
}

export type QuotationUpdateRequest = Partial<QuotationCreateRequest>;

export interface QuotationListResponse {
  quotations:  Quotation[];
  total:       number;
  page:        number;
  page_size:   number;
  total_pages: number;
}

export interface QuotationStats {
  total:     number;
  draft:     number;
  sent:      number;
  accepted:  number;
  rejected:  number;
  expired:   number;
  cancelled: number;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export interface QuotationTemplate {
  id:                           number;
  template_name:                string;
  description:                  string | null;
  default_notes:                string | null;
  default_terms_and_conditions: string | null;
  default_validity_days:        number;
  is_active:                    boolean;
  created_by:                   number | null;
  created_at:                   string;
  updated_at:                   string;
}

export interface TemplateCreateRequest {
  template_name:                string;
  description?:                 string;
  default_notes?:               string;
  default_terms_and_conditions?: string;
  default_validity_days:        number;
  is_active:                    boolean;
}

export type TemplateUpdateRequest = Partial<TemplateCreateRequest>;

export interface TemplateListResponse {
  templates:   QuotationTemplate[];
  total:       number;
  page:        number;
  page_size:   number;
  total_pages: number;
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const QUOTATION_STATUS_CONFIG: Record<QuotationStatus, {
  label: string; bg: string; text: string; dot: string;
}> = {
  draft:     { label: 'Draft',     bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'  },
  sent:      { label: 'Sent',      bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500'   },
  accepted:  { label: 'Accepted',  bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500'},
  rejected:  { label: 'Rejected',  bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500'    },
  expired:   { label: 'Expired',   bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500'  },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-300'  },
};

export function formatMoney(amount: string | number, currency = 'INR'): string {
  return `${currency} ${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

// Status transition helpers
export const ALLOWED_ACTIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft:     ['sent', 'cancelled'],
  sent:      ['accepted', 'rejected', 'expired', 'cancelled'],
  accepted:  [],
  rejected:  [],
  expired:   [],
  cancelled: [],
};
