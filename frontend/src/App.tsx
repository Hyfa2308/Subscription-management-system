/**
 * REVORA – Root application router.
 * All routes defined using React Router v6.
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { AppLayout } from '@/layouts/AppLayout';

// ── Pages ──────────────────────────────────────────────────────────────────────
import DashboardPage from '@/pages/DashboardPage';
import {
  CustomersPage,
  ProductsPage,
  PlansPage,
  QuotationsPage,
  SubscriptionsPage,
  InvoicesPage,
  DiscountsPage,
  PaymentsPage,
  CustomerIntelligencePage,
  RevenueIntelligencePage,
  RevenueRescuePage,
  AIAssistantPage,
  SettingsPage,
} from '@/pages/ModulePlaceholder';

// ── Auth placeholder pages ─────────────────────────────────────────────────────

function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Sign in to REVORA</h1>
          <p className="text-sm text-slate-500 mt-1">Authentication module coming next</p>
        </div>
        <div className="card p-6 space-y-4">
          <div>
            <label className="form-label">Email</label>
            <input type="email" placeholder="admin@brightloop.io" className="form-input" disabled />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input type="password" placeholder="••••••••" className="form-input" disabled />
          </div>
          <div className="pt-1">
            <button
              className="btn-primary btn w-full"
              onClick={() => window.location.href = '/'}
            >
              Continue to Dashboard
            </button>
          </div>
          <p className="text-center text-xs text-slate-400">
            Authentication will be implemented in the next module.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page loader ────────────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth pages (no sidebar) */}
          <Route path={ROUTES.LOGIN}    element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<LoginPage />} />

          {/* Authenticated app shell */}
          <Route element={<AppLayout />}>
            <Route path={ROUTES.DASHBOARD}              element={<DashboardPage />} />
            <Route path={ROUTES.CUSTOMERS}              element={<CustomersPage />} />
            <Route path={ROUTES.CUSTOMER_NEW}           element={<CustomersPage />} />
            <Route path={ROUTES.CUSTOMER_DETAIL}        element={<CustomersPage />} />
            <Route path={ROUTES.PRODUCTS}               element={<ProductsPage />} />
            <Route path={ROUTES.PRODUCT_DETAIL}         element={<ProductsPage />} />
            <Route path={ROUTES.PLANS}                  element={<PlansPage />} />
            <Route path={ROUTES.QUOTATIONS}             element={<QuotationsPage />} />
            <Route path={ROUTES.QUOTATION_DETAIL}       element={<QuotationsPage />} />
            <Route path={ROUTES.SUBSCRIPTIONS}          element={<SubscriptionsPage />} />
            <Route path={ROUTES.SUBSCRIPTION_NEW}       element={<SubscriptionsPage />} />
            <Route path={ROUTES.SUBSCRIPTION_DETAIL}    element={<SubscriptionsPage />} />
            <Route path={ROUTES.INVOICES}               element={<InvoicesPage />} />
            <Route path={ROUTES.INVOICE_DETAIL}         element={<InvoicesPage />} />
            <Route path={ROUTES.DISCOUNTS}              element={<DiscountsPage />} />
            <Route path={ROUTES.PAYMENTS}               element={<PaymentsPage />} />
            <Route path={ROUTES.CUSTOMER_INTELLIGENCE}  element={<CustomerIntelligencePage />} />
            <Route path={ROUTES.REVENUE_INTELLIGENCE}   element={<RevenueIntelligencePage />} />
            <Route path={ROUTES.REVENUE_RESCUE}         element={<RevenueRescuePage />} />
            <Route path={ROUTES.AI_ASSISTANT}           element={<AIAssistantPage />} />
            <Route path={ROUTES.SETTINGS}               element={<SettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
