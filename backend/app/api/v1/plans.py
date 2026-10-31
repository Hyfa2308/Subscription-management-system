"""
REVORA – Subscription Plan API endpoints.
All under /api/v1/plans. Admin + Staff only.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin_staff
from app.database.session import get_db
from app.models.user import User
from app.schemas.plan import (
    PlanCreateRequest, PlanDetailResponse, PlanListResponse,
    PlanResponse, PlanStatsResponse, PlanUpdateRequest,
)
from app.services.plan_service import PlanService

router = APIRouter(tags=["Subscription Plans"])


def get_service(db: Session = Depends(get_db)) -> PlanService:
    return PlanService(db)


# ── Stats (before /{id} to avoid route collision) ─────────────────────────────

@router.get("/stats", response_model=PlanStatsResponse, summary="Plan statistics")
def get_stats(
    _: User = Depends(require_admin_staff),
    service: PlanService = Depends(get_service),
):
    return service.get_stats()


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=PlanListResponse, summary="List subscription plans")
def list_plans(
    page:              int           = Query(1,    ge=1),
    limit:             int           = Query(10,   ge=1, le=100),
    search:            Optional[str] = Query(None),
    product_id:        Optional[int] = Query(None),
    billing_frequency: Optional[str] = Query(None),
    status:            Optional[str] = Query(None),
    sort_by:           str           = Query("created_at"),
    sort_dir:          str           = Query("desc"),
    _: User = Depends(require_admin_staff),
    service: PlanService = Depends(get_service),
):
    return service.list_plans(
        page=page, page_size=limit, search=search,
        product_id=product_id, billing_frequency=billing_frequency,
        status=status, sort_by=sort_by, sort_dir=sort_dir,
    )


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=PlanDetailResponse, status_code=status.HTTP_201_CREATED, summary="Create plan")
def create_plan(
    data:    PlanCreateRequest,
    actor:   User = Depends(require_admin_staff),
    service: PlanService = Depends(get_service),
):
    return service.create_plan(data, actor=actor)


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{plan_id}", response_model=PlanDetailResponse, summary="Plan details")
def get_plan(
    plan_id: int,
    _: User = Depends(require_admin_staff),
    service: PlanService = Depends(get_service),
):
    return service.get_plan(plan_id)


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{plan_id}", response_model=PlanDetailResponse, summary="Update plan")
def update_plan(
    plan_id: int,
    data:    PlanUpdateRequest,
    actor:   User = Depends(require_admin_staff),
    service: PlanService = Depends(get_service),
):
    return service.update_plan(plan_id, data, actor=actor)


# ── Archive (safe delete) ─────────────────────────────────────────────────────

@router.delete("/{plan_id}", response_model=PlanDetailResponse, summary="Archive plan")
def archive_plan(
    plan_id: int,
    actor:   User = Depends(require_admin_staff),
    service: PlanService = Depends(get_service),
):
    return service.archive_plan(plan_id, actor=actor)
