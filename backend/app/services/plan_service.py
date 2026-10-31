"""
REVORA – Subscription Plan Service.
Business logic for plan management with RBAC enforcement.
"""

from __future__ import annotations

import math
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import (
    PlanCreateRequest, PlanDetailResponse, PlanListResponse,
    PlanResponse, PlanStatsResponse, PlanUpdateRequest,
)


class PlanService:

    def __init__(self, db: Session) -> None:
        self.db   = db
        self.repo = PlanRepository(db)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _validate_product_variant(self, product_id: int, variant_id: Optional[int]) -> None:
        product = self.repo.get_product(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found.")
        if not product.is_active:
            raise HTTPException(
                status_code=400,
                detail="Cannot create a plan for an inactive product.",
            )
        if variant_id is not None:
            variant = self.repo.get_variant(variant_id)
            if not variant:
                raise HTTPException(status_code=404, detail="Variant not found.")
            if variant.product_id != product_id:
                raise HTTPException(
                    status_code=400,
                    detail="Variant does not belong to the selected product.",
                )
            if not variant.is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot create a plan for an inactive variant.",
                )

    def _get_or_404(self, plan_id: int):
        plan = self.repo.get(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found.")
        return plan

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create_plan(self, data: PlanCreateRequest, actor: User) -> PlanDetailResponse:
        self._validate_product_variant(data.product_id, data.variant_id)
        if self.repo.name_exists(data.plan_name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A plan with this name already exists.",
            )
        plan = self.repo.create(data, created_by=actor.id)
        self.db.commit()
        self.db.refresh(plan)
        # Reload with relationships
        plan = self.repo.get(plan.id)
        return PlanDetailResponse.model_validate(plan)

    def list_plans(
        self,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        product_id: Optional[int] = None,
        billing_frequency: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
    ) -> PlanListResponse:
        plans, total = self.repo.list(
            page=page, page_size=page_size, search=search,
            product_id=product_id, billing_frequency=billing_frequency,
            status=status, sort_by=sort_by, sort_dir=sort_dir,
        )
        total_pages = math.ceil(total / page_size) if page_size > 0 else 0
        return PlanListResponse(
            plans=[PlanResponse.model_validate(p) for p in plans],
            total=total, page=page, page_size=page_size, total_pages=total_pages,
        )

    def get_plan(self, plan_id: int) -> PlanDetailResponse:
        plan = self._get_or_404(plan_id)
        return PlanDetailResponse.model_validate(plan)

    def update_plan(self, plan_id: int, data: PlanUpdateRequest, actor: User) -> PlanDetailResponse:
        plan = self._get_or_404(plan_id)
        if data.plan_name and self.repo.name_exists(data.plan_name, exclude_id=plan_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another plan with this name already exists.",
            )
        # If variant_id is being changed, validate it
        new_variant_id = data.variant_id if data.variant_id is not None else plan.variant_id
        if data.variant_id is not None:
            self._validate_product_variant(plan.product_id, new_variant_id)
        plan = self.repo.update(plan, data)
        self.db.commit()
        plan = self.repo.get(plan_id)
        return PlanDetailResponse.model_validate(plan)

    def archive_plan(self, plan_id: int, actor: User) -> PlanDetailResponse:
        plan = self._get_or_404(plan_id)
        if plan.status.value == "archived":
            raise HTTPException(status_code=400, detail="Plan is already archived.")
        plan = self.repo.archive(plan)
        self.db.commit()
        plan = self.repo.get(plan_id)
        return PlanDetailResponse.model_validate(plan)

    def get_stats(self) -> PlanStatsResponse:
        return PlanStatsResponse(**self.repo.stats())
