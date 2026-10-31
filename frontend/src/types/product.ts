/**
 * REVORA – Product & ProductVariant TypeScript interfaces.
 */

export type ProductType   = 'one_time' | 'subscription';
export type BillingType   = 'one_time' | 'recurring';

export interface ProductVariant {
  id:               number;
  variant_code:     string;
  variant_name:     string;
  description:      string | null;
  price_adjustment: string;   // Decimal comes as string from JSON
  final_price:      string;
  is_active:        boolean;
  created_at:       string;
  updated_at:       string;
}

export interface Product {
  id:             number;
  product_code:   string;
  product_name:   string;
  description:    string | null;
  category:       string | null;
  product_type:   ProductType;
  billing_type:   BillingType;
  base_price:     string;     // Decimal → string
  currency:       string;
  tax_percentage: string;
  is_active:      boolean;
  created_by:     number | null;
  created_at:     string;
  updated_at:     string;
}

export interface ProductDetail extends Product {
  variants: ProductVariant[];
}

export interface ProductCreateRequest {
  product_name:   string;
  description?:   string;
  category?:      string;
  product_type:   ProductType;
  billing_type:   BillingType;
  base_price:     string;
  currency:       string;
  tax_percentage: string;
  is_active?:     boolean;
}

export type ProductUpdateRequest = Partial<ProductCreateRequest>;

export interface VariantCreateRequest {
  variant_name:     string;
  description?:     string;
  price_adjustment: string;
  is_active?:       boolean;
}

export type VariantUpdateRequest = Partial<VariantCreateRequest>;

export interface ProductListResponse {
  products:    Product[];
  total:       number;
  page:        number;
  page_size:   number;
  total_pages: number;
}

export interface ProductStats {
  total:         number;
  active:        number;
  inactive:      number;
  subscription:  number;
  one_time:      number;
  with_variants: number;
}

export interface ProductFilters {
  search:       string;
  category:     string;
  product_type: ProductType | '';
  billing_type: BillingType | '';
  is_active:    '' | 'true' | 'false';
  sort_by:      string;
  sort_dir:     'asc' | 'desc';
  page:         number;
  limit:        number;
}

// Display helpers
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  one_time:     'One-time',
  subscription: 'Subscription',
};

export const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  one_time:  'One-time',
  recurring: 'Recurring',
};

export const PRODUCT_TYPE_COLORS: Record<ProductType, { bg: string; text: string }> = {
  one_time:     { bg: 'bg-amber-50',  text: 'text-amber-700'  },
  subscription: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
};

export const BILLING_TYPE_COLORS: Record<BillingType, { bg: string; text: string }> = {
  one_time:  { bg: 'bg-slate-100', text: 'text-slate-600'  },
  recurring: { bg: 'bg-teal-50',   text: 'text-teal-700'   },
};
