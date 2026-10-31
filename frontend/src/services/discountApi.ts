/**
 * REVORA – Discount API service.
 */
import apiClient from './apiClient';
import type {
  Discount, DiscountCreateRequest, DiscountUpdateRequest,
  DiscountListResponse, DiscountStats,
  DiscountValidateRequest, DiscountValidateResponse,
  DiscountRedemption, RedeemRequest,
} from '@/types/discount';

const BASE = '/discounts';

export async function getDiscounts(params: Record<string, any> = {}): Promise<DiscountListResponse> {
  return (await apiClient.get<DiscountListResponse>(BASE, { params })).data;
}

export async function getDiscountStats(): Promise<DiscountStats> {
  return (await apiClient.get<DiscountStats>(`${BASE}/stats`)).data;
}

export async function getDiscountById(id: number): Promise<Discount> {
  return (await apiClient.get<Discount>(`${BASE}/${id}`)).data;
}

export async function createDiscount(data: DiscountCreateRequest): Promise<Discount> {
  return (await apiClient.post<Discount>(BASE, data)).data;
}

export async function updateDiscount(id: number, data: DiscountUpdateRequest): Promise<Discount> {
  return (await apiClient.put<Discount>(`${BASE}/${id}`, data)).data;
}

export async function archiveDiscount(id: number): Promise<{ detail: string }> {
  return (await apiClient.delete<{ detail: string }>(`${BASE}/${id}`)).data;
}

export async function validateDiscount(req: DiscountValidateRequest): Promise<DiscountValidateResponse> {
  return (await apiClient.post<DiscountValidateResponse>(`${BASE}/validate`, req)).data;
}

export async function reserveDiscount(id: number, req: RedeemRequest): Promise<DiscountRedemption> {
  return (await apiClient.post<DiscountRedemption>(`${BASE}/${id}/reserve`, req)).data;
}

export async function redeemDiscount(id: number, redemptionId: number): Promise<DiscountRedemption> {
  return (await apiClient.post<DiscountRedemption>(`${BASE}/${id}/redeem/${redemptionId}`)).data;
}

export async function reverseDiscount(id: number, redemptionId: number): Promise<DiscountRedemption> {
  return (await apiClient.post<DiscountRedemption>(`${BASE}/${id}/reverse/${redemptionId}`)).data;
}

export async function getRedemptions(id: number): Promise<DiscountRedemption[]> {
  return (await apiClient.get<DiscountRedemption[]>(`${BASE}/${id}/redemptions`)).data;
}
