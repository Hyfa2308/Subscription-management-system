/**
 * REVORA – Product API service.
 * Typed API calls for product and variant management.
 * Uses centralized Axios client (JWT auto-attached).
 */

import apiClient from './apiClient';
import type {
  Product, ProductDetail, ProductCreateRequest, ProductUpdateRequest,
  ProductListResponse, ProductFilters, ProductStats,
  ProductVariant, VariantCreateRequest, VariantUpdateRequest,
} from '@/types/product';

const BASE = '/products';

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProducts(filters: Partial<ProductFilters> = {}): Promise<ProductListResponse> {
  const params: Record<string, string | number | boolean> = {};
  if (filters.search)       params.search       = filters.search;
  if (filters.category)     params.category     = filters.category;
  if (filters.product_type) params.product_type = filters.product_type;
  if (filters.billing_type) params.billing_type = filters.billing_type;
  if (filters.is_active === 'true')  params.is_active = true;
  if (filters.is_active === 'false') params.is_active = false;
  if (filters.sort_by)      params.sort_by      = filters.sort_by;
  if (filters.sort_dir)     params.sort_dir     = filters.sort_dir;
  if (filters.page)         params.page         = filters.page;
  if (filters.limit)        params.limit        = filters.limit;

  const res = await apiClient.get<ProductListResponse>(BASE, { params });
  return res.data;
}

export async function getProductStats(): Promise<ProductStats> {
  const res = await apiClient.get<ProductStats>(`${BASE}/stats`);
  return res.data;
}

export async function getProductById(id: number): Promise<ProductDetail> {
  const res = await apiClient.get<ProductDetail>(`${BASE}/${id}`);
  return res.data;
}

export async function createProduct(data: ProductCreateRequest): Promise<Product> {
  const res = await apiClient.post<Product>(BASE, data);
  return res.data;
}

export async function updateProduct(id: number, data: ProductUpdateRequest): Promise<Product> {
  const res = await apiClient.put<Product>(`${BASE}/${id}`, data);
  return res.data;
}

export async function deactivateProduct(id: number): Promise<Product> {
  const res = await apiClient.delete<Product>(`${BASE}/${id}`);
  return res.data;
}

// ── Variants ──────────────────────────────────────────────────────────────────

export async function getVariants(productId: number): Promise<ProductVariant[]> {
  const res = await apiClient.get<ProductVariant[]>(`${BASE}/${productId}/variants`);
  return res.data;
}

export async function createVariant(productId: number, data: VariantCreateRequest): Promise<ProductVariant> {
  const res = await apiClient.post<ProductVariant>(`${BASE}/${productId}/variants`, data);
  return res.data;
}

export async function updateVariant(productId: number, variantId: number, data: VariantUpdateRequest): Promise<ProductVariant> {
  const res = await apiClient.put<ProductVariant>(`${BASE}/${productId}/variants/${variantId}`, data);
  return res.data;
}

export async function deactivateVariant(productId: number, variantId: number): Promise<ProductVariant> {
  const res = await apiClient.delete<ProductVariant>(`${BASE}/${productId}/variants/${variantId}`);
  return res.data;
}
