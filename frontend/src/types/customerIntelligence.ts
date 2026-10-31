/**
REVORA – Customer Intelligence TypeScript Interfaces.
*/

export type HealthCategory = 'healthy' | 'needs_attention' | 'at_risk' | 'insufficient_data';
export type ChurnRiskCategory = 'low_risk' | 'medium_risk' | 'high_risk' | 'insufficient_data';
export type RecommendationPriority = 'high' | 'medium' | 'low';
export type RecommendationStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

export interface ContributingFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high';
  impact: number;
  description: string;
}

export interface HealthScore {
  customer_id: number;
  score: number | null;
  category: HealthCategory;
  payment_reliability_score: number | null;
  subscription_stability_score: number | null;
  renewal_behaviour_score: number | null;
  customer_tenure_score: number | null;
  revenue_consistency_score: number | null;
  positive_factors: string[];
  negative_factors: string[];
  formula_version: string;
  weights_used: Record<string, number>;
  is_data_sufficient: boolean;
  missing_data_fields: string[];
  calculated_at: string;
}

export interface ChurnRisk {
  customer_id: number;
  risk_score: number | null;
  risk_category: ChurnRiskCategory;
  contributing_factors: ContributingFactor[];
  explanation: string;
  recommended_action: string;
  engine_version: string;
  assessment_date: string;
}

export interface RetentionRecommendation {
  id: number;
  customer_id: number;
  recommendation_type: string;
  reason: string;
  priority: RecommendationPriority;
  suggested_action: string;
  expected_benefit: string | null;
  status: RecommendationStatus;
  created_at: string;
  updated_at: string;
  executed_at: string | null;
  executed_by: number | null;
  execution_notes: string | null;
}

export interface CustomerBehaviourMetrics {
  tenure_days: number;
  tenure_months: number;
  account_status: string;
  registration_date: string;

  active_subscriptions: number;
  paused_subscriptions: number;
  closed_subscriptions: number;
  renewal_count: number;
  upcoming_expirations: number;
  days_to_expiration: number | null;
  avg_duration_days: number | null;
  has_auto_renew: boolean;

  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  delayed_payments: number;
  outstanding_invoices_amount: number;
  overdue_invoices_count: number;
  avg_payment_delay_days: number | null;
  days_since_last_payment: number | null;
  payment_success_rate: number | null;

  monthly_recurring_revenue: number;
  annual_recurring_revenue: number;
  total_historical_revenue: number;
  avg_subscription_value: number;
  revenue_trend: 'growing' | 'stable' | 'declining';

  data_source: string;
  is_demo_data: boolean;
  is_data_sufficient: boolean;
}

export interface CustomerIntelligenceItem {
  customer_id: number;
  customer_code: string;
  customer_name: string;
  customer_email: string;
  company_name: string | null;
  account_status: string;
  registration_date: string;
  active_subscriptions: number;
  health_score: number | null;
  health_category: HealthCategory;
  churn_risk: ChurnRiskCategory;
  churn_risk_score: number | null;
  recurring_revenue: number;
  recommended_action: string;
  segments: string[];
  is_data_sufficient: boolean;
  is_demo_data: boolean;
  data_source: string;
}

export interface CustomerIntelligenceListResponse {
  items: CustomerIntelligenceItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface CustomerActivityItem {
  id: number;
  event_type: string;
  description: string;
  actor_name: string | null;
  created_at: string;
}

export interface CustomerIntelligenceDetail {
  customer_id: number;
  customer_code: string;
  customer_name: string;
  customer_email: string;
  phone: string | null;
  company_name: string | null;
  account_status: string;
  registration_date: string;
  created_at: string;

  health: HealthScore;
  churn_risk: ChurnRisk;
  behaviour: CustomerBehaviourMetrics;
  recommendations: RetentionRecommendation[];
  segments: string[];
  activities: CustomerActivityItem[];
}

export interface DistributionItem {
  category: string;
  label: string;
  count: number;
  percentage: number;
}

export interface IntelligenceSummary {
  total_analysed_customers: number;
  healthy_customers: number;
  needs_attention_customers: number;
  high_churn_risk_customers: number;
  at_risk_customers: number;
  insufficient_data_customers: number;
  health_distribution: DistributionItem[];
  churn_risk_distribution: DistributionItem[];
}

export interface SegmentSummary {
  segment_id: string;
  name: string;
  description: string;
  criteria_summary: string;
  customer_count: number;
  total_mrr: number;
  avg_health_score: number | null;
}

export interface SegmentsListResponse {
  segments: SegmentSummary[];
}

export interface IntelligenceFilters {
  search: string;
  health_category: HealthCategory | '';
  churn_risk: ChurnRiskCategory | '';
  segment: string;
  sort_by: string;
  sort_dir: 'asc' | 'desc';
  page: number;
  limit: number;
}
