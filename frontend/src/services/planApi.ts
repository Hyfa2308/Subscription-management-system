/**
 * REVORA – Subscription Plan API service.
 * Uses centralized Axios client (JWT auto-attached).
 */

import apiClient from './apiClient';
import type {
  SubscriptionPlan, SubscriptionPlanDetail,
  PlanCreateRequest, PlanUpdateRequest,
  PlanListResponse, PlanFilters, PlanStats,
} from '@/types/plan';

const BASE = '/plans';

export async function getPlans(filters: Partial<PlanFilters> = {}): Promise<PlanListResponse> {
  const params: Record<string, string | number | boolean> = {};
  if (filters.search)            params.search            = filters.search;
  if (filters.product_id)        params.product_id        = filters.product_id;
  if (filters.billing_frequency) params.billing_frequency = filters.billing_frequency;
  if (filters.status)            params.status            = filters.status;
  if (filters.sort_by)           params.sort_by           = filters.sort_by;
  if (filters.sort_dir)          params.sort_dir          = filters.sort_dir;
  if (filters.page)              params.page              = filters.page;
  if (filters.limit)             params.limit             = filters.limit;

  const res = await apiClient.get<PlanListResponse>(BASE, { params });
  return res.data;
}

export async function getPlanStats(): Promise<PlanStats> {
  const res = await apiClient.get<PlanStats>(`${BASE}/stats`);
  return res.data;
}

export async function getPlanById(id: number): Promise<SubscriptionPlanDetail> {
  const res = await apiClient.get<SubscriptionPlanDetail>(`${BASE}/${id}`);
  return res.data;
}

export async function createPlan(data: PlanCreateRequest): Promise<SubscriptionPlanDetail> {
  const res = await apiClient.post<SubscriptionPlanDetail>(BASE, data);
  return res.data;
}

export async function updatePlan(id: number, data: PlanUpdateRequest): Promise<SubscriptionPlanDetail> {
  const res = await apiClient.put<SubscriptionPlanDetail>(`${BASE}/${id}`, data);
  return res.data;
}

export async function archivePlan(id: number): Promise<SubscriptionPlanDetail> {
  const res = await apiClient.delete<SubscriptionPlanDetail>(`${BASE}/${id}`);
  return res.data;
}
