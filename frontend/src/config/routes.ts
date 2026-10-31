/**
 * REVORA – Centralized route definitions.
 * All page routes are defined here for single-source-of-truth navigation.
 */

export const ROUTES = {
  // Core
  DASHBOARD: '/',
  
  // Customer Management
  CUSTOMERS: '/customers',
  CUSTOMER_DETAIL: '/customers/:id',
  CUSTOMER_NEW: '/customers/new',

  // Products & Plans
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/products/:id',

  // Subscriptions
  SUBSCRIPTIONS: '/subscriptions',
  SUBSCRIPTION_DETAIL: '/subscriptions/:id',
  SUBSCRIPTION_NEW: '/subscriptions/new',

  // Billing & Invoices
  INVOICES: '/invoices',
  INVOICE_DETAIL: '/invoices/:id',

  // Payments
  PAYMENTS: '/payments',

  // Revenue Intelligence
  ANALYTICS: '/analytics',
  REVENUE_RESCUE: '/revenue-rescue',

  // Settings
  SETTINGS: '/settings',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
