"""
REVORA – Subscription Service.
Business logic: RBAC, lifecycle transitions, plan permission guards, snapshots.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.subscription import (
    ActivityAction, SubscriptionStatus, SUBSCRIPTION_TRANSITIONS,
)
from app.models.user import User, UserRole
from app.repositories.subscription_repository import SubscriptionRepository
from app.schemas.subscription import (
    SubscriptionCreateRequest, SubscriptionDetailResponse,
    SubscriptionListResponse, SubscriptionResponse,
    SubscriptionStatsResponse, SubscriptionUpdateRequest,
    PauseRequest, CloseRequest, CancelRequest,
)


class SubscriptionService:

    def __init__(self, db: Session) -> None:
        self.db   = db
        self.repo = SubscriptionRepository(db)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_or_404(self, sub_id: int):
        sub = self.repo.get(sub_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found.")
        return sub

    def _assert_transition(self, sub, target: SubscriptionStatus) -> None:
        allowed = SUBSCRIPTION_TRANSITIONS.get(sub.status, [])
        if target not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from '{sub.status.value}' to '{target.value}'.",
            )

    def _get_plan(self, plan_id: int):
        from app.models.plan import SubscriptionPlan, PlanStatus
        from sqlalchemy import select
        plan = self.db.get(SubscriptionPlan, plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found.")
        if plan.status != PlanStatus.ACTIVE:
            raise HTTPException(status_code=400, detail="Subscription plan is not active.")
        return plan

    def _get_customer(self, customer_id: int):
        from app.models.customer import CustomerStatus
        c = self.repo.get_customer(customer_id)
        if not c:
            raise HTTPException(status_code=404, detail="Customer not found.")
        if c.status == CustomerStatus.ARCHIVED:
            raise HTTPException(status_code=400, detail="Cannot create subscription for an archived customer.")
        return c

    def _get_product(self, product_id: Optional[int]):
        if not product_id:
            return None
        from app.models.product import Product
        p = self.db.get(Product, product_id)
        return p

    def _validate_quotation(self, quotation_id: int):
        from app.models.quotation import Quotation, QuotationStatus
        q = self.db.get(Quotation, quotation_id)
        if not q:
            raise HTTPException(status_code=404, detail="Quotation not found.")
        if q.status != QuotationStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="Only accepted quotations can be used to create subscriptions.")
        return q

    # ── Create ────────────────────────────────────────────────────────────────

    def create(self, data: SubscriptionCreateRequest, actor: User) -> SubscriptionDetailResponse:
        customer = self._get_customer(data.customer_id)
        plan     = self._get_plan(data.plan_id)
        product  = self._get_product(plan.product_id)

        if data.quotation_id:
            self._validate_quotation(data.quotation_id)

        # Variant validation
        if data.variant_id:
            from app.models.product import ProductVariant
            variant = self.db.get(ProductVariant, data.variant_id)
            if not variant or variant.product_id != plan.product_id:
                raise HTTPException(status_code=400, detail="Variant does not belong to the plan's product.")

        sub = self.repo.create(data, plan=plan, product=product, created_by=actor.id)
        self.repo.log_activity(
            sub, ActivityAction.CREATED.value, actor_id=actor.id,
            details=f"Subscription created for plan '{plan.plan_name}'.",
        )
        self.db.commit()
        return SubscriptionDetailResponse.model_validate(self.repo.get(sub.id))

    # ── List ──────────────────────────────────────────────────────────────────

    def list_subscriptions(
        self, page: int = 1, page_size: int = 10,
        search: Optional[str] = None, status: Optional[str] = None,
        customer_id: Optional[int] = None, billing_frequency: Optional[str] = None,
        sort_by: str = "created_at", sort_dir: str = "desc",
    ) -> SubscriptionListResponse:
        subs, total = self.repo.list(
            page=page, page_size=page_size, search=search, status=status,
            customer_id=customer_id, billing_frequency=billing_frequency,
            sort_by=sort_by, sort_dir=sort_dir,
        )
        total_pages = math.ceil(total / page_size) if page_size else 0
        return SubscriptionListResponse(
            subscriptions=[SubscriptionResponse.model_validate(s) for s in subs],
            total=total, page=page, page_size=page_size, total_pages=total_pages,
        )

    def get(self, sub_id: int) -> SubscriptionDetailResponse:
        return SubscriptionDetailResponse.model_validate(self._get_or_404(sub_id))

    def update(self, sub_id: int, data: SubscriptionUpdateRequest, actor: User) -> SubscriptionDetailResponse:
        sub = self._get_or_404(sub_id)
        if sub.status not in (SubscriptionStatus.DRAFT, SubscriptionStatus.PENDING, SubscriptionStatus.ACTIVE):
            raise HTTPException(status_code=400, detail="Cannot update a subscription in its current status.")
        sub = self.repo.update(sub, data)
        self.repo.log_activity(sub, ActivityAction.UPDATED.value, actor_id=actor.id, details="Subscription configuration updated.")
        self.db.commit()
        return SubscriptionDetailResponse.model_validate(self.repo.get(sub_id))

    def get_stats(self) -> SubscriptionStatsResponse:
        return SubscriptionStatsResponse(**self.repo.stats())

    # ── Lifecycle transitions ─────────────────────────────────────────────────

    def activate(self, sub_id: int, actor: User) -> SubscriptionDetailResponse:
        sub = self._get_or_404(sub_id)
        # Allow: draft→pending then pending→active, or pending→active directly
        if sub.status == SubscriptionStatus.DRAFT:
            self._assert_transition(sub, SubscriptionStatus.PENDING)
            self.repo.set_status(sub, SubscriptionStatus.PENDING)
            self.repo.log_activity(sub, ActivityAction.PENDING.value, actor_id=actor.id, details="Moved to pending.")
            self._assert_transition(sub, SubscriptionStatus.ACTIVE)
        else:
            self._assert_transition(sub, SubscriptionStatus.ACTIVE)

        self.repo.set_status(sub, SubscriptionStatus.ACTIVE)
        self.repo.log_activity(sub, ActivityAction.ACTIVATED.value, actor_id=actor.id, details="Subscription activated.")
        self.db.commit()
        return SubscriptionDetailResponse.model_validate(self.repo.get(sub_id))

    def pause(self, sub_id: int, data: PauseRequest, actor: User) -> SubscriptionDetailResponse:
        sub = self._get_or_404(sub_id)
        self._assert_transition(sub, SubscriptionStatus.PAUSED)
        if not sub.snap_pause_allowed:
            raise HTTPException(status_code=400, detail="This subscription's plan does not allow pausing.")
        self.repo.set_status(sub, SubscriptionStatus.PAUSED, pause_reason=data.reason)
        self.repo.log_activity(sub, ActivityAction.PAUSED.value, actor_id=actor.id, details=f"Paused. Reason: {data.reason}")
        self.db.commit()
        return SubscriptionDetailResponse.model_validate(self.repo.get(sub_id))

    def resume(self, sub_id: int, actor: User) -> SubscriptionDetailResponse:
        sub = self._get_or_404(sub_id)
        self._assert_transition(sub, SubscriptionStatus.ACTIVE)
        self.repo.set_status(sub, SubscriptionStatus.ACTIVE, pause_reason=None)
        self.repo.log_activity(sub, ActivityAction.RESUMED.value, actor_id=actor.id, details="Subscription resumed from pause.")
        self.db.commit()
        return SubscriptionDetailResponse.model_validate(self.repo.get(sub_id))

    def renew(self, sub_id: int, actor: User) -> SubscriptionDetailResponse:
        sub = self._get_or_404(sub_id)
        if sub.status != SubscriptionStatus.ACTIVE:
            raise HTTPException(status_code=400, detail="Only active subscriptions can be renewed.")
        if not sub.snap_renewal_allowed:
            raise HTTPException(status_code=400, detail="This subscription's plan does not allow renewal.")
        # Advance next billing date
        new_billing = SubscriptionRepository._calc_next_billing(
            sub.next_billing_date or datetime.now(timezone.utc),
            sub.billing_frequency, sub.billing_interval,
        )
        sub.next_billing_date = new_billing
        self.db.flush()
        self.repo.log_activity(sub, ActivityAction.RENEWED.value, actor_id=actor.id,
                               details=f"Renewed. Next billing: {new_billing.date()}.")
        self.db.commit()
        return SubscriptionDetailResponse.model_validate(self.repo.get(sub_id))

    def close(self, sub_id: int, data: CloseRequest, actor: User) -> SubscriptionDetailResponse:
        sub = self._get_or_404(sub_id)
        self._assert_transition(sub, SubscriptionStatus.CLOSED)
        if not sub.snap_early_closure_allowed and sub.status == SubscriptionStatus.ACTIVE:
            if actor.role not in (UserRole.ADMIN,):
                raise HTTPException(status_code=403, detail="Early closure is not allowed on this plan. Only admins can override.")
        self.repo.set_status(sub, SubscriptionStatus.CLOSED, closure_reason=data.reason)
        self.repo.log_activity(sub, ActivityAction.CLOSED.value, actor_id=actor.id, details=f"Closed. Reason: {data.reason}")
        self.db.commit()
        return SubscriptionDetailResponse.model_validate(self.repo.get(sub_id))

    def cancel(self, sub_id: int, data: CancelRequest, actor: User) -> SubscriptionDetailResponse:
        sub = self._get_or_404(sub_id)
        self._assert_transition(sub, SubscriptionStatus.CANCELLED)
        self.repo.set_status(sub, SubscriptionStatus.CANCELLED, closure_reason=data.reason)
        self.repo.log_activity(sub, ActivityAction.CANCELLED.value, actor_id=actor.id, details=f"Cancelled. Reason: {data.reason}")
        self.db.commit()
        return SubscriptionDetailResponse.model_validate(self.repo.get(sub_id))
