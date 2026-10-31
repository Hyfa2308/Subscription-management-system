/**
 * REVORA – ModulePlaceholder
 * Professional "coming next" page for unimplemented modules.
 * Displays module name, description, expected features, and readiness state.
 */

import React from 'react';
import { Construction, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';

interface ModuleFeature {
  label: string;
  description: string;
}

interface ModulePlaceholderProps {
  title: string;
  description: string;
  features?: ModuleFeature[];
  estimatedRelease?: string;
  icon?: React.ElementType;
}

export function ModulePlaceholder({
  title,
  description,
  features = [],
  estimatedRelease,
  icon: Icon = Construction,
}: ModulePlaceholderProps) {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        primaryAction={
          <StatusBadge variant="indigo" label="Coming Next" dot />
        }
      />

      <div className="max-w-2xl mx-auto mt-8">
        {/* Hero card */}
        <div className="card p-8 text-center mb-6">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Icon className="w-7 h-7 text-indigo-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            This module is under development
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
            {description} This feature will be fully implemented in the next development sprint.
          </p>
          {estimatedRelease && (
            <p className="mt-4 text-xs text-slate-400">
              Estimated: <span className="font-medium text-slate-600">{estimatedRelease}</span>
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
              Back to Dashboard
            </Button>
            <Button variant="primary" size="sm" rightIcon={ArrowRight}>
              Learn More
            </Button>
          </div>
        </div>

        {/* Features list */}
        {features.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-slate-700">Planned features</h3>
            </div>
            <div className="card-body space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{f.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pre-built placeholders per module ─────────────────────────────────────────

import { Users, Package, Layers, FileText, RefreshCw, Receipt, Tag, CreditCard, Brain, TrendingUp, Zap, Bot } from 'lucide-react';

export function CustomersPage() {
  return <ModulePlaceholder
    icon={Users}
    title="Customers"
    description="Manage your customer accounts, contacts, and account history."
    features={[
      { label: 'Customer list', description: 'Search, filter, sort, and paginate customers' },
      { label: 'Customer profile', description: 'Contact details, account status, subscription history' },
      { label: 'Create & edit', description: 'Add new customers with full validation' },
      { label: 'Account tagging', description: 'Segment customers by type or status' },
    ]}
  />;
}

export function ProductsPage() {
  return <ModulePlaceholder
    icon={Package}
    title="Products"
    description="Define and manage your subscription product catalog."
    features={[
      { label: 'Product catalog', description: 'List, create, and archive products' },
      { label: 'Pricing configuration', description: 'Set base prices, currencies, and billing options' },
      { label: 'Product metadata', description: 'Descriptions, codes, and feature flags' },
    ]}
  />;
}

export function PlansPage() {
  return <ModulePlaceholder
    icon={Layers}
    title="Subscription Plans"
    description="Configure pricing tiers and subscription plan structures."
    features={[
      { label: 'Plan tiers', description: 'Starter, Professional, Enterprise plan setup' },
      { label: 'Billing cycles', description: 'Monthly, quarterly, and annual billing' },
      { label: 'Feature entitlements', description: 'Define what each plan includes' },
      { label: 'Trial periods', description: 'Free trial configuration per plan' },
    ]}
  />;
}

export function QuotationsPage() {
  return <ModulePlaceholder
    icon={FileText}
    title="Quotations"
    description="Create and manage subscription quotations for prospective customers."
    features={[
      { label: 'Quotation builder', description: 'Select products, plans, and discounts' },
      { label: 'Send to customer', description: 'Email quotations with PDF attachment' },
      { label: 'Convert to subscription', description: 'One-click conversion on acceptance' },
      { label: 'Expiry management', description: 'Set and track quotation validity' },
    ]}
  />;
}

export function SubscriptionsPage() {
  return <ModulePlaceholder
    icon={RefreshCw}
    title="Subscriptions"
    description="Manage the complete subscription lifecycle from activation to cancellation."
    features={[
      { label: 'Active subscriptions', description: 'List with status, plan, and renewal dates' },
      { label: 'New subscription wizard', description: 'Step-by-step subscription creation' },
      { label: 'Renewal management', description: 'Auto and manual renewal workflows' },
      { label: 'Cancellation & pause', description: 'Structured cancellation with reason tracking' },
    ]}
  />;
}

export function InvoicesPage() {
  return <ModulePlaceholder
    icon={Receipt}
    title="Invoices"
    description="Automated invoice generation and management for subscription billing."
    features={[
      { label: 'Invoice list', description: 'Filter by status: draft, sent, paid, overdue' },
      { label: 'Auto-generation', description: 'Invoices created on billing cycle triggers' },
      { label: 'PDF export', description: 'Download professional invoice PDFs' },
      { label: 'Payment tracking', description: 'Mark invoices as paid, partial, or overdue' },
    ]}
  />;
}

export function DiscountsPage() {
  return <ModulePlaceholder
    icon={Tag}
    title="Discounts"
    description="Create and apply discount codes and promotional pricing rules."
    features={[
      { label: 'Discount codes', description: 'Percentage and fixed amount discounts' },
      { label: 'Usage limits', description: 'Set per-customer or global usage caps' },
      { label: 'Validity periods', description: 'Start and end dates for promotions' },
      { label: 'Reporting', description: 'Track discount redemption and impact on revenue' },
    ]}
  />;
}

export function PaymentsPage() {
  return <ModulePlaceholder
    icon={CreditCard}
    title="Payments"
    description="Track all payment transactions and manage payment reconciliation."
    features={[
      { label: 'Payment history', description: 'Full transaction log with status and method' },
      { label: 'Failed payment alerts', description: 'Identify and retry failed charges' },
      { label: 'Refund processing', description: 'Issue full and partial refunds' },
      { label: 'Gateway integration', description: 'Connect to payment processors' },
    ]}
  />;
}

export function CustomerIntelligencePage() {
  return <ModulePlaceholder
    icon={Brain}
    title="Customer Intelligence"
    description="AI-powered insights into customer behaviour, health scores, and churn risk."
    features={[
      { label: 'Churn risk scoring', description: 'ML-powered early warning scores per customer' },
      { label: 'Health dashboard', description: 'Engagement and satisfaction indicators' },
      { label: 'Segmentation', description: 'Smart customer segments based on behaviour' },
      { label: 'Recommendations', description: 'AI-suggested retention actions' },
    ]}
  />;
}

export function RevenueIntelligencePage() {
  return <ModulePlaceholder
    icon={TrendingUp}
    title="Revenue Intelligence"
    description="Revenue forecasting, MRR analytics, and growth trend analysis."
    features={[
      { label: 'MRR & ARR dashboard', description: 'Monthly and annual recurring revenue tracking' },
      { label: 'Revenue forecast', description: 'Predictive revenue modelling' },
      { label: 'Cohort analysis', description: 'Retention and expansion by customer cohort' },
      { label: 'Plan mix reporting', description: 'Revenue distribution across plans' },
    ]}
  />;
}

export function RevenueRescuePage() {
  return <ModulePlaceholder
    icon={Zap}
    title="Revenue Rescue Center"
    description="AI-driven recovery workflows for at-risk subscriptions and failed payments."
    features={[
      { label: 'At-risk queue', description: 'Prioritized list of customers likely to churn' },
      { label: 'Recovery campaigns', description: 'Automated email and discount-based recovery' },
      { label: 'Payment retry logic', description: 'Smart retry scheduling for failed charges' },
      { label: 'Win-back workflows', description: 'Reactivation campaigns for churned customers' },
    ]}
  />;
}

export function AIAssistantPage() {
  return <ModulePlaceholder
    icon={Bot}
    title="AI Operations Assistant"
    description="Conversational AI assistant for subscription operations, reporting, and insights."
    features={[
      { label: 'Natural language queries', description: 'Ask questions about your subscription data' },
      { label: 'Report generation', description: 'Generate reports and summaries on demand' },
      { label: 'Action suggestions', description: 'Recommended next steps based on current data' },
      { label: 'Workflow automation', description: 'Trigger actions through conversation' },
    ]}
  />;
}

export function SettingsPage() {
  return <ModulePlaceholder
    icon={Construction}
    title="Settings"
    description="Configure your REVORA platform, integrations, and account preferences."
    features={[
      { label: 'Company profile', description: 'Logo, name, address, and billing info' },
      { label: 'Odoo integration', description: 'Connect and configure Odoo credentials' },
      { label: 'Notification preferences', description: 'Email and in-app notification settings' },
      { label: 'User & role management', description: 'Invite users and configure permissions' },
    ]}
  />;
}
