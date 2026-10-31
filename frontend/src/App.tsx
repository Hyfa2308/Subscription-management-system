/**
 * REVORA – Root application router.
 * All routes are defined here using React Router DOM v6.
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { AppLayout } from '@/layouts/AppLayout';

// Pages
import DashboardPage from '@/pages/DashboardPage';
import {
  CustomersPlaceholder,
  ProductsPlaceholder,
  SubscriptionsPlaceholder,
  InvoicesPlaceholder,
  PaymentsPlaceholder,
  AnalyticsPlaceholder,
  RevenueRescuePlaceholder,
  SettingsPlaceholder,
} from '@/pages/PlaceholderPages';

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* App shell */}
          <Route element={<AppLayout />}>
            <Route path={ROUTES.DASHBOARD}      element={<DashboardPage />} />
            <Route path={ROUTES.CUSTOMERS}      element={<CustomersPlaceholder />} />
            <Route path={ROUTES.CUSTOMER_NEW}   element={<CustomersPlaceholder />} />
            <Route path={ROUTES.CUSTOMER_DETAIL} element={<CustomersPlaceholder />} />
            <Route path={ROUTES.PRODUCTS}       element={<ProductsPlaceholder />} />
            <Route path={ROUTES.SUBSCRIPTIONS}  element={<SubscriptionsPlaceholder />} />
            <Route path={ROUTES.SUBSCRIPTION_DETAIL} element={<SubscriptionsPlaceholder />} />
            <Route path={ROUTES.INVOICES}       element={<InvoicesPlaceholder />} />
            <Route path={ROUTES.INVOICE_DETAIL} element={<InvoicesPlaceholder />} />
            <Route path={ROUTES.PAYMENTS}       element={<PaymentsPlaceholder />} />
            <Route path={ROUTES.ANALYTICS}      element={<AnalyticsPlaceholder />} />
            <Route path={ROUTES.REVENUE_RESCUE} element={<RevenueRescuePlaceholder />} />
            <Route path={ROUTES.SETTINGS}       element={<SettingsPlaceholder />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
