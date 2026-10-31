/**
 * REVORA – Quotation Template API service.
 */
import apiClient from './apiClient';
import type {
  QuotationTemplate, TemplateCreateRequest, TemplateUpdateRequest,
  TemplateListResponse,
} from '@/types/quotation';

const BASE = '/quotation-templates';

export async function getTemplates(params: Record<string, any> = {}): Promise<TemplateListResponse> {
  return (await apiClient.get<TemplateListResponse>(BASE, { params })).data;
}
export async function getTemplateById(id: number): Promise<QuotationTemplate> {
  return (await apiClient.get<QuotationTemplate>(`${BASE}/${id}`)).data;
}
export async function createTemplate(data: TemplateCreateRequest): Promise<QuotationTemplate> {
  return (await apiClient.post<QuotationTemplate>(BASE, data)).data;
}
export async function updateTemplate(id: number, data: TemplateUpdateRequest): Promise<QuotationTemplate> {
  return (await apiClient.put<QuotationTemplate>(`${BASE}/${id}`, data)).data;
}
export async function deleteTemplate(id: number): Promise<QuotationTemplate> {
  return (await apiClient.delete<QuotationTemplate>(`${BASE}/${id}`)).data;
}
