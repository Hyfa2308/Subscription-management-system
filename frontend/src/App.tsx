/**
 * REVORA – Root application router.
 * Wraps the entire app in ToastProvider and AuthProvider, applies route guards.
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { AuthProvider } from '@/context/AuthContext';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute, PublicRoute } from '@/components/auth/RouteGuards';
import { ToastProvider } from '@/components/common/Toast';

// ── Auth pages ────────────────────────────────────────────────────────────────
import LoginPage          from '@/pages/auth/LoginPage';
import RegisterPage       from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage  from '@/pages/auth/ResetPasswordPage';

// ── Real modules ──────────────────────────────────────────────────────────────
import DashboardPage      from '@/pages/DashboardPage';
import CustomersPage      from '@/pages/CustomersPage';
import CustomerDetailPage from '@/pages/CustomerDetailPage';
import ProductsPage       from '@/pages/ProductsPage';
import ProductDetailPage  from '@/pages/ProductDetailPage';
import PlansPage                from '@/pages/PlansPage';
import PlanDetailPage           from '@/pages/PlanDetailPage';
import QuotationsPage           from '@/pages/QuotationsPage';
import QuotationDetailPage      from '@/pages/QuotationDetailPage';
import QuotationFormPage        from '@/pages/QuotationFormPage';
import QuotationTemplatesPage   from '@/pages/QuotationTemplatesPage';

// ── Placeholder modules (to be replaced in future prompts) ────────────────────
import {
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
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public auth pages — redirect away if already signed in */}
              <Route element={<PublicRoute />}>
                <Route path={ROUTES.LOGIN}           element={<LoginPage />} />
                <Route path={ROUTES.REGISTER}        element={<RegisterPage />} />
                <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
                <Route path={ROUTES.RESET_PASSWORD}  element={<ResetPasswordPage />} />
              </Route>

              {/* Protected app shell — requires authentication */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  {/* Dashboard */}
                  <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />

                  {/* ── Customers (fully implemented) ── */}
                  <Route path={ROUTES.CUSTOMERS}       element={<CustomersPage />} />
                  <Route path="/customers/:id"         element={<CustomerDetailPage />} />

                  {/* ── Products (fully implemented) ── */}
                  <Route path={ROUTES.PRODUCTS}        element={<ProductsPage />} />
                  <Route path="/products/:id"          element={<ProductDetailPage />} />

                  {/* ── Plans (fully implemented) ── */}
                  <Route path={ROUTES.PLANS}  element={<PlansPage />} />
                  <Route path="/plans/:id"    element={<PlanDetailPage />} />

                  {/* ── Quotations (fully implemented) ── */}
                  <Route path={ROUTES.QUOTATIONS}       element={<QuotationsPage />} />
                  <Route path="/quotations/new"         element={<QuotationFormPage />} />
                  <Route path="/quotations/:id"         element={<QuotationDetailPage />} />
                  <Route path="/quotations/:id/edit"    element={<QuotationFormPage />} />
                  <Route path="/quotation-templates"    element={<QuotationTemplatesPage />} />
                  <Route path={ROUTES.SUBSCRIPTIONS}         element={<SubscriptionsPage />} />
                  <Route path={ROUTES.SUBSCRIPTION_NEW}      element={<SubscriptionsPage />} />
                  <Route path={ROUTES.SUBSCRIPTION_DETAIL}   element={<SubscriptionsPage />} />
                  <Route path={ROUTES.INVOICES}              element={<InvoicesPage />} />
                  <Route path={ROUTES.INVOICE_DETAIL}        element={<InvoicesPage />} />
                  <Route path={ROUTES.DISCOUNTS}             element={<DiscountsPage />} />
                  <Route path={ROUTES.PAYMENTS}              element={<PaymentsPage />} />
                  <Route path={ROUTES.CUSTOMER_INTELLIGENCE} element={<CustomerIntelligencePage />} />
                  <Route path={ROUTES.REVENUE_INTELLIGENCE}  element={<RevenueIntelligencePage />} />
                  <Route path={ROUTES.REVENUE_RESCUE}        element={<RevenueRescuePage />} />
                  <Route path={ROUTES.AI_ASSISTANT}          element={<AIAssistantPage />} />
                  <Route path={ROUTES.SETTINGS}              element={<SettingsPage />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
