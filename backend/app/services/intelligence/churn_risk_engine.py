"""
REVORA – Churn Risk Prediction Engine.

Transparent, rule-based churn risk scoring engine with structured explainability.
Designed with an abstract protocol so that a trained machine-learning model (e.g. XGBoost / Random Forest)
can replace or ensemble with the rule engine in the future without changing the API contract.

Risk Categories:
  - Low Risk:    0 – 34
  - Medium Risk: 35 – 69
  - High Risk:   70 – 100
  - Insufficient Data: Critical signals missing
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional, Protocol, runtime_checkable

from app.models.customer_intelligence import ChurnRiskCategory


@dataclass
class ChurnFactor:
    factor: str
    severity: str    # "high", "medium", "low"
    impact: float    # points added to churn risk score
    description: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "factor": self.factor,
            "severity": self.severity,
            "impact": self.impact,
            "description": self.description,
        }


@dataclass
class ChurnAssessmentResult:
    risk_score: Optional[float]
    risk_category: str
    contributing_factors: list[ChurnFactor] = field(default_factory=list)
    explanation: str = ""
    recommended_action: str = ""
    engine_version: str = "rule_based_v1"
    assessment_date: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@runtime_checkable
class ChurnScoringEngineProtocol(Protocol):
    """Protocol allowing machine-learning or rule-based implementations."""
    def assess(self, customer_id: int, metrics: Any) -> ChurnAssessmentResult:
        ...


class RuleBasedChurnEngine:
    """
    Transparent rule-based churn prediction engine.
    Applies empirical subscription intelligence heuristics to quantify churn risk.
    """

    def __init__(self, version: str = "rule_based_v1") -> None:
        self.version = version

    def assess(self, customer_id: int, metrics: Any) -> ChurnAssessmentResult:
        now = datetime.now(timezone.utc)

        # Check sufficiency: if customer has no subscriptions and no payments, data is insufficient
        total_payments = getattr(metrics, "total_payments", None)
        active_subscriptions = getattr(metrics, "active_subscriptions", None)
        total_subscriptions = (
            (active_subscriptions or 0)
            + (getattr(metrics, "paused_subscriptions", 0) or 0)
            + (getattr(metrics, "closed_subscriptions", 0) or 0)
        )

        has_payment_data = total_payments is not None and total_payments > 0
        has_subscription_data = total_subscriptions > 0
        is_sufficient = getattr(metrics, "is_data_sufficient", True)

        if (not has_payment_data and not has_subscription_data) or not is_sufficient:
            return ChurnAssessmentResult(
                risk_score=None,
                risk_category=ChurnRiskCategory.INSUFFICIENT_DATA.value,
                contributing_factors=[],
                explanation="Insufficient billing and payment telemetry recorded to assess churn risk.",
                recommended_action="Monitor customer onboarding and collect initial subscription telemetry.",
                engine_version=self.version,
                assessment_date=now,
            )

        # Baseline churn risk for active customer
        base_risk = 10.0
        risk_score = base_risk
        factors: list[ChurnFactor] = []

        # ── Indicator 1: Repeated Failed Payments ──────────────────────────────
        failed_payments = getattr(metrics, "failed_payments", 0) or 0
        total_payments = getattr(metrics, "total_payments", 0) or 0
        if failed_payments >= 3:
            impact = 35.0
            risk_score += impact
            factors.append(ChurnFactor(
                factor="Repeated Failed Payments",
                severity="high",
                impact=impact,
                description=f"{failed_payments} failed payment attempts indicate severe payment friction or card expiration.",
            ))
        elif failed_payments >= 1:
            impact = 18.0
            risk_score += impact
            factors.append(ChurnFactor(
                factor="Recent Payment Failure",
                severity="medium",
                impact=impact,
                description=f"{failed_payments} failed payment recorded. Requires dunning follow-up.",
            ))

        # ── Indicator 2: Overdue Invoices ──────────────────────────────────────
        overdue_amt = getattr(metrics, "outstanding_invoices_amount", 0.0) or 0.0
        overdue_count = getattr(metrics, "overdue_invoices_count", 0) or 0
        if overdue_amt > 0 or overdue_count > 0:
            if overdue_count >= 2 or overdue_amt >= 500:
                impact = 35.0
                severity = "high"
            else:
                impact = 22.0
                severity = "medium"
            risk_score += impact
            factors.append(ChurnFactor(
                factor="Overdue Invoices",
                severity=severity,
                impact=impact,
                description=f"${overdue_amt:,.2f} outstanding balance across {overdue_count} overdue invoice(s).",
            ))

        # ── Indicator 3: Subscription Pauses ───────────────────────────────────
        paused_subs = getattr(metrics, "paused_subscriptions", 0) or 0
        if paused_subs > 0:
            impact = 25.0
            risk_score += impact
            factors.append(ChurnFactor(
                factor="Paused Subscriptions",
                severity="high",
                impact=impact,
                description=f"{paused_subs} active subscription(s) currently paused by customer; high leading churn indicator.",
            ))

        # ── Indicator 4: Upcoming Expiry without Renewal ───────────────────────
        days_to_exp = getattr(metrics, "days_to_expiration", None)
        has_auto_renew = getattr(metrics, "has_auto_renew", True)
        if days_to_exp is not None and days_to_exp <= 14:
            if not has_auto_renew:
                impact = 25.0
                risk_score += impact
                factors.append(ChurnFactor(
                    factor="Imminent Expiry Without Auto-Renew",
                    severity="high",
                    impact=impact,
                    description=f"Subscription expires in {days_to_exp} days with auto-renew disabled.",
                ))
            else:
                impact = 8.0
                risk_score += impact
                factors.append(ChurnFactor(
                    factor="Upcoming Renewal Window",
                    severity="low",
                    impact=impact,
                    description=f"Subscription renewing in {days_to_exp} days.",
                ))

        # ── Indicator 5: Previous Cancellations ────────────────────────────────
        closed_subs = getattr(metrics, "closed_subscriptions", 0) or 0
        active_subs = getattr(metrics, "active_subscriptions", 0) or 0
        if closed_subs > 0:
            if active_subs == 0:
                impact = 40.0
                risk_score += impact
                factors.append(ChurnFactor(
                    factor="No Active Subscriptions",
                    severity="high",
                    impact=impact,
                    description=f"Customer previously cancelled {closed_subs} subscription(s) and has zero active subscriptions.",
                ))
            else:
                impact = 12.0
                risk_score += impact
                factors.append(ChurnFactor(
                    factor="Historical Subscription Cancellation",
                    severity="medium",
                    impact=impact,
                    description=f"Account has {closed_subs} closed or cancelled subscription in history.",
                ))

        # ── Indicator 6: Declining Recurring Revenue ───────────────────────────
        revenue_trend = (getattr(metrics, "revenue_trend", "stable") or "stable").lower()
        if revenue_trend == "declining":
            impact = 20.0
            risk_score += impact
            factors.append(ChurnFactor(
                factor="Declining Recurring Revenue",
                severity="high",
                impact=impact,
                description="Contraction in monthly recurring revenue over recent billing cycles.",
            ))

        # ── Indicator 7: Long Periods Without Successful Payments ─────────────
        days_since_payment = getattr(metrics, "days_since_last_payment", None)
        if days_since_payment is not None and days_since_payment > 60:
            impact = 20.0
            risk_score += impact
            factors.append(ChurnFactor(
                factor="Payment Inactivity",
                severity="medium",
                impact=impact,
                description=f"No successful payment transactions logged in {days_since_payment} days.",
            ))

        # ── Mitigating Factors (Protective Signals) ────────────────────────────
        tenure_days = getattr(metrics, "tenure_days", 0) or 0
        if tenure_days >= 365 and risk_score > base_risk:
            mitigation = 10.0
            risk_score -= mitigation
            factors.append(ChurnFactor(
                factor="Protective: Long-term Account Loyalty",
                severity="low",
                impact=-mitigation,
                description=f"Over 1 year of customer tenure reduces likelihood of abrupt churn (-{mitigation} pts).",
            ))

        if active_subs >= 2:
            mitigation = 8.0
            risk_score -= mitigation
            factors.append(ChurnFactor(
                factor="Protective: Multi-Service Sticky Customer",
                severity="low",
                impact=-mitigation,
                description=f"{active_subs} active subscriptions provide diversification against complete churn (-{mitigation} pts).",
            ))

        # Normalize score between 0 and 100
        final_score = round(max(0.0, min(100.0, risk_score)), 1)

        # Classify risk category
        if final_score >= 70.0:
            category = ChurnRiskCategory.HIGH_RISK.value
        elif final_score >= 35.0:
            category = ChurnRiskCategory.MEDIUM_RISK.value
        else:
            category = ChurnRiskCategory.LOW_RISK.value

        # Generate recommended action based on primary risk factor
        recommended_action = self._determine_recommended_action(factors, final_score, metrics)
        explanation = self._generate_explanation(final_score, category, factors)

        return ChurnAssessmentResult(
            risk_score=final_score,
            risk_category=category,
            contributing_factors=factors,
            explanation=explanation,
            recommended_action=recommended_action,
            engine_version=self.version,
            assessment_date=now,
        )

    def _determine_recommended_action(
        self, factors: list[ChurnFactor], risk_score: float, metrics: Any
    ) -> str:
        factor_names = [f.factor for f in factors]

        if "Overdue Invoices" in factor_names or "Repeated Failed Payments" in factor_names:
            return "Trigger payment dunning retry sequence & schedule billing contact call."
        if "Paused Subscriptions" in factor_names:
            return "Follow up with customer regarding paused services and offer plan optimization."
        if "Imminent Expiry Without Auto-Renew" in factor_names:
            return "Send proactive renewal reminder and offer 15% annual commitment incentive."
        if "Declining Recurring Revenue" in factor_names:
            return "Conduct executive customer health review to assess satisfaction and address gaps."
        if "No Active Subscriptions" in factor_names:
            return "Enroll in win-back campaign with tailored discount on former plan."
        if risk_score >= 70.0:
            return "Assign dedicated customer success specialist for urgent retention intervention."
        if risk_score >= 35.0:
            return "Schedule periodic relationship check-in and share product adoption tips."
        return "Maintain regular quarterly check-ins and promote annual plan upgrade."

    def _generate_explanation(
        self, score: float, category: str, factors: list[ChurnFactor]
    ) -> str:
        if category == ChurnRiskCategory.HIGH_RISK.value:
            lead = f"High churn risk ({score}/100) triggered by "
            reasons = [f.description for f in factors if f.impact > 0][:2]
            return lead + " and ".join(reasons) if reasons else f"High churn risk ({score}/100) based on accumulated risk signals."
        elif category == ChurnRiskCategory.MEDIUM_RISK.value:
            lead = f"Moderate churn risk ({score}/100). "
            reasons = [f.description for f in factors if f.impact > 0][:2]
            return lead + " ".join(reasons) if reasons else f"Moderate churn risk ({score}/100) requires proactive monitoring."
        else:
            return f"Low churn risk ({score}/100). Customer demonstrates healthy operational patterns with consistent subscription engagement."
