/**
 * REVORA – Billing API service.
 */
import apiClient from './apiClient';
import type { BillingRun, BillingRunResult, UpcomingBillingItem, BillingStatus } from '@/types/invoice';

const BASE = '/billing';

export async function runBilling(dryRun = false): Promise<BillingRunResult> {
  return (await apiClient.post<BillingRunResult>(`${BASE}/run`, { dry_run: dryRun })).data;
}

export async function getBillingStatus(): Promise<BillingStatus> {
  return (await apiClient.get<BillingStatus>(`${BASE}/status`)).data;
}

export async function getBillingHistory(): Promise<BillingRun[]> {
  return (await apiClient.get<BillingRun[]>(`${BASE}/history`)).data;
}

export async function getUpcomingBilling(): Promise<UpcomingBillingItem[]> {
  return (await apiClient.get<UpcomingBillingItem[]>(`${BASE}/upcoming`)).data;
}
