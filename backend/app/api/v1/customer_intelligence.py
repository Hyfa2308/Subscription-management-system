"""
REVORA – Customer Intelligence API Endpoints.
Mounted under /api/v1/intelligence.

Provides endpoints for:
  - Intelligence summary & KPI cards
  - Segment distribution
  - Customer intelligence listing (search, filter, sort, server-side pagination)
  - Single customer intelligence profile
  - Health score details
  - Churn risk analysis
  - Retention recommendations (view, execute, update status)
  - On-demand recalculation
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    assert_owns_resource,
    get_current_active_user,
    require_admin_staff,
    require_any,
)
from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.customer_intelligence import (
    ChurnRiskResponse,
    CustomerIntelligenceDetailResponse,
    CustomerIntelligenceListResponse,
    CustomerTelemetryUpsertRequest,
    HealthScoreResponse,
    IntelligenceSummaryResponse,
    RecommendationResponse,
    RecommendationStatusUpdateRequest,
    SegmentsListResponse,
)
from app.services.customer_intelligence_service import CustomerIntelligenceService

router = APIRouter(tags=["Customer Intelligence"])


def get_service(db: Session = Depends(get_db)) -> CustomerIntelligenceService:
    return CustomerIntelligenceService(db)


# ── KPI Summary (Placed before dynamic routes) ────────────────────────────────

@router.get(
    "/summary",
    response_model=IntelligenceSummaryResponse,
    summary="Get overall customer intelligence KPI metrics and distributions",
)
def get_summary(
    _: User = Depends(require_admin_staff),
    service: CustomerIntelligenceService = Depends(get_service),
):
    """
    Returns high-level KPI cards and distribution metrics for:
      - Total analysed customers
      - Healthy count & percentage
      - Needs attention count & percentage
      - High churn risk count & percentage
      - At-risk count & percentage
      - Insufficient data count & percentage
    All statistics are derived from actual database records.
    """
    return service.get_intelligence_summary()


# ── Segments Overview (Placed before dynamic routes) ──────────────────────────

@router.get(
    "/segments",
    response_model=SegmentsListResponse,
    summary="Get automatic customer segmentation breakdown",
)
def get_segments(
    _: User = Depends(require_admin_staff),
    service: CustomerIntelligenceService = Depends(get_service),
):
    """
    Returns all 6 automatic customer segments with criteria,
    qualifying customer counts, aggregate MRR, and average health scores.
    """
    return service.get_segments_overview()


# ── List Customers Intelligence ───────────────────────────────────────────────

@router.get(
    "/customers",
    response_model=CustomerIntelligenceListResponse,
    summary="List customer intelligence profiles with filters, search, and pagination",
)
def list_customers_intelligence(
    search:          Optional[str] = Query(None, description="Search by customer name, code, or email"),
    health_category: Optional[str] = Query(None, description="Filter by health category (healthy, needs_attention, at_risk, insufficient_data)"),
    churn_risk:      Optional[str] = Query(None, description="Filter by churn risk (low_risk, medium_risk, high_risk, insufficient_data)"),
    segment:         Optional[str] = Query(None, description="Filter by segment (high_value, loyal, new, at_risk, inactive, growing)"),
    sort_by:         str           = Query("health_score", description="Sort by: health_score, risk_score, recurring_revenue, customer_name, created_at"),
    sort_dir:        str           = Query("desc", description="Sort direction: asc or desc"),
    page:            int           = Query(1, ge=1, description="Page number"),
    limit:           int           = Query(10, ge=1, le=100, description="Page size"),
    _: User                        = Depends(require_admin_staff),
    service: CustomerIntelligenceService = Depends(get_service),
):
    """
    Returns a paginated list of customers with their health scores,
    churn risks, MRR, segments, and recommended actions.
    """
    return service.list_customers_intelligence(
        search=search,
        health_category=health_category,
        churn_risk=churn_risk,
        segment=segment,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        limit=limit,
    )


# ── Single Customer Intelligence Profile ──────────────────────────────────────

@router.get(
    "/customers/{customer_id}",
    response_model=CustomerIntelligenceDetailResponse,
    summary="Get full intelligence details for a customer",
)
def get_customer_intelligence(
    customer_id: int,
    current_user: User = Depends(get_current_active_user),
    service: CustomerIntelligenceService = Depends(get_service),
):
    """
    Returns complete customer overview, health score breakdown,
    churn risk factors, behaviour analysis, recommendations, and activity history.
    """
    assert_owns_resource(current_user, customer_id)
    return service.get_customer_intelligence(customer_id)


# ── Customer Health Score Endpoint ────────────────────────────────────────────

@router.get(
    "/customers/{customer_id}/health",
    response_model=HealthScoreResponse,
    summary="Get customer health score and factor breakdown",
)
def get_customer_health(
    customer_id: int,
    current_user: User = Depends(get_current_active_user),
    service: CustomerIntelligenceService = Depends(get_service),
):
    """
    Returns the customer's 0-100 health score, category, formula weights,
    and positive/negative contributing factors.
    """
    assert_owns_resource(current_user, customer_id)
    return service.get_customer_health(customer_id)


# ── Customer Churn Risk Endpoint ──────────────────────────────────────────────

@router.get(
    "/customers/{customer_id}/churn-risk",
    response_model=ChurnRiskResponse,
    summary="Get customer churn risk assessment and indicators",
)
def get_customer_churn_risk(
    customer_id: int,
    current_user: User = Depends(get_current_active_user),
    service: CustomerIntelligenceService = Depends(get_service),
):
    """
    Returns the customer's churn risk score (0-100), risk category,
    contributing indicators with severity/impact, and primary recommended action.
    """
    assert_owns_resource(current_user, customer_id)
    return service.get_customer_churn_risk(customer_id)


# ── Customer Retention Recommendations Endpoint ───────────────────────────────

@router.get(
    "/customers/{customer_id}/recommendations",
    response_model=list[RecommendationResponse],
    summary="Get retention recommendations for a customer",
)
def get_customer_recommendations(
    customer_id: int,
    current_user: User = Depends(get_current_active_user),
    service: CustomerIntelligenceService = Depends(get_service),
):
    """
    Returns the list of recommended retention actions with priorities,
    reasons, and estimated benefits.
    """
    assert_owns_resource(current_user, customer_id)
    return service.get_customer_recommendations(customer_id)


# ── Recalculate On Demand ─────────────────────────────────────────────────────

@router.post(
    "/customers/{customer_id}/recalculate",
    response_model=CustomerIntelligenceDetailResponse,
    summary="Recalculate customer intelligence on-demand",
)
def recalculate_customer_intelligence(
    customer_id: int,
    _: User = Depends(require_admin_staff),
    service: CustomerIntelligenceService = Depends(get_service),
):
    """
    Forces an immediate recalculation of health score, churn risk,
    segments, and retention recommendations based on the latest telemetry.
    """
    return service.recalculate_customer(customer_id)


# ── Recommendation Status Update / Execution ──────────────────────────────────

@router.patch(
    "/recommendations/{recommendation_id}/status",
    response_model=RecommendationResponse,
    summary="Update recommendation status or record execution",
)
def update_recommendation_status(
    recommendation_id: int,
    data: RecommendationStatusUpdateRequest,
    current_user: User = Depends(require_admin_staff),
    service: CustomerIntelligenceService = Depends(get_service),
):
    """
    Updates the status of a retention recommendation (pending, in_progress, completed, dismissed).
    Records user audit trace and appends an entry to the customer activity log.
    """
    return service.update_recommendation_status(
        rec_id=recommendation_id,
        status=data.status.value if hasattr(data.status, "value") else str(data.status),
        execution_notes=data.execution_notes,
        user_id=current_user.id,
        user_name=current_user.full_name,
    )
