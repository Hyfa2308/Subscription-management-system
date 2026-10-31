"""
REVORA – Customer Intelligence & Churn Prediction Tests.
Verifies:
  - Health score calculations & explainability
  - Missing data & Insufficient Data state handling
  - Churn risk classification & contributing indicators
  - Customer segmentation (all 6 segments + multi-segment membership)
  - Retention recommendations engine & priority logic
  - API authorization & RBAC guards
  - Search, filter, sort, and pagination
  - Recalculation & recommendation status update with activity logging
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password, create_access_token
from app.models.customer import Customer, CustomerStatus
from app.models.customer_intelligence import (
    CustomerTelemetry,
    HealthCategory,
    ChurnRiskCategory,
    RecommendationStatus,
)
from app.models.user import User, UserRole
from app.services.intelligence.health_scoring_engine import HealthScoringEngine, HealthScoreConfig
from app.services.intelligence.churn_risk_engine import RuleBasedChurnEngine
from app.services.intelligence.segmentation_engine import CustomerSegmentationEngine
from app.services.intelligence.recommendation_engine import RetentionRecommendationEngine


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_user(db: Session, email: str, role: UserRole) -> tuple[User, str]:
    user = User(
        full_name=f"{role.value.capitalize()} User",
        email=email,
        hashed_password=hash_password("SecurePassword123!"),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id))
    return user, token


def create_customer(
    db: Session,
    full_name: str = "Acme Corp",
    email: str = "billing@acme.com",
    days_ago: int = 120,
    status: CustomerStatus = CustomerStatus.ACTIVE,
) -> Customer:
    now = datetime.now(timezone.utc)
    cust = Customer(
        full_name=full_name,
        email=email,
        status=status,
        registration_date=now - timedelta(days=days_ago),
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)
    return cust


# ── Engine Unit Tests ─────────────────────────────────────────────────────────

def test_health_score_calculation_healthy():
    engine = HealthScoringEngine()
    
    class MockHealthyMetrics:
        is_data_sufficient = True
        total_payments = 12
        successful_payments = 12
        failed_payments = 0
        outstanding_invoices_amount = 0.0
        overdue_invoices_count = 0
        avg_payment_delay_days = 0.0
        active_subscriptions = 2
        paused_subscriptions = 0
        closed_subscriptions = 0
        renewal_count = 3
        days_to_expiration = 120
        has_auto_renew = True
        tenure_days = 400
        monthly_recurring_revenue = 600.0
        revenue_trend = "growing"

    result = engine.calculate(MockHealthyMetrics())
    assert result.score is not None
    assert result.score >= 75.0
    assert result.category == HealthCategory.HEALTHY.value
    assert len(result.positive_factors) > 0
    assert result.payment_reliability_score is not None and result.payment_reliability_score >= 90.0


def test_health_score_calculation_at_risk():
    engine = HealthScoringEngine()

    class MockAtRiskMetrics:
        is_data_sufficient = True
        total_payments = 10
        successful_payments = 6
        failed_payments = 4
        outstanding_invoices_amount = 850.0
        overdue_invoices_count = 2
        avg_payment_delay_days = 15.0
        active_subscriptions = 0
        paused_subscriptions = 1
        closed_subscriptions = 2
        renewal_count = 0
        days_to_expiration = 5
        has_auto_renew = False
        tenure_days = 45
        monthly_recurring_revenue = 0.0
        revenue_trend = "declining"

    result = engine.calculate(MockAtRiskMetrics())
    assert result.score is not None
    assert result.score < 50.0
    assert result.category == HealthCategory.AT_RISK.value
    assert len(result.negative_factors) > 0


def test_missing_data_handling_insufficient_data():
    engine = HealthScoringEngine()

    class MockEmptyMetrics:
        is_data_sufficient = False
        total_payments = 0
        active_subscriptions = 0
        paused_subscriptions = 0
        closed_subscriptions = 0
        tenure_days = 2

    result = engine.calculate(MockEmptyMetrics())
    assert result.score is None
    assert result.category == HealthCategory.INSUFFICIENT_DATA.value
    assert result.is_data_sufficient is False
    assert "payment_history" in result.missing_data_fields


def test_churn_risk_engine_classification():
    churn_engine = RuleBasedChurnEngine()

    # High risk profile
    class MockHighRiskMetrics:
        is_data_sufficient = True
        total_payments = 6
        failed_payments = 3
        outstanding_invoices_amount = 650.0
        overdue_invoices_count = 2
        paused_subscriptions = 1
        active_subscriptions = 0
        closed_subscriptions = 1
        days_to_expiration = 7
        has_auto_renew = False
        revenue_trend = "declining"
        days_since_last_payment = 65
        tenure_days = 50

    high_risk_result = churn_engine.assess(1, MockHighRiskMetrics())
    assert high_risk_result.risk_score is not None
    assert high_risk_result.risk_score >= 70.0
    assert high_risk_result.risk_category == ChurnRiskCategory.HIGH_RISK.value
    assert len(high_risk_result.contributing_factors) >= 3
    assert "dunning" in high_risk_result.recommended_action.lower() or "billing" in high_risk_result.recommended_action.lower()

    # Low risk profile
    class MockLowRiskMetrics:
        is_data_sufficient = True
        total_payments = 20
        failed_payments = 0
        outstanding_invoices_amount = 0.0
        overdue_invoices_count = 0
        paused_subscriptions = 0
        active_subscriptions = 2
        closed_subscriptions = 0
        days_to_expiration = 180
        has_auto_renew = True
        revenue_trend = "growing"
        days_since_last_payment = 10
        tenure_days = 400

    low_risk_result = churn_engine.assess(2, MockLowRiskMetrics())
    assert low_risk_result.risk_score is not None
    assert low_risk_result.risk_score < 35.0
    assert low_risk_result.risk_category == ChurnRiskCategory.LOW_RISK.value


def test_customer_segmentation_rules():
    # Customer qualifying for High Value, Loyal, and Growing
    class MockEnterpriseCustomer:
        monthly_recurring_revenue = 1200.0
        total_historical_revenue = 14400.0
        tenure_days = 380
        account_status = "active"
        active_subscriptions = 3
        outstanding_invoices_amount = 0.0
        failed_payments = 0
        revenue_trend = "growing"

    segs = CustomerSegmentationEngine.classify(MockEnterpriseCustomer(), health_score=92.0, churn_risk_category="low_risk")
    assert "high_value" in segs
    assert "loyal" in segs
    assert "growing" in segs
    assert "at_risk" not in segs

    # New Customer
    class MockNewCustomer:
        monthly_recurring_revenue = 100.0
        total_historical_revenue = 100.0
        tenure_days = 20
        account_status = "active"
        active_subscriptions = 1
        outstanding_invoices_amount = 0.0
        failed_payments = 0
        revenue_trend = "stable"

    segs_new = CustomerSegmentationEngine.classify(MockNewCustomer(), health_score=60.0, churn_risk_category="low_risk")
    assert "new" in segs_new

    # At-Risk Customer
    class MockAtRiskCustomer:
        monthly_recurring_revenue = 200.0
        total_historical_revenue = 1200.0
        tenure_days = 90
        account_status = "active"
        active_subscriptions = 1
        outstanding_invoices_amount = 450.0
        failed_payments = 2
        revenue_trend = "declining"

    segs_risk = CustomerSegmentationEngine.classify(MockAtRiskCustomer(), health_score=42.0, churn_risk_category="high_risk")
    assert "at_risk" in segs_risk


def test_recommendation_engine_generation():
    class MockAtRiskAccount:
        failed_payments = 2
        outstanding_invoices_amount = 350.0
        overdue_invoices_count = 1
        paused_subscriptions = 1
        active_subscriptions = 1
        closed_subscriptions = 0
        days_to_expiration = 10
        has_auto_renew = False
        monthly_recurring_revenue = 250.0
        tenure_days = 120
        revenue_trend = "declining"

    recs = RetentionRecommendationEngine.generate(
        customer_id=10,
        metrics=MockAtRiskAccount(),
        health_score=45.0,
        churn_risk_score=78.0,
        churn_risk_category="high_risk",
    )
    assert len(recs) >= 2
    types = [r.recommendation_type for r in recs]
    assert "payment_recovery" in types
    assert "paused_service_reactivation" in types
    assert all(r.status == RecommendationStatus.PENDING.value for r in recs)


# ── Integration & API Endpoints Tests ─────────────────────────────────────────

def test_api_summary_and_rbac(client: TestClient, db: Session):
    _, admin_token = create_user(db, "admin_test@revora.com", UserRole.ADMIN)
    cust_user, customer_token = create_user(db, "cust_test@revora.com", UserRole.CUSTOMER)

    # Populate 3 sample customers with distinct profiles
    c1 = create_customer(db, "Healthy Alpha", "alpha@revora.com", days_ago=200)
    c2 = create_customer(db, "At Risk Beta", "beta@revora.com", days_ago=60)
    c3 = create_customer(db, "Newbie Gamma", "gamma@revora.com", days_ago=10)

    # Add telemetry
    t1 = CustomerTelemetry(
        customer_id=c1.id,
        active_subscriptions=2,
        total_payments=12,
        successful_payments=12,
        monthly_recurring_revenue=500.0,
        revenue_trend="growing",
        is_demo_data=False,
        data_source="real_database",
    )
    t2 = CustomerTelemetry(
        customer_id=c2.id,
        active_subscriptions=1,
        paused_subscriptions=1,
        failed_payments=3,
        outstanding_invoices_amount=400.0,
        overdue_invoices_count=2,
        monthly_recurring_revenue=150.0,
        revenue_trend="declining",
        is_demo_data=False,
        data_source="real_database",
    )
    db.add_all([t1, t2])
    db.commit()

    # 1. Unauthenticated request should fail (401)
    res_unauth = client.get("/api/v1/intelligence/summary")
    assert res_unauth.status_code == 401

    # 2. Customer role should be forbidden from summary (403)
    res_cust = client.get(
        "/api/v1/intelligence/summary",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert res_cust.status_code == 403

    # 3. Admin can view summary
    res_admin = client.get(
        "/api/v1/intelligence/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert data["total_analysed_customers"] == 3
    assert "healthy_customers" in data
    assert "high_churn_risk_customers" in data
    assert len(data["health_distribution"]) == 4


def test_api_list_customers_search_and_filters(client: TestClient, db: Session):
    _, admin_token = create_user(db, "admin2@revora.com", UserRole.ADMIN)

    c1 = create_customer(db, "Acme Corporation", "contact@acme.com", days_ago=300)
    c2 = create_customer(db, "Zenith Media", "zenith@media.com", days_ago=45)

    t1 = CustomerTelemetry(
        customer_id=c1.id,
        active_subscriptions=2,
        total_payments=20,
        successful_payments=20,
        monthly_recurring_revenue=800.0,
        revenue_trend="growing",
    )
    t2 = CustomerTelemetry(
        customer_id=c2.id,
        active_subscriptions=1,
        failed_payments=2,
        outstanding_invoices_amount=300.0,
        overdue_invoices_count=1,
        monthly_recurring_revenue=100.0,
        revenue_trend="declining",
    )
    db.add_all([t1, t2])
    db.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}

    # Search for "Acme"
    res_search = client.get("/api/v1/intelligence/customers?search=Acme", headers=headers)
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert search_data["total"] == 1
    assert search_data["items"][0]["customer_name"] == "Acme Corporation"

    # Filter by segment "high_value"
    res_seg = client.get("/api/v1/intelligence/customers?segment=high_value", headers=headers)
    assert res_seg.status_code == 200
    seg_data = res_seg.json()
    assert any(item["customer_name"] == "Acme Corporation" for item in seg_data["items"])

    # Sorting by recurring_revenue desc
    res_sort = client.get("/api/v1/intelligence/customers?sort_by=recurring_revenue&sort_dir=desc", headers=headers)
    assert res_sort.status_code == 200
    sort_data = res_sort.json()
    assert sort_data["items"][0]["recurring_revenue"] >= sort_data["items"][1]["recurring_revenue"]


def test_api_customer_detail_and_recalculate(client: TestClient, db: Session):
    _, admin_token = create_user(db, "admin3@revora.com", UserRole.ADMIN)
    cust = create_customer(db, "Globex Inc", "info@globex.com", days_ago=90)

    headers = {"Authorization": f"Bearer {admin_token}"}

    # Get single customer detail
    res = client.get(f"/api/v1/intelligence/customers/{cust.id}", headers=headers)
    assert res.status_code == 200
    detail = res.json()
    assert detail["customer_id"] == cust.id
    assert "health" in detail
    assert "churn_risk" in detail
    assert "behaviour" in detail
    assert "recommendations" in detail
    assert "activities" in detail

    # Recalculate endpoint
    res_recalc = client.post(f"/api/v1/intelligence/customers/{cust.id}/recalculate", headers=headers)
    assert res_recalc.status_code == 200
    recalc_data = res_recalc.json()
    assert recalc_data["customer_id"] == cust.id

    # Test recommendations endpoint
    res_recs = client.get(f"/api/v1/intelligence/customers/{cust.id}/recommendations", headers=headers)
    assert res_recs.status_code == 200
    assert isinstance(res_recs.json(), list)

    # Test health endpoint
    res_health = client.get(f"/api/v1/intelligence/customers/{cust.id}/health", headers=headers)
    assert res_health.status_code == 200
    assert "category" in res_health.json()

    # Test churn risk endpoint
    res_churn = client.get(f"/api/v1/intelligence/customers/{cust.id}/churn-risk", headers=headers)
    assert res_churn.status_code == 200
    assert "risk_category" in res_churn.json()


def test_api_recommendation_status_update_and_audit(client: TestClient, db: Session):
    _, admin_token = create_user(db, "admin4@revora.com", UserRole.ADMIN)
    cust = create_customer(db, "Initech", "admin@initech.com", days_ago=120)

    tel = CustomerTelemetry(
        customer_id=cust.id,
        active_subscriptions=1,
        paused_subscriptions=1,
        failed_payments=2,
        outstanding_invoices_amount=300.0,
        monthly_recurring_revenue=200.0,
    )
    db.add(tel)
    db.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}

    # Recalculate to generate recommendations
    recalc = client.post(f"/api/v1/intelligence/customers/{cust.id}/recalculate", headers=headers)
    recs = recalc.json()["recommendations"]
    assert len(recs) > 0

    first_rec_id = recs[0]["id"]

    # Update recommendation status to in_progress with notes
    update_res = client.patch(
        f"/api/v1/intelligence/recommendations/{first_rec_id}/status",
        json={"status": "in_progress", "execution_notes": "Outreach email sent to CFO"},
        headers=headers,
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["status"] == "in_progress"
    assert updated["execution_notes"] == "Outreach email sent to CFO"

    # Verify that an activity log entry was appended to the customer
    detail = client.get(f"/api/v1/intelligence/customers/{cust.id}", headers=headers).json()
    activities = detail["activities"]
    assert any("retention_action" in a["event_type"] for a in activities)


def test_api_segments_overview(client: TestClient, db: Session):
    _, admin_token = create_user(db, "admin5@revora.com", UserRole.ADMIN)
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/intelligence/segments", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["segments"]) == 6
    segment_ids = [s["segment_id"] for s in data["segments"]]
    assert "high_value" in segment_ids
    assert "loyal" in segment_ids
    assert "new" in segment_ids
    assert "at_risk" in segment_ids
    assert "inactive" in segment_ids
    assert "growing" in segment_ids
