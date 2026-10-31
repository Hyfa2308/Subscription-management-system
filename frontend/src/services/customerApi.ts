/**
 * REVORA – Customer API service.
 * All HTTP calls for the customer management module.
 * Uses the centralized Axios instance (auth token auto-attached).
 */

import apiClient, { getApiErrorMessage } from './apiClient';
import type {
  Customer,
  CustomerDetail,
  CustomerCreateRequest,
  CustomerUpdateRequest,
  CustomerListResponse,
  CustomerFilters,
  CustomerStats,
  CustomerStatus,
} from '@/types/customer';

const BASE = '/customers';

// ── List ──────────────────────────────────────────────────────────────────────

export async function getCustomers(filters: Partial<CustomerFilters> = {}): Promise<CustomerListResponse> {
  const params: Record<string, string | number> = {};
  if (filters.search)   params.search   = filters.search;
  if (filters.status)   params.status   = filters.status;
  if (filters.sort_by)  params.sort_by  = filters.sort_by;
  if (filters.sort_dir) params.sort_dir = filters.sort_dir;
  if (filters.page)     params.page     = filters.page;
  if (filters.limit)    params.limit    = filters.limit;

  const res = await apiClient.get<CustomerListResponse>(BASE, { params });
  return res.data;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getCustomerStats(): Promise<CustomerStats> {
  const res = await apiClient.get<CustomerStats>(`${BASE}/stats`);
  return res.data;
}

// ── Get one ───────────────────────────────────────────────────────────────────

export async function getCustomerById(id: number): Promise<CustomerDetail> {
  const res = await apiClient.get<CustomerDetail>(`${BASE}/${id}`);
  return res.data;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCustomer(data: CustomerCreateRequest): Promise<Customer> {
  const res = await apiClient.post<Customer>(BASE, data);
  return res.data;
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateCustomer(id: number, data: CustomerUpdateRequest): Promise<Customer> {
  const res = await apiClient.put<Customer>(`${BASE}/${id}`, data);
  return res.data;
}

// ── Status change ─────────────────────────────────────────────────────────────

export async function changeCustomerStatus(id: number, status: CustomerStatus): Promise<Customer> {
  const res = await apiClient.patch<Customer>(`${BASE}/${id}/status`, { status });
  return res.data;
}

// ── Archive ───────────────────────────────────────────────────────────────────

export async function archiveCustomer(id: number): Promise<Customer> {
  const res = await apiClient.delete<Customer>(`${BASE}/${id}`);
  return res.data;
}
