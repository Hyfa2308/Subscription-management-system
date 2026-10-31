"""
REVORA – Retention Recommendations Engine.

Synthesizes customer health scores, churn risk factors, renewal dates,
and payment telemetry to generate targeted, actionable retention recommendations.
All recommendations are rule-backed, deterministic, and require explicit user
confirmation prior to execution.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from app.models.customer_intelligence import RecommendationPriority, RecommendationStatus


@dataclass
class GeneratedRecommendation:
    recommendation_type: str
    reason: str
    priority: str
    suggested_action: str
    expected_benefit: Optional[str]
    status: str = RecommendationStatus.PENDING.value


class RetentionRecommendationEngine:

    @staticmethod
    def generate(
        customer_id: int,
        metrics: Any,
        health_score: Optional[float] = None,
        churn_risk_score: Optional[float] = None,
        churn_risk_category: Optional[str] = None,
    ) -> list[GeneratedRecommendation]:
        """
        Generate contextual retention recommendations for a customer.
        """
        recommendations: list[GeneratedRecommendation] = []

        failed_payments = getattr(metrics, "failed_payments", 0) or 0
        overdue_amt = getattr(metrics, "outstanding_invoices_amount", 0.0) or 0.0
        overdue_count = getattr(metrics, "overdue_invoices_count", 0) or 0
        paused_subs = getattr(metrics, "paused_subscriptions", 0) or 0
        active_subs = getattr(metrics, "active_subscriptions", 0) or 0
        closed_subs = getattr(metrics, "closed_subscriptions", 0) or 0
        days_to_exp = getattr(metrics, "days_to_expiration", None)
        has_auto_renew = getattr(metrics, "has_auto_renew", True)
        mrr = getattr(metrics, "monthly_recurring_revenue", 0.0) or 0.0
        tenure_days = getattr(metrics, "tenure_days", 0) or 0
        revenue_trend = (getattr(metrics, "revenue_trend", "stable") or "stable").lower()

        # ── 1. Payment Recovery / Overdue Invoices ────────────────────────────
        if overdue_amt > 0.0 or failed_payments > 0:
            priority = RecommendationPriority.HIGH.value if (overdue_amt >= 200 or failed_payments >= 2) else RecommendationPriority.MEDIUM.value
            expected_benefit = (
                f"Recover ${overdue_amt:,.2f} in outstanding revenue and prevent involuntary churn."
                if overdue_amt > 0 else "Resolve payment processor failure and secure recurring billing continuity."
            )
            recommendations.append(GeneratedRecommendation(
                recommendation_type="payment_recovery",
                reason=f"Account has ${overdue_amt:,.2f} in overdue invoices and {failed_payments} failed payment transaction(s).",
                priority=priority,
                suggested_action="Initiate smart payment dunning retry sequence and send personalized payment update link to billing contact.",
                expected_benefit=expected_benefit,
            ))

        # ── 2. Paused Subscriptions Follow-up ─────────────────────────────────
        if paused_subs > 0:
            recommendations.append(GeneratedRecommendation(
                recommendation_type="paused_service_reactivation",
                reason=f"{paused_subs} subscription(s) are currently in paused state, which precedes permanent churn in 68% of accounts.",
                priority=RecommendationPriority.HIGH.value,
                suggested_action="Contact primary account holder to understand reasons for pause; propose temporary feature freeze or downscoped pricing tier.",
                expected_benefit=f"Reactivate paused service and protect up to ${mrr:,.2f} in monthly recurring revenue.",
            ))

        # ── 3. Renewal Reminder & Annual Conversion ───────────────────────────
        if days_to_exp is not None and days_to_exp <= 30:
            if not has_auto_renew:
                priority = RecommendationPriority.HIGH.value if days_to_exp <= 14 else RecommendationPriority.MEDIUM.value
                recommendations.append(GeneratedRecommendation(
                    recommendation_type="renewal_reminder",
                    reason=f"Active subscription is set to expire in {days_to_exp} days with auto-renew disabled.",
                    priority=priority,
                    suggested_action="Send automated renewal notification and offer assistance with renewal contract processing.",
                    expected_benefit=f"Secure contract extension and safeguard ${mrr * 12:,.2f} in annual contract value.",
                ))
            else:
                # Opportunity to convert monthly subscription to annual
                if tenure_days >= 90 and active_subs > 0:
                    annual_saving = round(mrr * 12 * 0.15, 2)
                    recommendations.append(GeneratedRecommendation(
                        recommendation_type="annual_conversion",
                        reason="Customer demonstrates sustained monthly subscription commitment with positive tenure.",
                        priority=RecommendationPriority.LOW.value,
                        suggested_action="Present 15% discount incentive for switching from monthly billing to an annual pre-paid commitment.",
                        expected_benefit=f"Lock in ${round(mrr * 10.2, 2):,.2f} immediate cash flow while offering client ${annual_saving:,.2f} annual savings.",
                    ))

        # ── 4. Retention Discount for At-Risk Customers ───────────────────────
        if churn_risk_category == "high_risk" and active_subs > 0 and overdue_amt == 0:
            recommendations.append(GeneratedRecommendation(
                recommendation_type="retention_offer",
                reason="Customer health score has dropped into high churn risk territory due to declining usage or cancellation signals.",
                priority=RecommendationPriority.HIGH.value,
                suggested_action="Schedule executive check-in call and approve a temporary 20% loyalty retention credit for 3 billing cycles.",
                expected_benefit=f"Avert imminent account cancellation and protect ${mrr:,.2f} MRR.",
            ))

        # ── 5. Plan Optimization / Expansion for Growing Customers ────────────
        if revenue_trend == "growing" or (active_subs >= 2 and (health_score is not None and health_score >= 80)):
            recommendations.append(GeneratedRecommendation(
                recommendation_type="plan_optimization",
                reason="High engagement and growing usage indicate customer is a strong candidate for higher-tier features.",
                priority=RecommendationPriority.MEDIUM.value,
                suggested_action="Share product roadmap and showcase enterprise add-ons tailored to their active subscription footprint.",
                expected_benefit=f"Expand account value by an estimated 20-35% (${round(mrr * 0.25, 2):,.2f} incremental MRR).",
            ))

        # ── 6. Inactive / Win-back Follow-up ──────────────────────────────────
        if active_subs == 0 and closed_subs > 0:
            recommendations.append(GeneratedRecommendation(
                recommendation_type="relationship_followup",
                reason=f"Customer previously subscribed but currently has zero active services ({closed_subs} closed).",
                priority=RecommendationPriority.MEDIUM.value,
                suggested_action="Trigger win-back outreach survey to understand churn drivers and offer a 30-day reactivation trial.",
                expected_benefit="Re-engage churned account and restore historical relationship.",
            ))

        # ── 7. Default Check-in for Stable Customers if no urgent actions ─────
        if not recommendations and active_subs > 0:
            recommendations.append(GeneratedRecommendation(
                recommendation_type="relationship_followup",
                reason="Account is stable with no acute risk factors. Periodic check-in maintains customer satisfaction.",
                priority=RecommendationPriority.LOW.value,
                suggested_action="Send quarterly satisfaction pulse survey and confirm primary contact details.",
                expected_benefit="Maintain customer relationship warmth and identify emerging expansion opportunities.",
            ))

        return recommendations
