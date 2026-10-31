"""
REVORA – Customer Intelligence Service.

Orchestrates health scoring, churn prediction, customer segmentation,
retention recommendations, telemetry aggregation, and activity logging.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
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
from app.repositories.customer_intelligence_repository import CustomerIntelligenceRepository
from app.repositories.customer_repository import CustomerRepository
from app.schemas.customer_intelligence import (
    ContributingFactor,
    CustomerActivityItem,
    CustomerBehaviourMetricsResponse,
    CustomerIntelligenceDetailResponse,
    CustomerIntelligenceItemResponse,
    CustomerIntelligenceListResponse,
    DistributionItem,
    HealthScoreResponse,
    ChurnRiskResponse,
    IntelligenceSummaryResponse,
    RecommendationResponse,
    SegmentSummary,
    SegmentsListResponse,
)
from app.services.intelligence.churn_risk_engine import RuleBasedChurnEngine
from app.services.intelligence.health_scoring_engine import HealthScoringEngine
from app.services.intelligence.recommendation_engine import RetentionRecommendationEngine
from app.services.intelligence.segmentation_engine import AVAILABLE_SEGMENTS, CustomerSegmentationEngine
from app.services.intelligence.telemetry_provider import CustomerTelemetryProvider


class CustomerIntelligenceService:

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = CustomerIntelligenceRepository(db)
        self.customer_repo = CustomerRepository(db)
        self.telemetry_provider = CustomerTelemetryProvider(db)
        self.health_engine = HealthScoringEngine()
        self.churn_engine = RuleBasedChurnEngine()

    # ── Single Customer Intelligence ──────────────────────────────────────────

    def recalculate_customer(self, customer_id: int) -> CustomerIntelligenceDetailResponse:
        """
        Recalculates health score, churn risk assessment, segments,
        and retention recommendations on-demand for a customer.
        """
        customer = self.customer_repo.get_by_id(customer_id)
        if customer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID {customer_id} does not exist.",
            )

        metrics = self.telemetry_provider.get_metrics_for_customer(customer)

        # 1. Health scoring
        health_res = self.health_engine.calculate(metrics)
        health_record = self.repo.save_health_score(
            customer_id=customer_id,
            score=health_res.score,
            category=health_res.category,
            payment_score=health_res.payment_reliability_score,
            stability_score=health_res.subscription_stability_score,
            renewal_score=health_res.renewal_behaviour_score,
            tenure_score=health_res.customer_tenure_score,
            revenue_score=health_res.revenue_consistency_score,
            positive_factors=health_res.positive_factors,
            negative_factors=health_res.negative_factors,
            formula_version=health_res.formula_version,
            weights_used=health_res.weights_used,
            is_data_sufficient=health_res.is_data_sufficient,
            missing_data_fields=health_res.missing_data_fields,
        )

        # 2. Churn risk assessment
        churn_res = self.churn_engine.assess(customer_id, metrics)
        churn_record = self.repo.save_churn_assessment(
            customer_id=customer_id,
            risk_score=churn_res.risk_score,
            risk_category=churn_res.risk_category,
            contributing_factors=[f.as_dict() for f in churn_res.contributing_factors],
            explanation=churn_res.explanation,
            recommended_action=churn_res.recommended_action,
            engine_version=churn_res.engine_version,
        )

        # 3. Customer segmentation
        segments = CustomerSegmentationEngine.classify(
            metrics=metrics,
            health_score=health_res.score,
            churn_risk_category=churn_res.risk_category,
        )

        # 4. Retention recommendations
        generated_recs = RetentionRecommendationEngine.generate(
            customer_id=customer_id,
            metrics=metrics,
            health_score=health_res.score,
            churn_risk_score=churn_res.risk_score,
            churn_risk_category=churn_res.risk_category,
        )
        rec_records = self.repo.save_recommendations(customer_id, generated_recs)

        # 5. Log activity
        self.customer_repo.add_activity(
            customer_id=customer_id,
            event_type="customer.intelligence_calculated",
            description=f"Recalculated customer intelligence: Health {health_res.score or 'N/A'} ({health_res.category}), Churn Risk {churn_res.risk_score or 'N/A'} ({churn_res.risk_category}).",
        )

        self.db.commit()

        return self._build_detail_response(
            customer=customer,
            health=health_record,
            churn=churn_record,
            metrics=metrics,
            recommendations=rec_records,
            segments=segments,
        )

    def get_customer_intelligence(self, customer_id: int) -> CustomerIntelligenceDetailResponse:
        """
        Retrieves existing intelligence profile, or calculates it if not yet evaluated.
        """
        customer = self.customer_repo.get_by_id(customer_id)
        if customer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID {customer_id} does not exist.",
            )

        health = self.repo.get_health_score(customer_id)
        churn = self.repo.get_churn_assessment(customer_id)

        if health is None or churn is None:
            return self.recalculate_customer(customer_id)

        metrics = self.telemetry_provider.get_metrics_for_customer(customer)
        recs = self.repo.get_recommendations_for_customer(customer_id)
        segments = CustomerSegmentationEngine.classify(
            metrics=metrics,
            health_score=health.score,
            churn_risk_category=churn.risk_category,
        )

        return self._build_detail_response(
            customer=customer,
            health=health,
            churn=churn,
            metrics=metrics,
            recommendations=recs,
            segments=segments,
        )

    def get_customer_health(self, customer_id: int) -> HealthScoreResponse:
        intel = self.get_customer_intelligence(customer_id)
        return intel.health

    def get_customer_churn_risk(self, customer_id: int) -> ChurnRiskResponse:
        intel = self.get_customer_intelligence(customer_id)
        return intel.churn_risk

    def get_customer_recommendations(self, customer_id: int) -> list[RecommendationResponse]:
        intel = self.get_customer_intelligence(customer_id)
        return intel.recommendations

    def update_recommendation_status(
        self,
        rec_id: int,
        status: str,
        execution_notes: Optional[str] = None,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,
    ) -> RecommendationResponse:
        rec = self.repo.get_recommendation_by_id(rec_id)
        if rec is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation with ID {rec_id} does not exist.",
            )

        updated_rec = self.repo.update_recommendation_status(
            rec_id=rec_id,
            status=status,
            execution_notes=execution_notes,
            executed_by=user_id,
        )

        # Log to CustomerActivity
        action_note = f": {execution_notes}" if execution_notes else ""
        self.customer_repo.add_activity(
            customer_id=rec.customer_id,
            event_type="customer.retention_action",
            description=f"Retention recommendation '{rec.recommendation_type}' status updated to '{status}'{action_note}",
            actor_id=user_id,
            actor_name=user_name,
        )
        self.db.commit()

        return self._to_recommendation_response(updated_rec)

    # ── List / Search / Filter / Paginate ─────────────────────────────────────

    def list_customers_intelligence(
        self,
        search: Optional[str] = None,
        health_category: Optional[str] = None,
        churn_risk: Optional[str] = None,
        segment: Optional[str] = None,
        sort_by: str = "health_score",
        sort_dir: str = "desc",
        page: int = 1,
        limit: int = 10,
    ) -> CustomerIntelligenceListResponse:
        """
        List customers with intelligence indicators, filtering, sorting, and pagination.
        """
        self._ensure_all_customers_evaluated()

        # Fetch all customers
        customers = self.db.execute(select(Customer)).scalars().all()
        items: list[CustomerIntelligenceItemResponse] = []

        for cust in customers:
            health = self.repo.get_health_score(cust.id)
            churn = self.repo.get_churn_assessment(cust.id)
            metrics = self.telemetry_provider.get_metrics_for_customer(cust)

            if health is None or churn is None:
                continue

            segs = CustomerSegmentationEngine.classify(
                metrics=metrics,
                health_score=health.score,
                churn_risk_category=churn.risk_category,
            )

            # Search filter
            if search:
                s = search.lower().strip()
                matches = (
                    s in cust.full_name.lower()
                    or s in cust.customer_code.lower()
                    or s in cust.email.lower()
                    or (cust.company_name and s in cust.company_name.lower())
                )
                if not matches:
                    continue

            # Health category filter
            if health_category and health.category != health_category:
                continue

            # Churn risk filter
            if churn_risk and churn.risk_category != churn_risk:
                continue

            # Segment filter
            if segment and segment not in segs:
                continue

            items.append(
                CustomerIntelligenceItemResponse(
                    customer_id=cust.id,
                    customer_code=cust.customer_code,
                    customer_name=cust.full_name,
                    customer_email=cust.email,
                    company_name=cust.company_name,
                    account_status=cust.status.value if hasattr(cust.status, "value") else str(cust.status),
                    registration_date=cust.registration_date,
                    active_subscriptions=metrics.active_subscriptions,
                    health_score=health.score,
                    health_category=health.category,
                    churn_risk=churn.risk_category,
                    churn_risk_score=churn.risk_score,
                    recurring_revenue=metrics.monthly_recurring_revenue,
                    recommended_action=churn.recommended_action,
                    segments=segs,
                    is_data_sufficient=metrics.is_data_sufficient,
                    is_demo_data=metrics.is_demo_data,
                    data_source=metrics.data_source,
                )
            )

        # Sorting
        reverse = (sort_dir.lower() == "desc")
        if sort_by == "health_score":
            items.sort(key=lambda x: (x.health_score is not None, x.health_score or 0.0), reverse=reverse)
        elif sort_by == "risk_score":
            items.sort(key=lambda x: (x.churn_risk_score is not None, x.churn_risk_score or 0.0), reverse=reverse)
        elif sort_by == "recurring_revenue":
            items.sort(key=lambda x: x.recurring_revenue, reverse=reverse)
        elif sort_by == "customer_name":
            items.sort(key=lambda x: x.customer_name.lower(), reverse=reverse)
        else:
            items.sort(key=lambda x: x.registration_date, reverse=reverse)

        total = len(items)
        total_pages = max(1, math.ceil(total / limit)) if limit > 0 else 1
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_items = items[start_idx:end_idx]

        return CustomerIntelligenceListResponse(
            items=paginated_items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )

    # ── Summary / KPI Metrics ─────────────────────────────────────────────────

    def get_intelligence_summary(self) -> IntelligenceSummaryResponse:
        self._ensure_all_customers_evaluated()

        customers = self.db.execute(select(Customer)).scalars().all()
        total_analysed = len(customers)

        healthy_count = 0
        needs_attention_count = 0
        at_risk_count = 0
        insufficient_data_count = 0

        low_risk_count = 0
        medium_risk_count = 0
        high_risk_count = 0
        insufficient_risk_count = 0

        for cust in customers:
            health = self.repo.get_health_score(cust.id)
            churn = self.repo.get_churn_assessment(cust.id)

            if health is None or churn is None:
                continue

            # Health categorization
            if health.category == HealthCategory.HEALTHY.value:
                healthy_count += 1
            elif health.category == HealthCategory.NEEDS_ATTENTION.value:
                needs_attention_count += 1
            elif health.category == HealthCategory.AT_RISK.value:
                at_risk_count += 1
            else:
                insufficient_data_count += 1

            # Churn risk categorization
            if churn.risk_category == ChurnRiskCategory.LOW_RISK.value:
                low_risk_count += 1
            elif churn.risk_category == ChurnRiskCategory.MEDIUM_RISK.value:
                medium_risk_count += 1
            elif churn.risk_category == ChurnRiskCategory.HIGH_RISK.value:
                high_risk_count += 1
            else:
                insufficient_risk_count += 1

        # Health distribution items
        denom = max(1, total_analysed)
        health_dist = [
            DistributionItem(
                category=HealthCategory.HEALTHY.value,
                label="Healthy (75-100)",
                count=healthy_count,
                percentage=round((healthy_count / denom) * 100, 1),
            ),
            DistributionItem(
                category=HealthCategory.NEEDS_ATTENTION.value,
                label="Needs Attention (50-74)",
                count=needs_attention_count,
                percentage=round((needs_attention_count / denom) * 100, 1),
            ),
            DistributionItem(
                category=HealthCategory.AT_RISK.value,
                label="At Risk (0-49)",
                count=at_risk_count,
                percentage=round((at_risk_count / denom) * 100, 1),
            ),
            DistributionItem(
                category=HealthCategory.INSUFFICIENT_DATA.value,
                label="Insufficient Data",
                count=insufficient_data_count,
                percentage=round((insufficient_data_count / denom) * 100, 1),
            ),
        ]

        # Churn risk distribution items
        risk_dist = [
            DistributionItem(
                category=ChurnRiskCategory.LOW_RISK.value,
                label="Low Risk (0-34)",
                count=low_risk_count,
                percentage=round((low_risk_count / denom) * 100, 1),
            ),
            DistributionItem(
                category=ChurnRiskCategory.MEDIUM_RISK.value,
                label="Medium Risk (35-69)",
                count=medium_risk_count,
                percentage=round((medium_risk_count / denom) * 100, 1),
            ),
            DistributionItem(
                category=ChurnRiskCategory.HIGH_RISK.value,
                label="High Risk (70-100)",
                count=high_risk_count,
                percentage=round((high_risk_count / denom) * 100, 1),
            ),
        ]
        if insufficient_risk_count > 0:
            risk_dist.append(DistributionItem(
                category=ChurnRiskCategory.INSUFFICIENT_DATA.value,
                label="Insufficient Data",
                count=insufficient_risk_count,
                percentage=round((insufficient_risk_count / denom) * 100, 1),
            ))

        return IntelligenceSummaryResponse(
            total_analysed_customers=total_analysed,
            healthy_customers=healthy_count,
            needs_attention_customers=needs_attention_count,
            high_churn_risk_customers=high_risk_count,
            at_risk_customers=at_risk_count,
            insufficient_data_customers=insufficient_data_count,
            health_distribution=health_dist,
            churn_risk_distribution=risk_dist,
        )

    # ── Segments Overview ─────────────────────────────────────────────────────

    def get_segments_overview(self) -> SegmentsListResponse:
        self._ensure_all_customers_evaluated()

        customers = self.db.execute(select(Customer)).scalars().all()
        segment_stats: dict[str, dict[str, Any]] = {
            s.segment_id: {
                "count": 0,
                "total_mrr": 0.0,
                "health_scores": [],
            }
            for s in AVAILABLE_SEGMENTS
        }

        for cust in customers:
            health = self.repo.get_health_score(cust.id)
            churn = self.repo.get_churn_assessment(cust.id)
            metrics = self.telemetry_provider.get_metrics_for_customer(cust)

            if health is None or churn is None:
                continue

            segs = CustomerSegmentationEngine.classify(
                metrics=metrics,
                health_score=health.score,
                churn_risk_category=churn.risk_category,
            )

            for seg_id in segs:
                if seg_id in segment_stats:
                    segment_stats[seg_id]["count"] += 1
                    segment_stats[seg_id]["total_mrr"] += metrics.monthly_recurring_revenue
                    if health.score is not None:
                        segment_stats[seg_id]["health_scores"].append(health.score)

        results: list[SegmentSummary] = []
        for defn in AVAILABLE_SEGMENTS:
            st = segment_stats.get(defn.segment_id, {"count": 0, "total_mrr": 0.0, "health_scores": []})
            scores = st["health_scores"]
            avg_score = round(sum(scores) / len(scores), 1) if scores else None

            results.append(
                SegmentSummary(
                    segment_id=defn.segment_id,
                    name=defn.name,
                    description=defn.description,
                    criteria_summary=defn.criteria_summary,
                    customer_count=st["count"],
                    total_mrr=round(st["total_mrr"], 2),
                    avg_health_score=avg_score,
                )
            )

        return SegmentsListResponse(segments=results)

    # ── Internal Helpers ──────────────────────────────────────────────────────

    def _ensure_all_customers_evaluated(self) -> None:
        """
        Ensures all customers currently in DB have initial intelligence records computed.
        """
        customers = self.db.execute(select(Customer)).scalars().all()
        if not customers:
            return

        # Check if any customers lack telemetry and attach labelled demo profiles if needed
        telemetry_count = self.db.execute(select(func.count(CustomerTelemetry.id))).scalar_one()
        if telemetry_count == 0 and len(customers) > 0:
            self.telemetry_provider.attach_demo_telemetry_profiles(customers)

        for cust in customers:
            health = self.repo.get_health_score(cust.id)
            if health is None:
                self.recalculate_customer(cust.id)

    def _build_detail_response(
        self,
        customer: Customer,
        health: CustomerHealthScore,
        churn: CustomerChurnAssessment,
        metrics: Any,
        recommendations: list[RetentionRecommendation],
        segments: list[str],
    ) -> CustomerIntelligenceDetailResponse:
        # Load real activities
        activities = self.db.execute(
            select(CustomerActivity)
            .where(CustomerActivity.customer_id == customer.id)
            .order_by(CustomerActivity.created_at.desc())
        ).scalars().all()

        act_items = [
            CustomerActivityItem(
                id=a.id,
                event_type=a.event_type,
                description=a.description,
                actor_name=a.actor_name,
                created_at=a.created_at,
            )
            for a in activities
        ]

        # Convert contributing factors
        factors = [
            ContributingFactor(
                factor=f.get("factor", ""),
                severity=f.get("severity", "medium"),
                impact=f.get("impact", 0.0),
                description=f.get("description", ""),
            )
            for f in (churn.contributing_factors or [])
        ]

        return CustomerIntelligenceDetailResponse(
            customer_id=customer.id,
            customer_code=customer.customer_code,
            customer_name=customer.full_name,
            customer_email=customer.email,
            phone=customer.phone,
            company_name=customer.company_name,
            account_status=customer.status.value if hasattr(customer.status, "value") else str(customer.status),
            registration_date=customer.registration_date,
            created_at=customer.created_at,
            health=HealthScoreResponse(
                customer_id=customer.id,
                score=health.score,
                category=health.category,
                payment_reliability_score=health.payment_reliability_score,
                subscription_stability_score=health.subscription_stability_score,
                renewal_behaviour_score=health.renewal_behaviour_score,
                customer_tenure_score=health.customer_tenure_score,
                revenue_consistency_score=health.revenue_consistency_score,
                positive_factors=health.positive_factors or [],
                negative_factors=health.negative_factors or [],
                formula_version=health.formula_version,
                weights_used=health.weights_used or {},
                is_data_sufficient=health.is_data_sufficient,
                missing_data_fields=health.missing_data_fields or [],
                calculated_at=health.calculated_at,
            ),
            churn_risk=ChurnRiskResponse(
                customer_id=customer.id,
                risk_score=churn.risk_score,
                risk_category=churn.risk_category,
                contributing_factors=factors,
                explanation=churn.explanation,
                recommended_action=churn.recommended_action,
                engine_version=churn.engine_version,
                assessment_date=churn.assessment_date,
            ),
            behaviour=CustomerBehaviourMetricsResponse(
                tenure_days=metrics.tenure_days,
                tenure_months=metrics.tenure_months,
                account_status=metrics.account_status,
                registration_date=metrics.registration_date,
                active_subscriptions=metrics.active_subscriptions,
                paused_subscriptions=metrics.paused_subscriptions,
                closed_subscriptions=metrics.closed_subscriptions,
                renewal_count=metrics.renewal_count,
                upcoming_expirations=metrics.upcoming_expirations,
                days_to_expiration=metrics.days_to_expiration,
                avg_duration_days=metrics.avg_duration_days,
                has_auto_renew=metrics.has_auto_renew,
                total_payments=metrics.total_payments,
                successful_payments=metrics.successful_payments,
                failed_payments=metrics.failed_payments,
                delayed_payments=metrics.delayed_payments,
                outstanding_invoices_amount=metrics.outstanding_invoices_amount,
                overdue_invoices_count=metrics.overdue_invoices_count,
                avg_payment_delay_days=metrics.avg_payment_delay_days,
                days_since_last_payment=metrics.days_since_last_payment,
                payment_success_rate=metrics.payment_success_rate,
                monthly_recurring_revenue=metrics.monthly_recurring_revenue,
                annual_recurring_revenue=metrics.annual_recurring_revenue,
                total_historical_revenue=metrics.total_historical_revenue,
                avg_subscription_value=metrics.avg_subscription_value,
                revenue_trend=metrics.revenue_trend,
                data_source=metrics.data_source,
                is_demo_data=metrics.is_demo_data,
                is_data_sufficient=metrics.is_data_sufficient,
            ),
            recommendations=[self._to_recommendation_response(r) for r in recommendations],
            segments=segments,
            activities=act_items,
        )

    @staticmethod
    def _to_recommendation_response(r: RetentionRecommendation) -> RecommendationResponse:
        return RecommendationResponse(
            id=r.id,
            customer_id=r.customer_id,
            recommendation_type=r.recommendation_type,
            reason=r.reason,
            priority=r.priority,
            suggested_action=r.suggested_action,
            expected_benefit=r.expected_benefit,
            status=r.status,
            created_at=r.created_at,
            updated_at=r.updated_at,
            executed_at=r.executed_at,
            executed_by=r.executed_by,
            execution_notes=r.execution_notes,
        )
