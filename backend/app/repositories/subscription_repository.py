"""
REVORA – Subscription Repository.
All DB operations: create, read, list, update, activity logging.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.customer import Customer
from app.models.subscription import (
    Subscription, SubscriptionActivity, SubscriptionStatus,
)
from app.schemas.subscription import (
    SubscriptionCreateRequest, SubscriptionUpdateRequest,
)


class SubscriptionRepository:

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Lookup ────────────────────────────────────────────────────────────────

    def get(self, sub_id: int) -> Optional[Subscription]:
        return self.db.execute(
            select(Subscription)
            .where(Subscription.id == sub_id)
            .options(
                selectinload(Subscription.customer),
                selectinload(Subscription.plan),
                selectinload(Subscription.activities),
            )
        ).scalars().first()

    def get_by_number(self, number: str) -> Optional[Subscription]:
        return self.db.execute(
            select(Subscription).where(Subscription.subscription_number == number)
        ).scalars().first()

    def get_customer(self, cid: int):
        return self.db.get(Customer, cid)

    # ── Create ────────────────────────────────────────────────────────────────

    def create(
        self,
        data: SubscriptionCreateRequest,
        plan,            # SubscriptionPlan ORM object (for snapshot)
        product=None,    # Product ORM object (optional)
        created_by: Optional[int] = None,
    ) -> Subscription:
        # ── Price snapshot calculation ────────────────────────────────────────
        # Use variant price if available, else plan_price
        if data.variant_id and product:
            variant = self.db.get(__import__("app.models.product", fromlist=["ProductVariant"]).ProductVariant, data.variant_id)
            unit_price = Decimal(str(variant.final_price)) if variant else Decimal(str(plan.plan_price))
        else:
            unit_price = Decimal(str(plan.plan_price))

        qty           = Decimal(str(data.quantity))
        tax_pct       = Decimal(str(plan.tax_percentage))
        gross         = unit_price * qty
        tax_amt       = gross * (tax_pct / Decimal("100"))
        total         = gross + tax_amt

        # ── Next billing date ─────────────────────────────────────────────────
        next_billing = self._calc_next_billing(data.start_date, plan.billing_frequency, plan.billing_interval)

        sub = Subscription(
            customer_id=data.customer_id,
            plan_id=plan.id,
            product_id=product.id if product else plan.product_id,
            variant_id=data.variant_id,
            quotation_id=data.quotation_id,
            start_date=data.start_date,
            end_date=data.end_date,
            next_billing_date=next_billing,
            billing_frequency=plan.billing_frequency.value if hasattr(plan.billing_frequency, "value") else str(plan.billing_frequency),
            billing_interval=plan.billing_interval,
            currency=plan.currency,
            unit_price=unit_price,
            quantity=qty,
            discount_amount=Decimal("0"),
            tax_amount=tax_amt,
            total_amount=total,
            status=SubscriptionStatus.DRAFT,
            auto_renew=data.auto_renew,
            # Snapshot plan permissions
            snap_pause_allowed=plan.pause_allowed,
            snap_renewal_allowed=plan.renewal_allowed,
            snap_early_closure_allowed=plan.early_closure_allowed,
            snap_discount_allowed=plan.discount_allowed,
            snap_plan_name=plan.plan_name,
            snap_product_name=product.product_name if product else None,
            created_by=created_by,
        )
        self.db.add(sub)
        self.db.flush()
        return sub

    # ── Update ────────────────────────────────────────────────────────────────

    def update(self, sub: Subscription, data: SubscriptionUpdateRequest) -> Subscription:
        if data.end_date   is not None: sub.end_date   = data.end_date
        if data.quantity   is not None:
            sub.quantity = Decimal(str(data.quantity))
            self._recalc(sub)
        if data.auto_renew is not None: sub.auto_renew = data.auto_renew
        self.db.flush()
        return sub

    def _recalc(self, sub: Subscription) -> None:
        gross     = sub.unit_price * sub.quantity
        tax_pct   = Decimal("0")  # keep existing tax_amount ratio if known
        # Derive tax_pct from existing values if possible
        after_disc = gross - sub.discount_amount
        if gross > 0 and sub.tax_amount > 0:
            tax_pct = (sub.tax_amount / (gross - sub.discount_amount)) * 100
        tax_amt   = after_disc * (tax_pct / Decimal("100"))
        sub.tax_amount   = tax_amt
        sub.total_amount = after_disc + tax_amt

    def set_status(self, sub: Subscription, status: SubscriptionStatus, **kwargs) -> Subscription:
        sub.status = status
        for k, v in kwargs.items():
            setattr(sub, k, v)
        self.db.flush()
        return sub

    # ── Activity log ──────────────────────────────────────────────────────────

    def log_activity(
        self,
        sub: Subscription,
        action: str,
        actor_id: Optional[int] = None,
        details: Optional[str]  = None,
    ) -> SubscriptionActivity:
        act = SubscriptionActivity(
            subscription_id=sub.id,
            actor_id=actor_id,
            action=action,
            details=details,
        )
        self.db.add(act)
        self.db.flush()
        return act

    # ── List ──────────────────────────────────────────────────────────────────

    def list(
        self,
        page: int = 1, page_size: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        customer_id: Optional[int] = None,
        billing_frequency: Optional[str] = None,
        sort_by: str = "created_at", sort_dir: str = "desc",
    ) -> tuple[list[Subscription], int]:

        stmt = select(Subscription)

        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.outerjoin(Customer, Subscription.customer_id == Customer.id).where(
                or_(
                    Subscription.subscription_number.ilike(q),
                    Customer.full_name.ilike(q),
                    Customer.company_name.ilike(q),
                )
            )
        if status:
            try:
                stmt = stmt.where(Subscription.status == SubscriptionStatus(status.lower()))
            except ValueError:
                pass
        if customer_id:
            stmt = stmt.where(Subscription.customer_id == customer_id)
        if billing_frequency:
            stmt = stmt.where(Subscription.billing_frequency == billing_frequency)

        total = self.db.execute(
            select(func.count()).select_from(stmt.subquery())
        ).scalar_one()

        sort_col = getattr(Subscription, sort_by, Subscription.created_at)
        stmt = stmt.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        return list(self.db.execute(stmt).scalars().all()), total

    # ── Stats ─────────────────────────────────────────────────────────────────

    def stats(self) -> dict:
        rows = self.db.execute(
            select(Subscription.status, func.count().label("cnt"))
            .group_by(Subscription.status)
        ).all()
        counts = {r[0].value: r[1] for r in rows}

        # Count expiring within 30 days
        now     = datetime.now(timezone.utc)
        in_30   = now + timedelta(days=30)
        expiring = self.db.execute(
            select(func.count()).where(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.end_date.isnot(None),
                Subscription.end_date <= in_30,
                Subscription.end_date >= now,
            )
        ).scalar_one()

        total = sum(counts.values())
        return {
            "total":         total,
            "draft":         counts.get("draft",     0),
            "pending":       counts.get("pending",   0),
            "active":        counts.get("active",    0),
            "paused":        counts.get("paused",    0),
            "expired":       counts.get("expired",   0),
            "closed":        counts.get("closed",    0),
            "cancelled":     counts.get("cancelled", 0),
            "expiring_soon": expiring,
        }

    # ── Helper ────────────────────────────────────────────────────────────────

    @staticmethod
    def _calc_next_billing(start: datetime, frequency: str, interval: int) -> datetime:
        freq = str(frequency).lower() if hasattr(frequency, "lower") else frequency.value.lower()  # type: ignore
        delta_map = {
            "daily":       timedelta(days=interval),
            "weekly":      timedelta(weeks=interval),
            "monthly":     timedelta(days=30 * interval),
            "quarterly":   timedelta(days=90 * interval),
            "half_yearly": timedelta(days=180 * interval),
            "yearly":      timedelta(days=365 * interval),
        }
        delta = delta_map.get(freq, timedelta(days=30))
        result = start + delta
        # Preserve timezone info
        if start.tzinfo and not result.tzinfo:
            result = result.replace(tzinfo=start.tzinfo)
        return result
