/**
 * REVORA – Placeholder page for modules not yet implemented.
 * Shows context-relevant "coming soon" information.
 */

import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
  nextSteps?: string[];
}

export function PlaceholderPage({ title, description, nextSteps }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
        <Construction className="w-7 h-7 text-indigo-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">{title}</h2>
      <p className="text-sm text-slate-500 max-w-md mb-6">{description}</p>
      {nextSteps && nextSteps.length > 0 && (
        <div className="card max-w-sm w-full text-left">
          <div className="card-header">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Coming in this module</p>
          </div>
          <ul className="card-body space-y-2">
            {nextSteps.map((step) => (
              <li key={step} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CustomersPlaceholder() {
  return (
    <PlaceholderPage
      title="Customer Management"
      description="Manage your customers, contacts, and account configurations."
      nextSteps={['Customer list with search & filters', 'Create / Edit customer form', 'Customer detail view', 'Account status management']}
    />
  );
}

export function ProductsPlaceholder() {
  return (
    <PlaceholderPage
      title="Products & Plans"
      description="Define subscription products and pricing plans."
      nextSteps={['Product catalog', 'Pricing tiers', 'Billing cycle configuration', 'Feature flags per plan']}
    />
  );
}

export function SubscriptionsPlaceholder() {
  return (
    <PlaceholderPage
      title="Subscriptions"
      description="Manage the full subscription lifecycle."
      nextSteps={['Active subscription list', 'New subscription wizard', 'Renewal & cancellation flows', 'Trial management']}
    />
  );
}

export function InvoicesPlaceholder() {
  return (
    <PlaceholderPage
      title="Invoices"
      description="Automated billing and invoice management."
      nextSteps={['Invoice list with status', 'PDF generation', 'Send invoice by email', 'Partial payment tracking']}
    />
  );
}

export function PaymentsPlaceholder() {
  return (
    <PlaceholderPage
      title="Payments"
      description="Track and reconcile all subscription payments."
      nextSteps={['Payment history', 'Failed payment alerts', 'Refund management', 'Payment gateway integration']}
    />
  );
}

export function AnalyticsPlaceholder() {
  return (
    <PlaceholderPage
      title="Analytics & Forecasting"
      description="Revenue intelligence and business metrics."
      nextSteps={['MRR / ARR charts', 'Churn rate analysis', 'Revenue forecast', 'Cohort analysis']}
    />
  );
}

export function RevenueRescuePlaceholder() {
  return (
    <PlaceholderPage
      title="Revenue Rescue Center"
      description="AI-powered recovery for at-risk subscriptions and failed payments."
      nextSteps={['Churn risk scoring', 'Automated recovery campaigns', 'AI recommendations', 'Win-back workflows']}
    />
  );
}

export function SettingsPlaceholder() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Configure your REVORA platform."
      nextSteps={['Company profile', 'Billing configuration', 'Odoo integration settings', 'User & role management']}
    />
  );
}
