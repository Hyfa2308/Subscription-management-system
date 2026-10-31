"""
REVORA – Customer Intelligence Pydantic Schemas.
Request/Response contracts for customer intelligence, health scoring,
churn prediction, retention recommendations, and segmentation.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field

from app.models.customer_intelligence import (
    HealthCategory,
    ChurnRiskCategory,
    RecommendationPriority,
    RecommendationStatus,
)


class ContributingFactor(BaseModel):
    factor: str
    severity: str = "medium"    # low, medium, high
    impact: float = 0.0          # points contribution to risk score
    description: str


class HealthScoreResponse(BaseModel):
    customer_id: int
    score: Optional[float] = None
    category: str
    payment_reliability_score: Optional[float] = None
    subscription_stability_score: Optional[float] = None
    renewal_behaviour_score: Optional[float] = None
    customer_tenure_score: Optional[float] = None
    revenue_consistency_score: Optional[float] = None
    positive_factors: list[str] = Field(default_factory=list)
    negative_factors: list[str] = Field(default_factory=list)
    formula_version: str = "1.0.0"
    weights_used: dict[str, float] = Field(default_factory=dict)
    is_data_sufficient: bool = True
    missing_data_fields: list[str] = Field(default_factory=list)
    calculated_at: datetime


class ChurnRiskResponse(BaseModel):
    customer_id: int
    risk_score: Optional[float] = None
    risk_category: str
    contributing_factors: list[ContributingFactor] = Field(default_factory=list)
    explanation: str
    recommended_action: str
    engine_version: str = "rule_based_v1"
    assessment_date: datetime


class RecommendationResponse(BaseModel):
    id: int
    customer_id: int
    recommendation_type: str
    reason: str
    priority: str
    suggested_action: str
    expected_benefit: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    executed_at: Optional[datetime] = None
    executed_by: Optional[int] = None
    execution_notes: Optional[str] = None


class RecommendationStatusUpdateRequest(BaseModel):
    status: RecommendationStatus
    execution_notes: Optional[str] = None


class CustomerBehaviourMetricsResponse(BaseModel):
    # Customer Info
    tenure_days: int
    tenure_months: float
    account_status: str
    registration_date: datetime

    # Subscription Behaviour
    active_subscriptions: int
    paused_subscriptions: int
    closed_subscriptions: int
    renewal_count: int
    upcoming_expirations: int
    days_to_expiration: Optional[int] = None
    avg_duration_days: Optional[float] = None
    has_auto_renew: bool

    # Payment Behaviour
    total_payments: int
    successful_payments: int
    failed_payments: int
    delayed_payments: int
    outstanding_invoices_amount: float
    overdue_invoices_count: int
    avg_payment_delay_days: Optional[float] = None
    days_since_last_payment: Optional[int] = None
    payment_success_rate: Optional[float] = None

    # Revenue Contribution
    monthly_recurring_revenue: float
    annual_recurring_revenue: float
    total_historical_revenue: float
    avg_subscription_value: float
    revenue_trend: str

    # Source info
    data_source: str
    is_demo_data: bool
    is_data_sufficient: bool


class CustomerIntelligenceItemResponse(BaseModel):
    customer_id: int
    customer_code: str
    customer_name: str
    customer_email: str
    company_name: Optional[str] = None
    account_status: str
    registration_date: datetime
    active_subscriptions: int
    health_score: Optional[float] = None
    health_category: str
    churn_risk: str
    churn_risk_score: Optional[float] = None
    recurring_revenue: float
    recommended_action: str
    segments: list[str] = Field(default_factory=list)
    is_data_sufficient: bool = True
    is_demo_data: bool = False
    data_source: str = "real_database"


class CustomerIntelligenceListResponse(BaseModel):
    items: list[CustomerIntelligenceItemResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class CustomerActivityItem(BaseModel):
    id: int
    event_type: str
    description: str
    actor_name: Optional[str] = None
    created_at: datetime


class CustomerIntelligenceDetailResponse(BaseModel):
    customer_id: int
    customer_code: str
    customer_name: str
    customer_email: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    account_status: str
    registration_date: datetime
    created_at: datetime
    
    health: HealthScoreResponse
    churn_risk: ChurnRiskResponse
    behaviour: CustomerBehaviourMetricsResponse
    recommendations: list[RecommendationResponse] = Field(default_factory=list)
    segments: list[str] = Field(default_factory=list)
    activities: list[CustomerActivityItem] = Field(default_factory=list)


class DistributionItem(BaseModel):
    category: str
    label: str
    count: int
    percentage: float


class IntelligenceSummaryResponse(BaseModel):
    total_analysed_customers: int
    healthy_customers: int
    needs_attention_customers: int
    high_churn_risk_customers: int
    at_risk_customers: int
    insufficient_data_customers: int
    health_distribution: list[DistributionItem]
    churn_risk_distribution: list[DistributionItem]


class SegmentSummary(BaseModel):
    segment_id: str
    name: str
    description: str
    criteria_summary: str
    customer_count: int
    total_mrr: float
    avg_health_score: Optional[float] = None


class SegmentsListResponse(BaseModel):
    segments: list[SegmentSummary]


class CustomerTelemetryUpsertRequest(BaseModel):
    active_subscriptions: Optional[int] = None
    paused_subscriptions: Optional[int] = None
    closed_subscriptions: Optional[int] = None
    renewal_count: Optional[int] = None
    upcoming_expirations: Optional[int] = None
    days_to_expiration: Optional[int] = None
    avg_duration_days: Optional[float] = None
    has_auto_renew: Optional[bool] = None
    total_payments: Optional[int] = None
    successful_payments: Optional[int] = None
    failed_payments: Optional[int] = None
    delayed_payments: Optional[int] = None
    outstanding_invoices_amount: Optional[float] = None
    overdue_invoices_count: Optional[int] = None
    avg_payment_delay_days: Optional[float] = None
    days_since_last_payment: Optional[int] = None
    monthly_recurring_revenue: Optional[float] = None
    total_historical_revenue: Optional[float] = None
    avg_subscription_value: Optional[float] = None
    revenue_trend: Optional[str] = None
    is_demo_data: Optional[bool] = None
    data_source: Optional[str] = None
