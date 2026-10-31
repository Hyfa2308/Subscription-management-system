/**
 * REVORA – Main app shell layout.
 * Sidebar + Topbar wrapper used by all authenticated pages.
 */

import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { ROUTES } from '@/config/routes';

/** Maps route paths to human-readable page titles */
const PAGE_TITLES: Record<string, string> = {
  [ROUTES.DASHBOARD]:      'Dashboard',
  [ROUTES.CUSTOMERS]:      'Customers',
  [ROUTES.CUSTOMER_NEW]:   'New Customer',
  [ROUTES.PRODUCTS]:       'Products & Plans',
  [ROUTES.SUBSCRIPTIONS]:  'Subscriptions',
  [ROUTES.INVOICES]:       'Invoices',
  [ROUTES.PAYMENTS]:       'Payments',
  [ROUTES.ANALYTICS]:      'Analytics',
  [ROUTES.REVENUE_RESCUE]: 'Revenue Rescue Center',
  [ROUTES.SETTINGS]:       'Settings',
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match for detail pages
  const prefix = Object.keys(PAGE_TITLES).find(
    (key) => key !== '/' && pathname.startsWith(key),
  );
  return prefix ? PAGE_TITLES[prefix] : 'REVORA';
}

export function AppLayout() {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <Sidebar className="hidden md:flex flex-col" />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} />

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
