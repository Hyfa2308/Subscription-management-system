/**
REVORA – Customer Intelligence API Service.
HTTP client using the centralized Axios instance with Bearer token.
*/

import apiClient from './apiClient';
import type {
  CustomerIntelligenceDetail,
  CustomerIntelligenceListResponse,
  HealthScore,
  ChurnRisk,
  RetentionRecommendation,
  IntelligenceSummary,
  SegmentsListResponse,
  IntelligenceFilters,
  RecommendationStatus,
} from '@/types/customerIntelligence';

const BASE = '/intelligence';

// ── Summary & KPI metrics ────────────────────────────────────────────────────

export async function getIntelligenceSummary(): Promise<IntelligenceSummary> {
  const res = await apiClient.get<IntelligenceSummary>(`${BASE}/summary`);
  return res.data;
}

// ── Segments breakdown ───────────────────────────────────────────────────────

export async function getSegments(): Promise<SegmentsListResponse> {
  const res = await apiClient.get<SegmentsListResponse>(`${BASE}/segments`);
  return res.data;
}

// ── List customers intelligence (Search, Filter, Sort, Paginate) ─────────────

export async function getCustomersIntelligence(
  filters: Partial<IntelligenceFilters> = {}
): Promise<CustomerIntelligenceListResponse> {
  const params: Record<string, string | number> = {};
  if (filters.search)          params.search = filters.search;
  if (filters.health_category) params.health_category = filters.health_category;
  if (filters.churn_risk)      params.churn_risk = filters.churn_risk;
  if (filters.segment)         params.segment = filters.segment;
  if (filters.sort_by)         params.sort_by = filters.sort_by;
  if (filters.sort_dir)        params.sort_dir = filters.sort_dir;
  if (filters.page)            params.page = filters.page;
  if (filters.limit)           params.limit = filters.limit;

  const res = await apiClient.get<CustomerIntelligenceListResponse>(`${BASE}/customers`, { params });
  return res.data;
}

// ── Single Customer Intelligence Profile ─────────────────────────────────────

export async function getCustomerIntelligence(customerId: number): Promise<CustomerIntelligenceDetail> {
  const res = await apiClient.get<CustomerIntelligenceDetail>(`${BASE}/customers/${customerId}`);
  return res.data;
}

// ── Health Score Details ─────────────────────────────────────────────────────

export async function getCustomerHealth(customerId: number): Promise<HealthScore> {
  const res = await apiClient.get<HealthScore>(`${BASE}/customers/${customerId}/health`);
  return res.data;
}

// ── Churn Risk Details ───────────────────────────────────────────────────────

export async function getCustomerChurnRisk(customerId: number): Promise<ChurnRisk> {
  const res = await apiClient.get<ChurnRisk>(`${BASE}/customers/${customerId}/churn-risk`);
  return res.data;
}

// ── Retention Recommendations ────────────────────────────────────────────────

export async function getCustomerRecommendations(customerId: number): Promise<RetentionRecommendation[]> {
  const res = await apiClient.get<RetentionRecommendation[]>(`${BASE}/customers/${customerId}/recommendations`);
  return res.data;
}

// ── On-demand Recalculate ────────────────────────────────────────────────────

export async function recalculateCustomerIntelligence(customerId: number): Promise<CustomerIntelligenceDetail> {
  const res = await apiClient.post<CustomerIntelligenceDetail>(`${BASE}/customers/${customerId}/recalculate`);
  return res.data;
}

// ── Update Recommendation Status / Record Execution ─────────────────────────

export async function updateRecommendationStatus(
  recommendationId: number,
  status: RecommendationStatus,
  executionNotes?: string
): Promise<RetentionRecommendation> {
  const res = await apiClient.patch<RetentionRecommendation>(
    `${BASE}/recommendations/${recommendationId}/status`,
    { status, execution_notes: executionNotes }
  );
  return res.data;
}
