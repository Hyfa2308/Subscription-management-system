/**
 * REVORA – Customer TypeScript interfaces.
 */

export type CustomerStatus = 'active' | 'inactive' | 'archived';

export interface Customer {
  id:               number;
  customer_code:    string;
  full_name:        string;
  email:            string;
  phone:            string | null;
  company_name:     string | null;
  billing_address:  string | null;
  city:             string | null;
  state:            string | null;
  country:          string | null;
  postal_code:      string | null;
  status:           CustomerStatus;
  registration_date: string;
  created_at:       string;
  updated_at:       string;
  created_by:       number | null;
}

export interface CustomerActivity {
  id:          number;
  event_type:  string;
  description: string;
  actor_name:  string | null;
  created_at:  string;
}

export interface CustomerDetail extends Customer {
  activities: CustomerActivity[];
}

export interface CustomerCreateRequest {
  full_name:       string;
  email:           string;
  phone?:          string;
  company_name?:   string;
  billing_address?: string;
  city?:           string;
  state?:          string;
  country?:        string;
  postal_code?:    string;
}

export type CustomerUpdateRequest = Partial<CustomerCreateRequest>;

export interface CustomerListResponse {
  customers:   Customer[];
  total:       number;
  page:        number;
  page_size:   number;
  total_pages: number;
}

export interface CustomerStats {
  total:          number;
  active:         number;
  inactive:       number;
  archived:       number;
  new_this_month: number;
  new_this_week:  number;
}

export interface CustomerFilters {
  search:   string;
  status:   CustomerStatus | '';
  sort_by:  string;
  sort_dir: 'asc' | 'desc';
  page:     number;
  limit:    number;
}

export const STATUS_COLORS: Record<CustomerStatus, { bg: string; text: string; dot: string }> = {
  active:   { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  inactive: { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  archived: { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400'   },
};
