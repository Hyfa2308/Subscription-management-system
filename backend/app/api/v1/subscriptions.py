"""
REVORA – Subscriptions API router.
/api/v1/subscriptions — Admin + Staff (lifecycle management).
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin_staff
from app.database.session import get_db
from app.models.user import User
from app.schemas.subscription import (
    SubscriptionCreateRequest, SubscriptionDetailResponse,
    SubscriptionListResponse, SubscriptionResponse,
    SubscriptionStatsResponse, SubscriptionUpdateRequest,
    PauseRequest, CloseRequest, CancelRequest,
)
from app.services.subscription_service import SubscriptionService

router = APIRouter(tags=["Subscriptions"])


def get_service(db: Session = Depends(get_db)) -> SubscriptionService:
    return SubscriptionService(db)


# ── Stats (before /{id}) ──────────────────────────────────────────────────────

@router.get("/stats", response_model=SubscriptionStatsResponse)
def get_stats(
    _: User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.get_stats()


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=SubscriptionListResponse)
def list_subscriptions(
    page:              int           = Query(1,    ge=1),
    limit:             int           = Query(10,   ge=1, le=100),
    search:            Optional[str] = Query(None),
    status:            Optional[str] = Query(None),
    customer_id:       Optional[int] = Query(None),
    billing_frequency: Optional[str] = Query(None),
    sort_by:           str           = Query("created_at"),
    sort_dir:          str           = Query("desc"),
    _: User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.list_subscriptions(
        page=page, page_size=limit, search=search, status=status,
        customer_id=customer_id, billing_frequency=billing_frequency,
        sort_by=sort_by, sort_dir=sort_dir,
    )


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=SubscriptionDetailResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    data:    SubscriptionCreateRequest,
    actor:   User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.create(data, actor=actor)


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{sub_id}", response_model=SubscriptionDetailResponse)
def get_subscription(
    sub_id: int,
    _: User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.get(sub_id)


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{sub_id}", response_model=SubscriptionDetailResponse)
def update_subscription(
    sub_id:  int,
    data:    SubscriptionUpdateRequest,
    actor:   User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.update(sub_id, data, actor=actor)


# ── Lifecycle actions ─────────────────────────────────────────────────────────

@router.post("/{sub_id}/activate", response_model=SubscriptionDetailResponse)
def activate(
    sub_id: int,
    actor:   User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.activate(sub_id, actor=actor)


@router.post("/{sub_id}/pause", response_model=SubscriptionDetailResponse)
def pause(
    sub_id: int,
    data:    PauseRequest,
    actor:   User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.pause(sub_id, data, actor=actor)


@router.post("/{sub_id}/resume", response_model=SubscriptionDetailResponse)
def resume(
    sub_id: int,
    actor:   User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.resume(sub_id, actor=actor)


@router.post("/{sub_id}/renew", response_model=SubscriptionDetailResponse)
def renew(
    sub_id: int,
    actor:   User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.renew(sub_id, actor=actor)


@router.post("/{sub_id}/close", response_model=SubscriptionDetailResponse)
def close(
    sub_id: int,
    data:    CloseRequest,
    actor:   User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.close(sub_id, data, actor=actor)


@router.post("/{sub_id}/cancel", response_model=SubscriptionDetailResponse)
def cancel(
    sub_id: int,
    data:    CancelRequest,
    actor:   User = Depends(require_admin_staff),
    service: SubscriptionService = Depends(get_service),
):
    return service.cancel(sub_id, data, actor=actor)
