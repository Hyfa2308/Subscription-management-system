/**
 * REVORA – Quotation API service.
 */
import apiClient from './apiClient';
import type {
  Quotation, QuotationDetail, QuotationCreateRequest, QuotationUpdateRequest,
  QuotationListResponse, QuotationStats,
} from '@/types/quotation';

const BASE = '/quotations';

export async function getQuotations(params: Record<string, any> = {}): Promise<QuotationListResponse> {
  const res = await apiClient.get<QuotationListResponse>(BASE, { params });
  return res.data;
}
export async function getQuotationStats(): Promise<QuotationStats> {
  return (await apiClient.get<QuotationStats>(`${BASE}/stats`)).data;
}
export async function getQuotationById(id: number): Promise<QuotationDetail> {
  return (await apiClient.get<QuotationDetail>(`${BASE}/${id}`)).data;
}
export async function createQuotation(data: QuotationCreateRequest): Promise<QuotationDetail> {
  return (await apiClient.post<QuotationDetail>(BASE, data)).data;
}
export async function updateQuotation(id: number, data: QuotationUpdateRequest): Promise<QuotationDetail> {
  return (await apiClient.put<QuotationDetail>(`${BASE}/${id}`, data)).data;
}
export async function deleteQuotation(id: number): Promise<QuotationDetail> {
  return (await apiClient.delete<QuotationDetail>(`${BASE}/${id}`)).data;
}
export async function sendQuotation(id: number):   Promise<QuotationDetail> {
  return (await apiClient.post<QuotationDetail>(`${BASE}/${id}/send`)).data;
}
export async function acceptQuotation(id: number): Promise<QuotationDetail> {
  return (await apiClient.post<QuotationDetail>(`${BASE}/${id}/accept`)).data;
}
export async function rejectQuotation(id: number): Promise<QuotationDetail> {
  return (await apiClient.post<QuotationDetail>(`${BASE}/${id}/reject`)).data;
}
export async function cancelQuotation(id: number): Promise<QuotationDetail> {
  return (await apiClient.post<QuotationDetail>(`${BASE}/${id}/cancel`)).data;
}
export function getQuotationPdfUrl(id: number): string {
  return `${apiClient.defaults.baseURL}${BASE}/${id}/pdf`;
}
