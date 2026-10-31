"""
REVORA – Explainable Customer Health Scoring Engine.

Formula Methodology:
Health Score is a normalized 0-100 score computed across 5 weighted pillars:
  1. Payment Reliability    (Weight: 0.30)
  2. Subscription Stability  (Weight: 0.25)
  3. Renewal Behaviour      (Weight: 0.15)
  4. Customer Tenure        (Weight: 0.15)
  5. Revenue Consistency    (Weight: 0.15)
  Sum of weights = 1.00 (100%)

Each pillar produces an individual score between 0 and 100.
If certain operational data is unavailable, the weights are dynamically re-allocated
among the available signals. If fewer than 2 core signals are available, the customer
is classified as 'Insufficient Data' with a null score rather than generating a misleading score.

Classification thresholds:
  - Healthy:        75 – 100
  - Needs Attention: 50 – 74
  - At Risk:          0 – 49
  - Insufficient Data: Critical data unavailable
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from app.models.customer_intelligence import HealthCategory


@dataclass
class HealthScoreConfig:
    weight_payment:    float = 0.30
    weight_stability:  float = 0.25
    weight_renewal:    float = 0.15
    weight_tenure:     float = 0.15
    weight_revenue:    float = 0.15
    formula_version:   str   = "1.0.0"

    def as_dict(self) -> dict[str, float]:
        return {
            "payment_reliability":    self.weight_payment,
            "subscription_stability":  self.weight_stability,
            "renewal_behaviour":      self.weight_renewal,
            "customer_tenure":         self.weight_tenure,
            "revenue_consistency":    self.weight_revenue,
        }


@dataclass
class HealthScoreResult:
    score: Optional[float]
    category: str
    payment_reliability_score: Optional[float]
    subscription_stability_score: Optional[float]
    renewal_behaviour_score: Optional[float]
    customer_tenure_score: Optional[float]
    revenue_consistency_score: Optional[float]
    positive_factors: list[str] = field(default_factory=list)
    negative_factors: list[str] = field(default_factory=list)
    formula_version: str = "1.0.0"
    weights_used: dict[str, float] = field(default_factory=dict)
    is_data_sufficient: bool = True
    missing_data_fields: list[str] = field(default_factory=list)
    calculated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class HealthScoringEngine:

    def __init__(self, config: Optional[HealthScoreConfig] = None) -> None:
        self.config = config or HealthScoreConfig()

    def calculate(self, metrics: Any) -> HealthScoreResult:
        """
        Calculate an explainable customer health score from behavioural metrics.
        metrics can be a CustomerTelemetry or a dict containing relevant fields.
        """
        now = datetime.now(timezone.utc)
        missing_fields: list[str] = []

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

        if not has_payment_data:
            missing_fields.append("payment_history")
        if not has_subscription_data:
            missing_fields.append("subscription_records")

        # Insufficient data condition: brand new or empty billing record
        is_sufficient = getattr(metrics, "is_data_sufficient", True)
        if (not has_payment_data and not has_subscription_data) or not is_sufficient:
            return HealthScoreResult(
                score=None,
                category=HealthCategory.INSUFFICIENT_DATA.value,
                payment_reliability_score=None,
                subscription_stability_score=None,
                renewal_behaviour_score=None,
                customer_tenure_score=self._calculate_tenure_score(metrics)[0],
                revenue_consistency_score=None,
                positive_factors=["Customer profile created and active in system."],
                negative_factors=["Insufficient billing and payment telemetry recorded to assess health."],
                formula_version=self.config.formula_version,
                weights_used={},
                is_data_sufficient=False,
                missing_data_fields=missing_fields or ["payment_history", "subscription_records"],
                calculated_at=now,
            )

        # ── 1. Payment Reliability (0-100) ────────────────────────────────────
        payment_score, pos_pay, neg_pay = self._calculate_payment_score(metrics)

        # ── 2. Subscription Stability (0-100) ─────────────────────────────────
        stability_score, pos_sub, neg_sub = self._calculate_stability_score(metrics)

        # ── 3. Renewal Behaviour (0-100) ──────────────────────────────────────
        renewal_score, pos_ren, neg_ren = self._calculate_renewal_score(metrics)

        # ── 4. Customer Tenure (0-100) ────────────────────────────────────────
        tenure_score, pos_ten, neg_ten = self._calculate_tenure_score(metrics)

        # ── 5. Revenue Consistency (0-100) ────────────────────────────────────
        revenue_score, pos_rev, neg_rev = self._calculate_revenue_score(metrics)

        # Combine explanations
        positive_factors = pos_pay + pos_sub + pos_ren + pos_ten + pos_rev
        negative_factors = neg_pay + neg_sub + neg_ren + neg_ten + neg_rev

        # Weighted calculation with dynamic re-normalization if any sub-score is None
        subscores: dict[str, tuple[Optional[float], float]] = {
            "payment_reliability":    (payment_score, self.config.weight_payment),
            "subscription_stability":  (stability_score, self.config.weight_stability),
            "renewal_behaviour":      (renewal_score, self.config.weight_renewal),
            "customer_tenure":         (tenure_score, self.config.weight_tenure),
            "revenue_consistency":    (revenue_score, self.config.weight_revenue),
        }

        active_weight_sum = sum(w for score, w in subscores.values() if score is not None)
        if active_weight_sum <= 0:
            return HealthScoreResult(
                score=None,
                category=HealthCategory.INSUFFICIENT_DATA.value,
                payment_reliability_score=payment_score,
                subscription_stability_score=stability_score,
                renewal_behaviour_score=renewal_score,
                customer_tenure_score=tenure_score,
                revenue_consistency_score=revenue_score,
                positive_factors=positive_factors,
                negative_factors=negative_factors,
                formula_version=self.config.formula_version,
                weights_used={},
                is_data_sufficient=False,
                missing_data_fields=missing_fields,
                calculated_at=now,
            )

        # Normalized weights
        weights_used: dict[str, float] = {}
        weighted_score = 0.0
        for name, (score, w) in subscores.items():
            if score is not None:
                norm_w = round(w / active_weight_sum, 4)
                weights_used[name] = norm_w
                weighted_score += score * norm_w

        final_score = round(max(0.0, min(100.0, weighted_score)), 1)

        # Determine category
        if final_score >= 75.0:
            category = HealthCategory.HEALTHY.value
        elif final_score >= 50.0:
            category = HealthCategory.NEEDS_ATTENTION.value
        else:
            category = HealthCategory.AT_RISK.value

        return HealthScoreResult(
            score=final_score,
            category=category,
            payment_reliability_score=round(payment_score, 1) if payment_score is not None else None,
            subscription_stability_score=round(stability_score, 1) if stability_score is not None else None,
            renewal_behaviour_score=round(renewal_score, 1) if renewal_score is not None else None,
            customer_tenure_score=round(tenure_score, 1) if tenure_score is not None else None,
            revenue_consistency_score=round(revenue_score, 1) if revenue_score is not None else None,
            positive_factors=positive_factors,
            negative_factors=negative_factors,
            formula_version=self.config.formula_version,
            weights_used=weights_used,
            is_data_sufficient=True,
            missing_data_fields=missing_fields,
            calculated_at=now,
        )

    # ── Sub-score calculation helpers ─────────────────────────────────────────

    def _calculate_payment_score(self, m: Any) -> tuple[Optional[float], list[str], list[str]]:
        total = getattr(m, "total_payments", 0) or 0
        successful = getattr(m, "successful_payments", 0) or 0
        failed = getattr(m, "failed_payments", 0) or 0
        overdue_amt = getattr(m, "outstanding_invoices_amount", 0.0) or 0.0
        overdue_count = getattr(m, "overdue_invoices_count", 0) or 0
        avg_delay = getattr(m, "avg_payment_delay_days", None)

        if total == 0 and overdue_amt == 0:
            return None, [], ["No payment history available."]

        pos: list[str] = []
        neg: list[str] = []

        # Success rate component (0-60 points)
        success_rate = (successful / total) if total > 0 else 0.0
        rate_points = success_rate * 60.0

        if success_rate >= 0.98:
            pos.append(f"Impeccable payment success rate of {round(success_rate * 100)}%.")
        elif success_rate < 0.85:
            neg.append(f"Sub-optimal payment success rate of {round(success_rate * 100)}% ({failed} failed transactions).")

        # Overdue invoice penalty (0-25 points deducted)
        overdue_points = 25.0
        if overdue_amt > 0 or overdue_count > 0:
            overdue_points = max(0.0, 25.0 - (overdue_count * 15.0))
            neg.append(f"${overdue_amt:,.2f} outstanding in {overdue_count} overdue invoice(s).")
        else:
            pos.append("All invoices fully paid with zero overdue balance.")

        # Payment delay factor (0-15 points)
        delay_points = 15.0
        if avg_delay is not None:
            if avg_delay <= 1.0:
                pos.append("Prompt invoice settlement within 24 hours.")
            elif avg_delay > 10.0:
                delay_points = max(0.0, 15.0 - (avg_delay - 5.0))
                neg.append(f"Average payment delay of {round(avg_delay, 1)} days.")
            elif avg_delay > 4.0:
                delay_points = 10.0

        score = max(0.0, min(100.0, rate_points + overdue_points + delay_points))
        return score, pos, neg

    def _calculate_stability_score(self, m: Any) -> tuple[Optional[float], list[str], list[str]]:
        active = getattr(m, "active_subscriptions", 0) or 0
        paused = getattr(m, "paused_subscriptions", 0) or 0
        closed = getattr(m, "closed_subscriptions", 0) or 0
        total = active + paused + closed

        pos: list[str] = []
        neg: list[str] = []

        if total == 0:
            return None, [], ["No subscriptions on record."]

        score = 80.0

        if active >= 2:
            score += 20.0
            pos.append(f"Multiple active subscriptions ({active} concurrent services).")
        elif active == 1:
            score += 15.0
            pos.append("Healthy active subscription.")
        elif active == 0:
            score -= 50.0
            neg.append("Zero currently active subscriptions.")

        if paused > 0:
            score -= (paused * 25.0)
            neg.append(f"{paused} subscription(s) currently in paused state.")

        if closed > 0 and total > 1:
            cancel_rate = closed / total
            if cancel_rate > 0.4:
                score -= 20.0
                neg.append(f"High historical cancellation rate ({closed} closed).")

        return max(0.0, min(100.0, score)), pos, neg

    def _calculate_renewal_score(self, m: Any) -> tuple[Optional[float], list[str], list[str]]:
        renewals = getattr(m, "renewal_count", 0) or 0
        upcoming = getattr(m, "upcoming_expirations", 0) or 0
        days_to_exp = getattr(m, "days_to_expiration", None)
        auto_renew = getattr(m, "has_auto_renew", True)

        pos: list[str] = []
        neg: list[str] = []

        score = 75.0

        if renewals >= 3:
            score += 25.0
            pos.append(f"Strong contract renewal track record ({renewals} successful renewals).")
        elif renewals >= 1:
            score += 15.0
            pos.append(f"{renewals} successful subscription renewal(s) logged.")

        if auto_renew:
            score += 5.0
            pos.append("Automated subscription renewal enabled.")
        else:
            score -= 20.0
            neg.append("Auto-renewal disabled on active subscription.")

        if days_to_exp is not None and days_to_exp <= 14:
            if not auto_renew:
                score -= 30.0
                neg.append(f"Subscription expires in {days_to_exp} days without auto-renew.")
            else:
                neg.append(f"Upcoming renewal in {days_to_exp} days.")

        return max(0.0, min(100.0, score)), pos, neg

    def _calculate_tenure_score(self, m: Any) -> tuple[float, list[str], list[str]]:
        tenure_days = getattr(m, "tenure_days", 0) or 0

        pos: list[str] = []
        neg: list[str] = []

        if tenure_days >= 365:
            score = 100.0
            pos.append(f"Long-term relationship with {round(tenure_days / 30.4, 1)} months customer tenure.")
        elif tenure_days >= 180:
            score = 85.0
            pos.append(f"Established customer with {round(tenure_days / 30.4, 1)} months tenure.")
        elif tenure_days >= 90:
            score = 70.0
            pos.append(f"{round(tenure_days / 30.4, 1)} months account maturity.")
        elif tenure_days >= 30:
            score = 55.0
            pos.append("Customer in initial 90-day onboarding window.")
        else:
            score = 50.0
            pos.append(f"Newly registered customer ({tenure_days} days).")

        return score, pos, neg

    def _calculate_revenue_score(self, m: Any) -> tuple[Optional[float], list[str], list[str]]:
        trend = (getattr(m, "revenue_trend", "stable") or "stable").lower()
        mrr = getattr(m, "monthly_recurring_revenue", 0.0) or 0.0

        pos: list[str] = []
        neg: list[str] = []

        if mrr <= 0.0:
            return 30.0, [], ["No current recurring revenue generated."]

        if trend == "growing":
            score = 100.0
            pos.append(f"Expanding account revenue (MRR: ${mrr:,.2f}, growing trend).")
        elif trend == "stable":
            score = 85.0
            pos.append(f"Consistent recurring revenue ($ {mrr:,.2f} MRR).")
        elif trend == "declining":
            score = 40.0
            neg.append("Declining recurring revenue trend detected over recent quarters.")
        else:
            score = 70.0

        return score, pos, neg
