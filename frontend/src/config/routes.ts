/**
 * REVORA – Centralized route definitions.
 * All page routes are defined here for single-source-of-truth navigation.
 */

export const ROUTES = {
  // Auth
  LOGIN:           '/login',
  REGISTER:        '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD:  '/reset-password',

  // Core
  DASHBOARD: '/',

  // Customer Management
  CUSTOMERS:       '/customers',
  CUSTOMER_DETAIL: '/customers/:id',
  CUSTOMER_NEW:    '/customers/new',

  // Products & Plans
  PRODUCTS:       '/products',
  PRODUCT_DETAIL: '/products/:id',
  PLANS:          '/plans',

  // Quotations
  QUOTATIONS:       '/quotations',
  QUOTATION_DETAIL: '/quotations/:id',

  // Subscriptions
  SUBSCRIPTIONS:       '/subscriptions',
  SUBSCRIPTION_DETAIL: '/subscriptions/:id',
  SUBSCRIPTION_NEW:    '/subscriptions/new',

  // Billing & Invoices
  INVOICES:       '/invoices',
  INVOICE_DETAIL: '/invoices/:id',

  // Discounts
  DISCOUNTS: '/discounts',

  // Payments
  PAYMENTS: '/payments',

  // Intelligence
  CUSTOMER_INTELLIGENCE:        '/customer-intelligence',
  CUSTOMER_INTELLIGENCE_DETAIL: '/customer-intelligence/customers/:id',
  REVENUE_INTELLIGENCE:         '/revenue-intelligence',
  REVENUE_RESCUE:        '/revenue-rescue',
  AI_ASSISTANT:          '/assistant',

  // Settings
  SETTINGS: '/settings',
} as const;

export type RouteKey  = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
