"""
REVORA – Customer Telemetry Provider.

Aggregates operational customer telemetry from database entities (Customer, CustomerActivity,
CustomerTelemetry) while strictly distinguishing between real database telemetry and labelled
demo telemetry.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer, CustomerActivity
from app.models.customer_intelligence import CustomerTelemetry


@dataclass
class CustomerBehaviouralMetrics:
    customer_id: int
    customer_code: str
    customer_name: str
    customer_email: str
    company_name: Optional[str]
    account_status: str
    registration_date: datetime
    tenure_days: int
    tenure_months: float

    # Subscription Behaviour
    active_subscriptions: int
    paused_subscriptions: int
    closed_subscriptions: int
    renewal_count: int
    upcoming_expirations: int
    days_to_expiration: Optional[int]
    avg_duration_days: Optional[float]
    has_auto_renew: bool

    # Payment Behaviour
    total_payments: int
    successful_payments: int
    failed_payments: int
    delayed_payments: int
    outstanding_invoices_amount: float
    overdue_invoices_count: int
    avg_payment_delay_days: Optional[float]
    days_since_last_payment: Optional[int]
    payment_success_rate: Optional[float]

    # Revenue Contribution
    monthly_recurring_revenue: float
    annual_recurring_revenue: float
    total_historical_revenue: float
    avg_subscription_value: float
    revenue_trend: str

    # Transparency metadata
    data_source: str            # "real_database" or "demo_telemetry"
    is_demo_data: bool          # True if simulated for development/demo
    is_data_sufficient: bool    # True if operational signals are present
    missing_data_fields: list[str]


class CustomerTelemetryProvider:
    """
    Service interface providing customer telemetry.
    Reuses existing Customer and CustomerActivity models.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_metrics_for_customer(self, customer: Customer) -> CustomerBehaviouralMetrics:
        now = datetime.now(timezone.utc)
        reg_date = customer.registration_date
        if reg_date.tzinfo is None:
            reg_date = reg_date.replace(tzinfo=timezone.utc)
        
        tenure_days = max(0, (now - reg_date).days)
        tenure_months = round(tenure_days / 30.4, 1)

        # Look for explicit CustomerTelemetry record
        telemetry = self.db.execute(
            select(CustomerTelemetry).where(CustomerTelemetry.customer_id == customer.id)
        ).scalars().first()

        if telemetry is not None:
            # We have an attached telemetry record
            total_pay = telemetry.total_payments
            succ_pay = telemetry.successful_payments
            success_rate = round(succ_pay / total_pay, 3) if total_pay > 0 else None
            mrr = telemetry.monthly_recurring_revenue

            has_sub_data = (telemetry.active_subscriptions + telemetry.paused_subscriptions + telemetry.closed_subscriptions) > 0
            has_pay_data = total_pay > 0
            is_sufficient = has_sub_data or has_pay_data

            missing: list[str] = []
            if not has_sub_data:
                missing.append("subscription_records")
            if not has_pay_data:
                missing.append("payment_history")

            return CustomerBehaviouralMetrics(
                customer_id=customer.id,
                customer_code=customer.customer_code,
                customer_name=customer.full_name,
                customer_email=customer.email,
                company_name=customer.company_name,
                account_status=customer.status.value if hasattr(customer.status, "value") else str(customer.status),
                registration_date=reg_date,
                tenure_days=tenure_days,
                tenure_months=tenure_months,
                active_subscriptions=telemetry.active_subscriptions,
                paused_subscriptions=telemetry.paused_subscriptions,
                closed_subscriptions=telemetry.closed_subscriptions,
                renewal_count=telemetry.renewal_count,
                upcoming_expirations=telemetry.upcoming_expirations,
                days_to_expiration=telemetry.days_to_expiration,
                avg_duration_days=telemetry.avg_duration_days,
                has_auto_renew=telemetry.has_auto_renew,
                total_payments=telemetry.total_payments,
                successful_payments=telemetry.successful_payments,
                failed_payments=telemetry.failed_payments,
                delayed_payments=telemetry.delayed_payments,
                outstanding_invoices_amount=telemetry.outstanding_invoices_amount,
                overdue_invoices_count=telemetry.overdue_invoices_count,
                avg_payment_delay_days=telemetry.avg_payment_delay_days,
                days_since_last_payment=telemetry.days_since_last_payment,
                payment_success_rate=success_rate,
                monthly_recurring_revenue=mrr,
                annual_recurring_revenue=round(mrr * 12, 2),
                total_historical_revenue=telemetry.total_historical_revenue,
                avg_subscription_value=telemetry.avg_subscription_value,
                revenue_trend=telemetry.revenue_trend,
                data_source=telemetry.data_source,
                is_demo_data=telemetry.is_demo_data,
                is_data_sufficient=is_sufficient,
                missing_data_fields=missing,
            )

        # Inspect real customer activities from DB
        activities = self.db.execute(
            select(CustomerActivity).where(CustomerActivity.customer_id == customer.id)
        ).scalars().all()

        active_subs = 0
        paused_subs = 0
        closed_subs = 0
        total_payments = 0
        successful_payments = 0
        failed_payments = 0
        overdue_invoices = 0
        renewal_count = 0

        for a in activities:
            ev = a.event_type.lower()
            if "subscription.created" in ev or "subscription.activated" in ev:
                active_subs += 1
            elif "subscription.paused" in ev:
                paused_subs += 1
                if active_subs > 0:
                    active_subs -= 1
            elif "subscription.cancelled" in ev or "subscription.closed" in ev:
                closed_subs += 1
                if active_subs > 0:
                    active_subs -= 1
            elif "subscription.renewed" in ev:
                renewal_count += 1
            elif "payment.received" in ev or "payment.succeeded" in ev:
                total_payments += 1
                successful_payments += 1
            elif "payment.failed" in ev:
                total_payments += 1
                failed_payments += 1
            elif "invoice.overdue" in ev:
                overdue_invoices += 1

        has_data = (active_subs + paused_subs + closed_subs + total_payments + overdue_invoices) > 0
        missing: list[str] = []
        if (active_subs + paused_subs + closed_subs) == 0:
            missing.append("subscription_records")
        if total_payments == 0:
            missing.append("payment_history")

        return CustomerBehaviouralMetrics(
            customer_id=customer.id,
            customer_code=customer.customer_code,
            customer_name=customer.full_name,
            customer_email=customer.email,
            company_name=customer.company_name,
            account_status=customer.status.value if hasattr(customer.status, "value") else str(customer.status),
            registration_date=reg_date,
            tenure_days=tenure_days,
            tenure_months=tenure_months,
            active_subscriptions=active_subs,
            paused_subscriptions=paused_subs,
            closed_subscriptions=closed_subs,
            renewal_count=renewal_count,
            upcoming_expirations=0,
            days_to_expiration=None,
            avg_duration_days=None,
            has_auto_renew=True,
            total_payments=total_payments,
            successful_payments=successful_payments,
            failed_payments=failed_payments,
            delayed_payments=0,
            outstanding_invoices_amount=0.0,
            overdue_invoices_count=overdue_invoices,
            avg_payment_delay_days=None,
            days_since_last_payment=None,
            payment_success_rate=(round(successful_payments / total_payments, 3) if total_payments > 0 else None),
            monthly_recurring_revenue=0.0,
            annual_recurring_revenue=0.0,
            total_historical_revenue=0.0,
            avg_subscription_value=0.0,
            revenue_trend="stable",
            data_source="real_database",
            is_demo_data=False,
            is_data_sufficient=has_data,
            missing_data_fields=missing,
        )

    def attach_demo_telemetry_profiles(self, customers: list[Customer]) -> None:
        """
        Creates labelled demo telemetry for a set of customers to showcase
        different health and churn states during parallel development.
        Explicitly marked with is_demo_data=True and data_source="demo_telemetry".
        """
        if not customers:
            return

        demo_profiles = [
            # Profile 1: Healthy Enterprise Account
            {
                "active_subscriptions": 3,
                "paused_subscriptions": 0,
                "closed_subscriptions": 0,
                "renewal_count": 4,
                "upcoming_expirations": 0,
                "days_to_expiration": 120,
                "avg_duration_days": 365.0,
                "has_auto_renew": True,
                "total_payments": 24,
                "successful_payments": 24,
                "failed_payments": 0,
                "delayed_payments": 0,
                "outstanding_invoices_amount": 0.0,
                "overdue_invoices_count": 0,
                "avg_payment_delay_days": 0.5,
                "days_since_last_payment": 8,
                "monthly_recurring_revenue": 1250.0,
                "total_historical_revenue": 18500.0,
                "avg_subscription_value": 416.67,
                "revenue_trend": "growing",
            },
            # Profile 2: High Churn Risk with Failed Payments & Overdue Invoices
            {
                "active_subscriptions": 1,
                "paused_subscriptions": 1,
                "closed_subscriptions": 1,
                "renewal_count": 1,
                "upcoming_expirations": 1,
                "days_to_expiration": 7,
                "avg_duration_days": 90.0,
                "has_auto_renew": False,
                "total_payments": 8,
                "successful_payments": 5,
                "failed_payments": 3,
                "delayed_payments": 4,
                "outstanding_invoices_amount": 620.0,
                "overdue_invoices_count": 2,
                "avg_payment_delay_days": 18.5,
                "days_since_last_payment": 45,
                "monthly_recurring_revenue": 310.0,
                "total_historical_revenue": 2170.0,
                "avg_subscription_value": 310.0,
                "revenue_trend": "declining",
            },
            # Profile 3: Needs Attention (Paused sub & slight payment delay)
            {
                "active_subscriptions": 1,
                "paused_subscriptions": 1,
                "closed_subscriptions": 0,
                "renewal_count": 2,
                "upcoming_expirations": 0,
                "days_to_expiration": 45,
                "avg_duration_days": 180.0,
                "has_auto_renew": True,
                "total_payments": 14,
                "successful_payments": 13,
                "failed_payments": 1,
                "delayed_payments": 2,
                "outstanding_invoices_amount": 140.0,
                "overdue_invoices_count": 1,
                "avg_payment_delay_days": 6.2,
                "days_since_last_payment": 20,
                "monthly_recurring_revenue": 280.0,
                "total_historical_revenue": 3920.0,
                "avg_subscription_value": 280.0,
                "revenue_trend": "stable",
            },
            # Profile 4: Growing Mid-Market Account
            {
                "active_subscriptions": 2,
                "paused_subscriptions": 0,
                "closed_subscriptions": 0,
                "renewal_count": 2,
                "upcoming_expirations": 0,
                "days_to_expiration": 90,
                "avg_duration_days": 210.0,
                "has_auto_renew": True,
                "total_payments": 16,
                "successful_payments": 16,
                "failed_payments": 0,
                "delayed_payments": 1,
                "outstanding_invoices_amount": 0.0,
                "overdue_invoices_count": 0,
                "avg_payment_delay_days": 1.2,
                "days_since_last_payment": 12,
                "monthly_recurring_revenue": 650.0,
                "total_historical_revenue": 7800.0,
                "avg_subscription_value": 325.0,
                "revenue_trend": "growing",
            },
            # Profile 5: Inactive / Cancelled Customer
            {
                "active_subscriptions": 0,
                "paused_subscriptions": 0,
                "closed_subscriptions": 2,
                "renewal_count": 1,
                "upcoming_expirations": 0,
                "days_to_expiration": None,
                "avg_duration_days": 120.0,
                "has_auto_renew": False,
                "total_payments": 6,
                "successful_payments": 6,
                "failed_payments": 0,
                "delayed_payments": 0,
                "outstanding_invoices_amount": 0.0,
                "overdue_invoices_count": 0,
                "avg_payment_delay_days": 2.0,
                "days_since_last_payment": 85,
                "monthly_recurring_revenue": 0.0,
                "total_historical_revenue": 1440.0,
                "avg_subscription_value": 0.0,
                "revenue_trend": "declining",
            },
        ]

        # Apply profile cyclically to customers who do not have telemetry yet
        for idx, customer in enumerate(customers):
            existing = self.db.execute(
                select(CustomerTelemetry).where(CustomerTelemetry.customer_id == customer.id)
            ).scalars().first()

            if existing is None:
                # Leave at least one customer without telemetry to test Insufficient Data state
                if idx == len(customers) - 1 and len(customers) > 2:
                    continue  # Keep as real DB customer with zero telemetry -> Insufficient Data

                profile = demo_profiles[idx % len(demo_profiles)]
                tel = CustomerTelemetry(
                    customer_id=customer.id,
                    data_source="demo_telemetry",
                    is_demo_data=True,
                    **profile,
                )
                self.db.add(tel)

        self.db.commit()
