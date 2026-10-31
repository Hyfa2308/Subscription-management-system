"""
REVORA – Subscription Plan Repository.
All DB queries for SubscriptionPlan.
"""

from __future__ import annotations

import math
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.plan import SubscriptionPlan, BillingFrequency, PlanStatus
from app.models.product import Product, ProductVariant
from app.schemas.plan import PlanCreateRequest, PlanUpdateRequest


class PlanRepository:

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Lookups ───────────────────────────────────────────────────────────────

    def get_product(self, product_id: int) -> Optional[Product]:
        return self.db.get(Product, product_id)

    def get_variant(self, variant_id: int) -> Optional[ProductVariant]:
        return self.db.get(ProductVariant, variant_id)

    def name_exists(self, name: str, exclude_id: Optional[int] = None) -> bool:
        stmt = select(SubscriptionPlan.id).where(
            func.lower(SubscriptionPlan.plan_name) == name.lower().strip()
        )
        if exclude_id:
            stmt = stmt.where(SubscriptionPlan.id != exclude_id)
        return self.db.execute(stmt).first() is not None

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create(self, data: PlanCreateRequest, created_by: Optional[int] = None) -> SubscriptionPlan:
        plan = SubscriptionPlan(
            plan_name=data.plan_name,
            description=data.description,
            product_id=data.product_id,
            variant_id=data.variant_id,
            plan_price=data.plan_price,
            currency=data.currency,
            setup_fee=data.setup_fee,
            tax_percentage=data.tax_percentage,
            billing_frequency=BillingFrequency(data.billing_frequency),
            billing_interval=data.billing_interval,
            trial_period_days=data.trial_period_days,
            discount_allowed=data.discount_allowed,
            pause_allowed=data.pause_allowed,
            renewal_allowed=data.renewal_allowed,
            early_closure_allowed=data.early_closure_allowed,
            minimum_commitment_period=data.minimum_commitment_period,
            status=PlanStatus(data.status),
            created_by=created_by,
        )
        self.db.add(plan)
        self.db.flush()
        return plan

    def get(self, plan_id: int) -> Optional[SubscriptionPlan]:
        return (
            self.db.execute(
                select(SubscriptionPlan)
                .where(SubscriptionPlan.id == plan_id)
                .options(
                    selectinload(SubscriptionPlan.product),
                    selectinload(SubscriptionPlan.variant),
                )
            )
            .scalars().first()
        )

    def list(
        self,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        product_id: Optional[int] = None,
        billing_frequency: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
    ) -> tuple[list[SubscriptionPlan], int]:

        stmt = select(SubscriptionPlan)

        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    SubscriptionPlan.plan_name.ilike(q),
                    SubscriptionPlan.plan_code.ilike(q),
                )
            )
        if product_id:
            stmt = stmt.where(SubscriptionPlan.product_id == product_id)
        if billing_frequency:
            try:
                stmt = stmt.where(
                    SubscriptionPlan.billing_frequency == BillingFrequency(billing_frequency.lower())
                )
            except ValueError:
                pass
        if status:
            try:
                stmt = stmt.where(SubscriptionPlan.status == PlanStatus(status.lower()))
            except ValueError:
                pass

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total: int = self.db.execute(count_stmt).scalar_one()

        sort_col = getattr(SubscriptionPlan, sort_by, SubscriptionPlan.created_at)
        stmt = stmt.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        plans = list(self.db.execute(stmt).scalars().all())
        return plans, total

    def update(self, plan: SubscriptionPlan, data: PlanUpdateRequest) -> SubscriptionPlan:
        update_data = data.model_dump(exclude_unset=True)
        if "billing_frequency" in update_data and update_data["billing_frequency"]:
            update_data["billing_frequency"] = BillingFrequency(update_data["billing_frequency"])
        if "status" in update_data and update_data["status"]:
            update_data["status"] = PlanStatus(update_data["status"])
        for field, value in update_data.items():
            setattr(plan, field, value)
        self.db.flush()
        return plan

    def archive(self, plan: SubscriptionPlan) -> SubscriptionPlan:
        plan.status = PlanStatus.ARCHIVED
        self.db.flush()
        return plan

    def stats(self) -> dict:
        total    = self.db.execute(select(func.count(SubscriptionPlan.id))).scalar_one()
        active   = self.db.execute(select(func.count(SubscriptionPlan.id)).where(SubscriptionPlan.status == PlanStatus.ACTIVE)).scalar_one()
        inactive = self.db.execute(select(func.count(SubscriptionPlan.id)).where(SubscriptionPlan.status == PlanStatus.INACTIVE)).scalar_one()
        archived = self.db.execute(select(func.count(SubscriptionPlan.id)).where(SubscriptionPlan.status == PlanStatus.ARCHIVED)).scalar_one()

        # Most popular billing frequency
        freq_row = (
            self.db.execute(
                select(SubscriptionPlan.billing_frequency, func.count().label("cnt"))
                .group_by(SubscriptionPlan.billing_frequency)
                .order_by(func.count().desc())
                .limit(1)
            )
            .first()
        )
        most_popular = freq_row[0].value if freq_row else None

        return {
            "total": total,
            "active": active,
            "inactive": inactive,
            "archived": archived,
            "most_popular_frequency": most_popular,
        }
