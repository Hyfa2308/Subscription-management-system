/**
 * REVORA – Invoice API service.
 */
import apiClient from './apiClient';
import type {
  Invoice, InvoiceDetail, InvoiceCreateRequest, InvoiceUpdateRequest,
  InvoiceListResponse, InvoiceStats,
} from '@/types/invoice';

const BASE = '/invoices';

export async function getInvoices(params: Record<string, any> = {}): Promise<InvoiceListResponse> {
  return (await apiClient.get<InvoiceListResponse>(BASE, { params })).data;
}

export async function getInvoiceStats(): Promise<InvoiceStats> {
  return (await apiClient.get<InvoiceStats>(`${BASE}/stats`)).data;
}

export async function getInvoiceById(id: number): Promise<InvoiceDetail> {
  return (await apiClient.get<InvoiceDetail>(`${BASE}/${id}`)).data;
}

export async function createInvoice(data: InvoiceCreateRequest): Promise<InvoiceDetail> {
  return (await apiClient.post<InvoiceDetail>(BASE, data)).data;
}

export async function updateInvoice(id: number, data: InvoiceUpdateRequest): Promise<InvoiceDetail> {
  return (await apiClient.put<InvoiceDetail>(`${BASE}/${id}`, data)).data;
}

export async function finalizeInvoice(id: number): Promise<InvoiceDetail> {
  return (await apiClient.post<InvoiceDetail>(`${BASE}/${id}/finalize`)).data;
}

export async function cancelInvoice(id: number): Promise<InvoiceDetail> {
  return (await apiClient.post<InvoiceDetail>(`${BASE}/${id}/cancel`)).data;
}

export function getInvoicePdfUrl(id: number): string {
  return `${apiClient.defaults.baseURL}${BASE}/${id}/pdf`;
}
