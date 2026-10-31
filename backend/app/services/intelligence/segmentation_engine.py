"""
REVORA – Customer Segmentation Engine.

Automatic rule-based customer segmentation calculated from available database metrics.
Customers can qualify for multiple segments simultaneously.

Segments:
  1. High Value Customers: MRR >= $500 OR total revenue >= $2,000
  2. Loyal Customers:      Tenure >= 180 days AND active status AND health score >= 70
  3. New Customers:        Registration within last 60 days
  4. At-Risk Customers:    Churn risk == 'high_risk' OR health_score < 50 OR overdue invoices > 0 OR failed payments >= 2
  5. Inactive Customers:   Status == 'inactive' OR (active_subscriptions == 0 AND tenure > 30)
  6. Growing Customers:    Revenue trend == 'growing' OR active_subscriptions >= 2
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class SegmentDefinition:
    segment_id: str
    name: str
    description: str
    criteria_summary: str


AVAILABLE_SEGMENTS = [
    SegmentDefinition(
        segment_id="high_value",
        name="High Value Customers",
        description="Customers contributing substantial recurring or lifetime revenue.",
        criteria_summary="MRR >= $500.00 or lifetime revenue >= $2,000.00",
    ),
    SegmentDefinition(
        segment_id="loyal",
        name="Loyal Customers",
        description="Long-standing customers with proven account stability and strong health.",
        criteria_summary="Account tenure >= 180 days, active status, and health score >= 70",
    ),
    SegmentDefinition(
        segment_id="new",
        name="New Customers",
        description="Recently onboarded customers in their initial adoption phase.",
        criteria_summary="Registered within the last 60 days",
    ),
    SegmentDefinition(
        segment_id="at_risk",
        name="At-Risk Customers",
        description="Accounts exhibiting acute churn indicators, payment friction, or declining health.",
        criteria_summary="Churn risk 'High', health score < 50, overdue invoice balance, or >= 2 failed payments",
    ),
    SegmentDefinition(
        segment_id="inactive",
        name="Inactive Customers",
        description="Customers without active subscriptions or flagged as inactive.",
        criteria_summary="Account status is inactive or zero active subscriptions with past tenure",
    ),
    SegmentDefinition(
        segment_id="growing",
        name="Growing Customers",
        description="Accounts expanding service usage, recurring revenue, or plan tiers.",
        criteria_summary="Revenue trend 'growing' or >= 2 concurrent active subscriptions",
    ),
]


class CustomerSegmentationEngine:

    @staticmethod
    def classify(
        metrics: Any,
        health_score: Optional[float] = None,
        churn_risk_category: Optional[str] = None,
    ) -> list[str]:
        """
        Evaluate customer metrics and return the list of matching segment IDs.
        """
        segments: list[str] = []

        mrr = getattr(metrics, "monthly_recurring_revenue", 0.0) or 0.0
        total_rev = getattr(metrics, "total_historical_revenue", 0.0) or 0.0
        tenure_days = getattr(metrics, "tenure_days", 0) or 0
        account_status = (getattr(metrics, "account_status", "active") or "active").lower()
        active_subs = getattr(metrics, "active_subscriptions", 0) or 0
        overdue_amt = getattr(metrics, "outstanding_invoices_amount", 0.0) or 0.0
        failed_payments = getattr(metrics, "failed_payments", 0) or 0
        revenue_trend = (getattr(metrics, "revenue_trend", "stable") or "stable").lower()

        # 1. High Value
        if mrr >= 500.0 or total_rev >= 2000.0:
            segments.append("high_value")

        # 2. Loyal
        if tenure_days >= 180 and account_status == "active" and (health_score is not None and health_score >= 70.0):
            segments.append("loyal")

        # 3. New
        if tenure_days <= 60:
            segments.append("new")

        # 4. At-Risk
        is_at_risk = (
            churn_risk_category == "high_risk"
            or (health_score is not None and health_score < 50.0)
            or overdue_amt > 0.0
            or failed_payments >= 2
        )
        if is_at_risk:
            segments.append("at_risk")

        # 5. Inactive
        if account_status == "inactive" or (active_subs == 0 and tenure_days > 14):
            segments.append("inactive")

        # 6. Growing
        if revenue_trend == "growing" or active_subs >= 2:
            segments.append("growing")

        return segments
