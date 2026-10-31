"""
REVORA – Discount Repository.
All DB operations for discounts, redemptions, and validation queries.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.discount import (
    Discount, DiscountRedemption, DiscountStatus, DiscountType,
    DiscountApplicableTo, RedemptionStatus,
)
from app.schemas.discount import DiscountCreateRequest, DiscountUpdateRequest


class DiscountRepository:

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Lookups ───────────────────────────────────────────────────────────────

    def get(self, discount_id: int) -> Optional[Discount]:
        return self.db.get(Discount, discount_id)

    def get_by_code(self, code: str) -> Optional[Discount]:
        return self.db.execute(
            select(Discount).where(Discount.discount_code == code)
        ).scalars().first()

    def get_customer_redemption_count(self, discount_id: int, customer_id: int) -> int:
        return self.db.execute(
            select(func.count()).where(
                DiscountRedemption.discount_id == discount_id,
                DiscountRedemption.customer_id == customer_id,
                DiscountRedemption.status.in_(
                    [RedemptionStatus.RESERVED, RedemptionStatus.REDEEMED]
                ),
            )
        ).scalar_one()

    # ── Create ────────────────────────────────────────────────────────────────

    def create(self, data: DiscountCreateRequest, created_by: Optional[int] = None) -> Discount:
        d = Discount(
            discount_name=data.discount_name,
            description=data.description,
            discount_type=data.discount_type,
            discount_value=Decimal(str(data.discount_value)),
            currency=data.currency,
            maximum_discount_amount=Decimal(str(data.maximum_discount_amount)) if data.maximum_discount_amount else None,
            minimum_purchase_amount=Decimal(str(data.minimum_purchase_amount)) if data.minimum_purchase_amount else None,
            start_date=data.start_date,
            end_date=data.end_date,
            usage_limit=data.usage_limit,
            usage_limit_per_customer=data.usage_limit_per_customer,
            applicable_to=data.applicable_to,
            applicable_product_ids=data.applicable_product_ids,
            applicable_plan_ids=data.applicable_plan_ids,
            is_stackable=data.is_stackable,
            requires_coupon_code=data.requires_coupon_code,
            status=data.status,
            created_by=created_by,
        )
        # Custom code or auto-generated
        if data.discount_code:
            d.discount_code = data.discount_code
        self.db.add(d)
        self.db.flush()
        return d

    # ── Update ────────────────────────────────────────────────────────────────

    def update(self, discount: Discount, data: DiscountUpdateRequest) -> Discount:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(discount, field, value)
        self.db.flush()
        return discount

    def delete(self, discount: Discount) -> None:
        """Soft-archive instead of hard delete."""
        discount.status = DiscountStatus.ARCHIVED
        self.db.flush()

    # ── Expire stale discounts ────────────────────────────────────────────────

    def expire_stale(self) -> int:
        now = datetime.now(timezone.utc)
        stmt = select(Discount).where(
            Discount.status == DiscountStatus.ACTIVE,
            Discount.end_date.isnot(None),
            Discount.end_date < now,
        )
        updated = 0
        for d in self.db.execute(stmt).scalars().all():
            d.status = DiscountStatus.EXPIRED
            updated += 1
        if updated:
            self.db.flush()
        return updated

    # ── List ──────────────────────────────────────────────────────────────────

    def list(
        self,
        page: int = 1, page_size: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        discount_type: Optional[str] = None,
        sort_by: str = "created_at", sort_dir: str = "desc",
    ) -> tuple[list[Discount], int]:

        stmt = select(Discount)

        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(or_(
                Discount.discount_code.ilike(q),
                Discount.discount_name.ilike(q),
            ))
        if status:
            try:
                stmt = stmt.where(Discount.status == DiscountStatus(status.lower()))
            except ValueError:
                pass
        if discount_type:
            try:
                stmt = stmt.where(Discount.discount_type == DiscountType(discount_type.lower()))
            except ValueError:
                pass

        total = self.db.execute(
            select(func.count()).select_from(stmt.subquery())
        ).scalar_one()

        sort_col = getattr(Discount, sort_by, Discount.created_at)
        stmt = stmt.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        return list(self.db.execute(stmt).scalars().all()), total

    # ── Stats ─────────────────────────────────────────────────────────────────

    def stats(self) -> dict:
        self.expire_stale()
        rows = self.db.execute(
            select(Discount.status, func.count().label("cnt")).group_by(Discount.status)
        ).all()
        counts = {r[0].value: r[1] for r in rows}
        total_redemptions = self.db.execute(
            select(func.count()).where(DiscountRedemption.status == RedemptionStatus.REDEEMED)
        ).scalar_one()
        return {
            "total":             sum(counts.values()),
            "active":            counts.get("active",   0),
            "inactive":          counts.get("inactive", 0),
            "expired":           counts.get("expired",  0),
            "archived":          counts.get("archived", 0),
            "total_redemptions": total_redemptions,
        }

    # ── Redemptions ───────────────────────────────────────────────────────────

    def get_redemptions(self, discount_id: int) -> list[DiscountRedemption]:
        stmt = select(DiscountRedemption).where(
            DiscountRedemption.discount_id == discount_id
        ).order_by(DiscountRedemption.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def create_redemption(
        self, discount: Discount, customer_id: int, amount: Decimal,
        quotation_id=None, subscription_id=None, invoice_id=None,
    ) -> DiscountRedemption:
        r = DiscountRedemption(
            discount_id=discount.id,
            customer_id=customer_id,
            redemption_amount=amount,
            quotation_id=quotation_id,
            subscription_id=subscription_id,
            invoice_id=invoice_id,
            status=RedemptionStatus.RESERVED,
        )
        self.db.add(r)
        self.db.flush()
        return r

    def confirm_redemption(self, redemption: DiscountRedemption) -> DiscountRedemption:
        redemption.status     = RedemptionStatus.REDEEMED
        redemption.redeemed_at = datetime.now(timezone.utc)
        redemption.discount.usage_count += 1
        self.db.flush()
        return redemption

    def reverse_redemption(self, redemption: DiscountRedemption) -> DiscountRedemption:
        if redemption.status == RedemptionStatus.REDEEMED:
            redemption.discount.usage_count = max(0, redemption.discount.usage_count - 1)
        redemption.status = RedemptionStatus.REVERSED
        self.db.flush()
        return redemption

    def get_redemption(self, redemption_id: int) -> Optional[DiscountRedemption]:
        return self.db.get(DiscountRedemption, redemption_id)
