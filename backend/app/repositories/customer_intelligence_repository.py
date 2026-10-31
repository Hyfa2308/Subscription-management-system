"""
REVORA – Customer Intelligence Repository.

Handles all persistence and database queries for:
  - Customer Health Scores
  - Churn Risk Assessments
  - Retention Recommendations
  - Customer Telemetry
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import delete, desc, func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.customer import Customer, CustomerActivity
from app.models.customer_intelligence import (
    CustomerChurnAssessment,
    CustomerHealthScore,
    CustomerTelemetry,
    HealthCategory,
    ChurnRiskCategory,
    RecommendationStatus,
    RetentionRecommendation,
)


class CustomerIntelligenceRepository:

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Health Score ──────────────────────────────────────────────────────────

    def save_health_score(
        self,
        customer_id: int,
        score: Optional[float],
        category: str,
        payment_score: Optional[float],
        stability_score: Optional[float],
        renewal_score: Optional[float],
        tenure_score: Optional[float],
        revenue_score: Optional[float],
        positive_factors: list[str],
        negative_factors: list[str],
        formula_version: str,
        weights_used: dict[str, float],
        is_data_sufficient: bool,
        missing_data_fields: list[str],
    ) -> CustomerHealthScore:
        # Check if record exists, update or insert
        record = self.db.execute(
            select(CustomerHealthScore).where(CustomerHealthScore.customer_id == customer_id)
        ).scalars().first()

        now = datetime.now(timezone.utc)

        if record is None:
            record = CustomerHealthScore(
                customer_id=customer_id,
                score=score,
                category=category,
                payment_reliability_score=payment_score,
                subscription_stability_score=stability_score,
                renewal_behaviour_score=renewal_score,
                customer_tenure_score=tenure_score,
                revenue_consistency_score=revenue_score,
                positive_factors=positive_factors,
                negative_factors=negative_factors,
                formula_version=formula_version,
                weights_used=weights_used,
                is_data_sufficient=is_data_sufficient,
                missing_data_fields=missing_data_fields,
                calculated_at=now,
            )
            self.db.add(record)
        else:
            record.score = score
            record.category = category
            record.payment_reliability_score = payment_score
            record.subscription_stability_score = stability_score
            record.renewal_behaviour_score = renewal_score
            record.customer_tenure_score = tenure_score
            record.revenue_consistency_score = revenue_score
            record.positive_factors = positive_factors
            record.negative_factors = negative_factors
            record.formula_version = formula_version
            record.weights_used = weights_used
            record.is_data_sufficient = is_data_sufficient
            record.missing_data_fields = missing_data_fields
            record.calculated_at = now

        self.db.flush()
        return record

    def get_health_score(self, customer_id: int) -> Optional[CustomerHealthScore]:
        return self.db.execute(
            select(CustomerHealthScore).where(CustomerHealthScore.customer_id == customer_id)
        ).scalars().first()

    # ── Churn Risk Assessment ─────────────────────────────────────────────────

    def save_churn_assessment(
        self,
        customer_id: int,
        risk_score: Optional[float],
        risk_category: str,
        contributing_factors: list[dict[str, Any]],
        explanation: str,
        recommended_action: str,
        engine_version: str,
    ) -> CustomerChurnAssessment:
        record = self.db.execute(
            select(CustomerChurnAssessment).where(CustomerChurnAssessment.customer_id == customer_id)
        ).scalars().first()

        now = datetime.now(timezone.utc)

        if record is None:
            record = CustomerChurnAssessment(
                customer_id=customer_id,
                risk_score=risk_score,
                risk_category=risk_category,
                contributing_factors=contributing_factors,
                explanation=explanation,
                recommended_action=recommended_action,
                engine_version=engine_version,
                assessment_date=now,
            )
            self.db.add(record)
        else:
            record.risk_score = risk_score
            record.risk_category = risk_category
            record.contributing_factors = contributing_factors
            record.explanation = explanation
            record.recommended_action = recommended_action
            record.engine_version = engine_version
            record.assessment_date = now

        self.db.flush()
        return record

    def get_churn_assessment(self, customer_id: int) -> Optional[CustomerChurnAssessment]:
        return self.db.execute(
            select(CustomerChurnAssessment).where(CustomerChurnAssessment.customer_id == customer_id)
        ).scalars().first()

    # ── Retention Recommendations ─────────────────────────────────────────────

    def save_recommendations(
        self,
        customer_id: int,
        recommendations: list[Any],
    ) -> list[RetentionRecommendation]:
        # Delete existing pending recommendations so they refresh cleanly with new calculations,
        # but keep completed or in_progress recommendations for audit history
        self.db.execute(
            delete(RetentionRecommendation).where(
                RetentionRecommendation.customer_id == customer_id,
                RetentionRecommendation.status == RecommendationStatus.PENDING.value,
            )
        )

        results: list[RetentionRecommendation] = []
        now = datetime.now(timezone.utc)

        for r in recommendations:
            rec = RetentionRecommendation(
                customer_id=customer_id,
                recommendation_type=r.recommendation_type,
                reason=r.reason,
                priority=r.priority,
                suggested_action=r.suggested_action,
                expected_benefit=r.expected_benefit,
                status=getattr(r, "status", RecommendationStatus.PENDING.value),
                created_at=now,
                updated_at=now,
            )
            self.db.add(rec)
            results.append(rec)

        self.db.flush()
        return results

    def get_recommendations_for_customer(
        self, customer_id: int, status: Optional[str] = None
    ) -> list[RetentionRecommendation]:
        stmt = select(RetentionRecommendation).where(RetentionRecommendation.customer_id == customer_id)
        if status:
            stmt = stmt.where(RetentionRecommendation.status == status)
        stmt = stmt.order_by(RetentionRecommendation.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def get_recommendation_by_id(self, rec_id: int) -> Optional[RetentionRecommendation]:
        return self.db.get(RetentionRecommendation, rec_id)

    def update_recommendation_status(
        self,
        rec_id: int,
        status: str,
        execution_notes: Optional[str] = None,
        executed_by: Optional[int] = None,
    ) -> RetentionRecommendation:
        rec = self.db.get(RetentionRecommendation, rec_id)
        if rec is None:
            raise ValueError(f"Recommendation {rec_id} not found.")

        rec.status = status
        rec.updated_at = datetime.now(timezone.utc)
        if execution_notes is not None:
            rec.execution_notes = execution_notes

        if status in (RecommendationStatus.COMPLETED.value, RecommendationStatus.IN_PROGRESS.value):
            rec.executed_at = datetime.now(timezone.utc)
            rec.executed_by = executed_by

        self.db.flush()
        return rec

    # ── Telemetry ─────────────────────────────────────────────────────────────

    def get_telemetry(self, customer_id: int) -> Optional[CustomerTelemetry]:
        return self.db.execute(
            select(CustomerTelemetry).where(CustomerTelemetry.customer_id == customer_id)
        ).scalars().first()

    def upsert_telemetry(self, customer_id: int, data: dict[str, Any]) -> CustomerTelemetry:
        tel = self.get_telemetry(customer_id)
        now = datetime.now(timezone.utc)

        if tel is None:
            tel = CustomerTelemetry(customer_id=customer_id, updated_at=now, **data)
            self.db.add(tel)
        else:
            for k, v in data.items():
                if hasattr(tel, k) and v is not None:
                    setattr(tel, k, v)
            tel.updated_at = now

        self.db.flush()
        return tel
