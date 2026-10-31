/**
 * REVORA – Auth types and permission constants.
 */

export type UserRole = 'admin' | 'staff' | 'customer';

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user:          AuthUser | null;
  isAuthenticated: boolean;
  isLoading:     boolean;
}

export interface LoginCredentials {
  email:    string;
  password: string;
}

export interface RegisterData {
  full_name:        string;
  email:            string;
  phone?:           string;
  password:         string;
  confirm_password: string;
}

// ── Role permission map ────────────────────────────────────────────────────────

export const ROLE_PERMISSIONS = {
  admin: [
    'manage:customers', 'manage:products', 'manage:plans', 'manage:quotations',
    'manage:subscriptions', 'manage:invoices', 'manage:discounts', 'manage:payments',
    'view:customer_intelligence', 'view:revenue_intelligence', 'access:revenue_rescue',
    'access:ai_assistant', 'manage:users', 'access:settings',
  ],
  staff: [
    'manage:customers', 'manage:products', 'manage:quotations',
    'manage:subscriptions', 'manage:invoices', 'manage:payments',
    'view:customer_intelligence', 'view:revenue_intelligence', 'access:revenue_rescue',
    'access:ai_assistant',
  ],
  customer: [
    'view:own_profile', 'view:own_subscriptions', 'view:plans',
    'view:own_invoices', 'view:own_payments',
  ],
} as const satisfies Record<UserRole, readonly string[]>;

export function hasPermission(role: UserRole, permission: string): boolean {
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
}

// ── Customer-facing nav items ──────────────────────────────────────────────────
export const ROLE_LABELS: Record<UserRole, string> = {
  admin:    'Administrator',
  staff:    'Staff',
  customer: 'Customer',
};
