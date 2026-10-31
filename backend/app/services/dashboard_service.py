"""
REVORA – Dashboard Analytics Service.

Aggregates real data from existing models using efficient GROUP BY queries.
No external dependencies on payment tables (which are a future module).
All monetary amounts returned as strings to preserve Decimal precision.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select, case, and_, extract
from sqlalchemy.orm import Session

from app.models.customer import Customer, CustomerStatus
from app.models.subscription import Subscription, SubscriptionStatus, SubscriptionActivity
from app.models.invoice import Invoice, InvoiceStatus
from app.models.quotation import Quotation, QuotationStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


class DashboardService:

    def __init__(self, db: Session) -> None:
        self.db = db

    # ─────────────────────────────────────────────────────────────────────────
    # A. Customer Metrics
    # ─────────────────────────────────────────────────────────────────────────

    def customer_metrics(self, days: int = 30) -> dict:
        since = _now() - timedelta(days=days)
        prev_since = since - timedelta(days=days)

        rows = self.db.execute(
            select(Customer.status, func.count().label("cnt"))
            .group_by(Customer.status)
        ).all()
        by_status = {r[0].value: r[1] for r in rows}

        total   = sum(by_status.values())
        active  = by_status.get("active",   0)
        inactive= by_status.get("inactive", 0) + by_status.get("churned", 0) + by_status.get("suspended", 0)

        new_this = self.db.execute(
            select(func.count()).where(Customer.created_at >= since)
        ).scalar_one()
        new_prev = self.db.execute(
            select(func.count()).where(
                Customer.created_at >= prev_since,
                Customer.created_at < since,
            )
        ).scalar_one()

        growth = 0.0
        if new_prev > 0:
            growth = round((new_this - new_prev) / new_prev * 100, 1)
        elif new_this > 0:
            growth = 100.0

        return {
            "total":            total,
            "active":           active,
            "inactive":         inactive,
            "new_customers":    new_this,
            "growth_rate_pct":  growth,
            "period_days":      days,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # B. Subscription Metrics
    # ─────────────────────────────────────────────────────────────────────────

    def subscription_metrics(self) -> dict:
        rows = self.db.execute(
            select(Subscription.status, func.count().label("cnt"))
            .group_by(Subscription.status)
        ).all()
        by_status = {r[0].value: r[1] for r in rows}

        soon = _now() + timedelta(days=30)
        expiring_soon = self.db.execute(
            select(func.count()).where(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.end_date.isnot(None),
                Subscription.end_date <= soon,
                Subscription.end_date >= _now(),
            )
        ).scalar_one()

        return {
            "total":           sum(by_status.values()),
            "active":          by_status.get("active",    0),
            "paused":          by_status.get("paused",    0),
            "pending":         by_status.get("pending",   0),
            "expired":         by_status.get("expired",   0),
            "cancelled":       by_status.get("cancelled", 0),
            "expiring_soon":   expiring_soon,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # C. Revenue Metrics (MRR / ARR from active subscription unit_prices)
    # ─────────────────────────────────────────────────────────────────────────

    def revenue_metrics(self) -> dict:
        # MRR = normalised monthly value of all ACTIVE subscriptions
        active_subs = self.db.execute(
            select(Subscription.billing_frequency, Subscription.unit_price, Subscription.quantity)
            .where(Subscription.status == SubscriptionStatus.ACTIVE)
        ).all()

        MONTHLY_FACTOR = {
            "monthly":    Decimal("1"),
            "quarterly":  Decimal("1") / Decimal("3"),
            "semi_annual":Decimal("1") / Decimal("6"),
            "annual":     Decimal("1") / Decimal("12"),
            "weekly":     Decimal("4.33"),
            "daily":      Decimal("30"),
        }
        mrr = Decimal("0")
        for row in active_subs:
            freq   = str(row[0]).lower()
            price  = Decimal(str(row[1]))
            qty    = Decimal(str(row[2])) if row[2] else Decimal("1")
            factor = MONTHLY_FACTOR.get(freq, Decimal("1"))
            mrr   += price * qty * factor

        arr = mrr * Decimal("12")

        # Revenue collected = sum of amount_paid on all invoices
        collected = self.db.execute(
            select(func.coalesce(func.sum(Invoice.amount_paid), 0))
        ).scalar_one() or Decimal("0")

        # Outstanding = sum of amount_due on unpaid/partial/overdue invoices
        outstanding = self.db.execute(
            select(func.coalesce(func.sum(Invoice.total_amount - Invoice.amount_paid), 0))
            .where(Invoice.status.in_([
                InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE,
            ]))
        ).scalar_one() or Decimal("0")

        return {
            "mrr":              str(round(mrr, 2)),
            "arr":              str(round(arr, 2)),
            "collected":        str(round(Decimal(str(collected)), 2)),
            "outstanding":      str(round(Decimal(str(outstanding)), 2)),
            "revenue_growth_pct": 0.0,   # requires time-series payment data
        }

    # ─────────────────────────────────────────────────────────────────────────
    # D. Invoice Metrics
    # ─────────────────────────────────────────────────────────────────────────

    def invoice_metrics(self) -> dict:
        rows = self.db.execute(
            select(Invoice.status, func.count().label("cnt"),
                   func.coalesce(func.sum(Invoice.total_amount - Invoice.amount_paid), 0).label("outstanding"))
            .group_by(Invoice.status)
        ).all()

        by_status    = {}
        outstanding  = Decimal("0")
        for r in rows:
            by_status[r[0].value] = r[1]
            if r[0].value in ("unpaid", "partially_paid", "overdue"):
                outstanding += Decimal(str(r[2]))

        return {
            "total":            sum(by_status.values()),
            "paid":             by_status.get("paid",            0),
            "unpaid":           by_status.get("unpaid",          0),
            "partially_paid":   by_status.get("partially_paid",  0),
            "overdue":          by_status.get("overdue",         0),
            "draft":            by_status.get("draft",           0),
            "cancelled":        by_status.get("cancelled",       0),
            "outstanding_amount": str(round(outstanding, 2)),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # E. Payment Metrics (placeholder – Payments module not yet implemented)
    # ─────────────────────────────────────────────────────────────────────────

    def payment_metrics(self) -> dict:
        return {
            "available":            False,
            "note":                 "Payment module not yet implemented.",
            "total_successful":     0,
            "failed":               0,
            "pending":              0,
            "total_amount_collected": "0.00",
        }

    # ─────────────────────────────────────────────────────────────────────────
    # F. Quotation Metrics
    # ─────────────────────────────────────────────────────────────────────────

    def quotation_metrics(self) -> dict:
        rows = self.db.execute(
            select(Quotation.status, func.count().label("cnt"))
            .group_by(Quotation.status)
        ).all()
        by_status = {r[0].value: r[1] for r in rows}
        total     = sum(by_status.values())
        sent      = by_status.get("sent",     0)
        accepted  = by_status.get("accepted", 0)
        eligible  = sent + accepted + by_status.get("rejected", 0) + by_status.get("expired", 0)
        conversion = round(accepted / eligible * 100, 1) if eligible > 0 else 0.0

        return {
            "total":            total,
            "draft":            by_status.get("draft",     0),
            "sent":             sent,
            "accepted":         accepted,
            "rejected":         by_status.get("rejected",  0),
            "expired":          by_status.get("expired",   0),
            "cancelled":        by_status.get("cancelled", 0),
            "conversion_rate_pct": conversion,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Composite Overview
    # ─────────────────────────────────────────────────────────────────────────

    def overview(self, days: int = 30) -> dict:
        return {
            "customers":    self.customer_metrics(days),
            "subscriptions": self.subscription_metrics(),
            "revenue":      self.revenue_metrics(),
            "invoices":     self.invoice_metrics(),
            "payments":     self.payment_metrics(),
            "quotations":   self.quotation_metrics(),
            "generated_at": _now().isoformat(),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Trend: Revenue (MRR proxy from invoices per month)
    # ─────────────────────────────────────────────────────────────────────────

    def revenue_trend(self, months: int = 6) -> list[dict]:
        result = []
        now = _now()
        for i in range(months - 1, -1, -1):
            # Compute month start/end
            target = now - timedelta(days=i * 30)
            m_start = target.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if m_start.month == 12:
                m_end = m_start.replace(year=m_start.year + 1, month=1)
            else:
                m_end = m_start.replace(month=m_start.month + 1)

            collected = self.db.execute(
                select(func.coalesce(func.sum(Invoice.amount_paid), 0))
                .where(
                    Invoice.invoice_date >= m_start,
                    Invoice.invoice_date < m_end,
                )
            ).scalar_one() or 0

            total_invoiced = self.db.execute(
                select(func.coalesce(func.sum(Invoice.total_amount), 0))
                .where(
                    Invoice.invoice_date >= m_start,
                    Invoice.invoice_date < m_end,
                )
            ).scalar_one() or 0

            result.append({
                "period":         m_start.strftime("%b %Y"),
                "period_start":   m_start.isoformat(),
                "collected":      float(round(Decimal(str(collected)),      2)),
                "total_invoiced": float(round(Decimal(str(total_invoiced)), 2)),
                "outstanding":    float(round(Decimal(str(total_invoiced)) - Decimal(str(collected)), 2)),
            })
        return result

    # ─────────────────────────────────────────────────────────────────────────
    # Trend: Subscriptions per month
    # ─────────────────────────────────────────────────────────────────────────

    def subscription_trend(self, months: int = 6) -> list[dict]:
        result = []
        now = _now()
        for i in range(months - 1, -1, -1):
            target  = now - timedelta(days=i * 30)
            m_start = target.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if m_start.month == 12:
                m_end = m_start.replace(year=m_start.year + 1, month=1)
            else:
                m_end = m_start.replace(month=m_start.month + 1)

            new_subs = self.db.execute(
                select(func.count())
                .where(
                    Subscription.created_at >= m_start,
                    Subscription.created_at < m_end,
                )
            ).scalar_one()

            result.append({
                "period":       m_start.strftime("%b %Y"),
                "period_start": m_start.isoformat(),
                "new":          new_subs,
            })
        return result

    # ─────────────────────────────────────────────────────────────────────────
    # Trend: Customer growth
    # ─────────────────────────────────────────────────────────────────────────

    def customer_trend(self, months: int = 6) -> list[dict]:
        result = []
        now = _now()
        for i in range(months - 1, -1, -1):
            target  = now - timedelta(days=i * 30)
            m_start = target.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if m_start.month == 12:
                m_end = m_start.replace(year=m_start.year + 1, month=1)
            else:
                m_end = m_start.replace(month=m_start.month + 1)

            new_custs = self.db.execute(
                select(func.count())
                .where(
                    Customer.created_at >= m_start,
                    Customer.created_at < m_end,
                )
            ).scalar_one()

            result.append({
                "period":       m_start.strftime("%b %Y"),
                "period_start": m_start.isoformat(),
                "new":          new_custs,
            })
        return result

    # ─────────────────────────────────────────────────────────────────────────
    # Recent Activities (from SubscriptionActivity)
    # ─────────────────────────────────────────────────────────────────────────

    def recent_activities(self, limit: int = 15) -> list[dict]:
        rows = self.db.execute(
            select(
                SubscriptionActivity.id,
                SubscriptionActivity.action,
                SubscriptionActivity.details,
                SubscriptionActivity.created_at,
                SubscriptionActivity.actor_id,
                Subscription.subscription_number,
                Subscription.customer_id,
                Customer.full_name,
            )
            .join(Subscription, SubscriptionActivity.subscription_id == Subscription.id)
            .join(Customer, Subscription.customer_id == Customer.id)
            .order_by(SubscriptionActivity.created_at.desc())
            .limit(limit)
        ).all()

        return [
            {
                "id":                  r[0],
                "action":              r[1],
                "description":         r[2] or f"Subscription {r[5]}: {r[1]}",
                "created_at":          r[3].isoformat() if r[3] else None,
                "actor_id":            r[4],
                "subscription_number": r[5],
                "customer_id":         r[6],
                "customer_name":       r[7],
            }
            for r in rows
        ]

    # ─────────────────────────────────────────────────────────────────────────
    # Upcoming Renewals
    # ─────────────────────────────────────────────────────────────────────────

    def upcoming_renewals(self, days: int = 30, limit: int = 10) -> list[dict]:
        cutoff = _now() + timedelta(days=days)
        rows = self.db.execute(
            select(
                Subscription.id,
                Subscription.subscription_number,
                Subscription.next_billing_date,
                Subscription.billing_frequency,
                Subscription.unit_price,
                Subscription.currency,
                Customer.id.label("customer_id"),
                Customer.full_name,
            )
            .join(Customer, Subscription.customer_id == Customer.id)
            .where(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.next_billing_date.isnot(None),
                Subscription.next_billing_date <= cutoff,
                Subscription.next_billing_date >= _now(),
            )
            .order_by(Subscription.next_billing_date.asc())
            .limit(limit)
        ).all()

        now = _now()
        return [
            {
                "subscription_id":     r[0],
                "subscription_number": r[1],
                "next_billing_date":   r[2].isoformat() if r[2] else None,
                "billing_frequency":   r[3],
                "expected_amount":     str(round(Decimal(str(r[4])), 2)),
                "currency":            r[5],
                "customer_id":         r[6],
                "customer_name":       r[7],
                "days_until_due":      (r[2].replace(tzinfo=timezone.utc) - now).days if r[2] else None,
            }
            for r in rows
        ]

    # ─────────────────────────────────────────────────────────────────────────
    # Business Alerts
    # ─────────────────────────────────────────────────────────────────────────

    def alerts(self) -> list[dict]:
        alerts = []
        now = _now()

        # Overdue invoices
        overdue_count = self.db.execute(
            select(func.count()).where(Invoice.status == InvoiceStatus.OVERDUE)
        ).scalar_one()
        if overdue_count > 0:
            overdue_amount = self.db.execute(
                select(func.coalesce(func.sum(Invoice.total_amount - Invoice.amount_paid), 0))
                .where(Invoice.status == InvoiceStatus.OVERDUE)
            ).scalar_one() or 0
            alerts.append({
                "severity":    "high",
                "type":        "overdue_invoices",
                "title":       f"{overdue_count} Overdue Invoice(s)",
                "description": f"Total outstanding: {round(Decimal(str(overdue_amount)), 2)}",
                "action":      "Review overdue invoices",
                "link":        "/invoices?status=overdue",
            })

        # Expiring subscriptions (within 7 days)
        expiring_7 = self.db.execute(
            select(func.count()).where(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.end_date.isnot(None),
                Subscription.end_date <= now + timedelta(days=7),
                Subscription.end_date >= now,
            )
        ).scalar_one()
        if expiring_7 > 0:
            alerts.append({
                "severity":    "medium",
                "type":        "expiring_subscriptions",
                "title":       f"{expiring_7} Subscription(s) Expiring in 7 Days",
                "description": "These subscriptions need renewal attention.",
                "action":      "Review expiring subscriptions",
                "link":        "/subscriptions?status=active",
            })

        # High-value unpaid invoices (amount_due > 10000)
        high_value = self.db.execute(
            select(func.count()).where(
                Invoice.status.in_([InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE]),
                (Invoice.total_amount - Invoice.amount_paid) > 10000,
            )
        ).scalar_one()
        if high_value > 0:
            alerts.append({
                "severity":    "medium",
                "type":        "high_value_unpaid",
                "title":       f"{high_value} High-Value Unpaid Invoice(s)",
                "description": "Invoices with outstanding balance > 10,000.",
                "action":      "Follow up on high-value invoices",
                "link":        "/invoices?status=unpaid",
            })

        # Upcoming billing (next 3 days)
        billing_soon = self.db.execute(
            select(func.count()).where(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.next_billing_date.isnot(None),
                Subscription.next_billing_date <= now + timedelta(days=3),
                Subscription.next_billing_date >= now,
            )
        ).scalar_one()
        if billing_soon > 0:
            alerts.append({
                "severity":    "low",
                "type":        "billing_due_soon",
                "title":       f"{billing_soon} Billing(s) Due in 3 Days",
                "description": "Consider running the billing engine.",
                "action":      "Run billing",
                "link":        "/invoices",
            })

        return alerts
