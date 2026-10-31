/**
 * REVORA – Dashboard API service.
 */
import apiClient from './apiClient';

const BASE = '/dashboard';

export interface DashboardOverview {
  customers: {
    total: number; active: number; inactive: number;
    new_customers: number; growth_rate_pct: number; period_days: number;
  };
  subscriptions: {
    total: number; active: number; paused: number; pending: number;
    expired: number; cancelled: number; expiring_soon: number;
  };
  revenue: {
    mrr: string; arr: string; collected: string;
    outstanding: string; revenue_growth_pct: number;
  };
  invoices: {
    total: number; paid: number; unpaid: number; partially_paid: number;
    overdue: number; draft: number; cancelled: number; outstanding_amount: string;
  };
  payments: {
    available: boolean; note?: string;
    total_successful: number; failed: number; pending: number;
    total_amount_collected: string;
  };
  quotations: {
    total: number; draft: number; sent: number; accepted: number;
    rejected: number; expired: number; cancelled: number;
    conversion_rate_pct: number;
  };
  generated_at: string;
}

export interface TrendPoint {
  period: string;
  period_start: string;
  collected?: number;
  total_invoiced?: number;
  outstanding?: number;
  new?: number;
}

export interface Activity {
  id: number;
  action: string;
  description: string;
  created_at: string | null;
  actor_id: number | null;
  subscription_number: string;
  customer_id: number;
  customer_name: string;
}

export interface UpcomingRenewal {
  subscription_id: number;
  subscription_number: string;
  next_billing_date: string | null;
  billing_frequency: string;
  expected_amount: string;
  currency: string;
  customer_id: number;
  customer_name: string;
  days_until_due: number | null;
}

export interface DashboardAlert {
  severity: 'high' | 'medium' | 'low';
  type: string;
  title: string;
  description: string;
  action: string;
  link: string;
}

export async function getDashboardOverview(days = 30): Promise<DashboardOverview> {
  return (await apiClient.get<DashboardOverview>(`${BASE}/overview`, { params: { days } })).data;
}

export async function getRevenueTrend(months = 6): Promise<TrendPoint[]> {
  return (await apiClient.get<TrendPoint[]>(`${BASE}/revenue-trend`, { params: { months } })).data;
}

export async function getSubscriptionTrend(months = 6): Promise<TrendPoint[]> {
  return (await apiClient.get<TrendPoint[]>(`${BASE}/subscription-trend`, { params: { months } })).data;
}

export async function getCustomerTrend(months = 6): Promise<TrendPoint[]> {
  return (await apiClient.get<TrendPoint[]>(`${BASE}/customer-trend`, { params: { months } })).data;
}

export async function getRecentActivities(limit = 15): Promise<Activity[]> {
  return (await apiClient.get<Activity[]>(`${BASE}/recent-activities`, { params: { limit } })).data;
}

export async function getUpcomingRenewals(days = 30, limit = 10): Promise<UpcomingRenewal[]> {
  return (await apiClient.get<UpcomingRenewal[]>(`${BASE}/upcoming-renewals`, { params: { days, limit } })).data;
}

export async function getDashboardAlerts(): Promise<DashboardAlert[]> {
  return (await apiClient.get<DashboardAlert[]>(`${BASE}/alerts`)).data;
}
