/**
 * REVORA – Subscription API service.
 */
import apiClient from './apiClient';
import type {
  Subscription, SubscriptionDetail,
  SubscriptionCreateRequest, SubscriptionUpdateRequest,
  SubscriptionListResponse, SubscriptionStats,
} from '@/types/subscription';

const BASE = '/subscriptions';

export async function getSubscriptions(params: Record<string, any> = {}): Promise<SubscriptionListResponse> {
  return (await apiClient.get<SubscriptionListResponse>(BASE, { params })).data;
}

export async function getSubscriptionStats(): Promise<SubscriptionStats> {
  return (await apiClient.get<SubscriptionStats>(`${BASE}/stats`)).data;
}

export async function getSubscriptionById(id: number): Promise<SubscriptionDetail> {
  return (await apiClient.get<SubscriptionDetail>(`${BASE}/${id}`)).data;
}

export async function createSubscription(data: SubscriptionCreateRequest): Promise<SubscriptionDetail> {
  return (await apiClient.post<SubscriptionDetail>(BASE, data)).data;
}

export async function updateSubscription(id: number, data: SubscriptionUpdateRequest): Promise<SubscriptionDetail> {
  return (await apiClient.put<SubscriptionDetail>(`${BASE}/${id}`, data)).data;
}

export async function activateSubscription(id: number): Promise<SubscriptionDetail> {
  return (await apiClient.post<SubscriptionDetail>(`${BASE}/${id}/activate`)).data;
}

export async function pauseSubscription(id: number, reason: string): Promise<SubscriptionDetail> {
  return (await apiClient.post<SubscriptionDetail>(`${BASE}/${id}/pause`, { reason })).data;
}

export async function resumeSubscription(id: number): Promise<SubscriptionDetail> {
  return (await apiClient.post<SubscriptionDetail>(`${BASE}/${id}/resume`)).data;
}

export async function renewSubscription(id: number): Promise<SubscriptionDetail> {
  return (await apiClient.post<SubscriptionDetail>(`${BASE}/${id}/renew`)).data;
}

export async function closeSubscription(id: number, reason: string): Promise<SubscriptionDetail> {
  return (await apiClient.post<SubscriptionDetail>(`${BASE}/${id}/close`, { reason })).data;
}

export async function cancelSubscription(id: number, reason: string): Promise<SubscriptionDetail> {
  return (await apiClient.post<SubscriptionDetail>(`${BASE}/${id}/cancel`, { reason })).data;
}
