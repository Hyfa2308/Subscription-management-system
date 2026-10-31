"""
REVORA – Discounts API router.
/api/v1/discounts — Admin + Staff.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin_staff, require_admin
from app.database.session import get_db
from app.models.user import User
from app.schemas.discount import (
    DiscountCreateRequest, DiscountListResponse, DiscountResponse,
    DiscountStatsResponse, DiscountUpdateRequest, DiscountValidateRequest,
    DiscountValidateResponse, RedeemRequest, RedemptionResponse,
)
from app.services.discount_service import DiscountService

router = APIRouter(tags=["Discounts"])


def get_service(db: Session = Depends(get_db)) -> DiscountService:
    return DiscountService(db)


# ── Stats (must be before /{id}) ───────────────────────────────────────────────

@router.get("/stats", response_model=DiscountStatsResponse)
def get_stats(
    _: User = Depends(require_admin_staff),
    service: DiscountService = Depends(get_service),
):
    return service.get_stats()


# ── Validate (must be before /{id}) ───────────────────────────────────────────

@router.post("/validate", response_model=DiscountValidateResponse)
def validate_discount(
    req:     DiscountValidateRequest,
    _:       User = Depends(require_admin_staff),
    service: DiscountService = Depends(get_service),
):
    """Validate a discount code against a purchase context."""
    return service.validate(req)


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=DiscountListResponse)
def list_discounts(
    page:          int           = Query(1,  ge=1),
    limit:         int           = Query(10, ge=1, le=100),
    search:        Optional[str] = Query(None),
    status:        Optional[str] = Query(None),
    discount_type: Optional[str] = Query(None),
    sort_by:       str           = Query("created_at"),
    sort_dir:      str           = Query("desc"),
    _: User = Depends(require_admin_staff),
    service: DiscountService = Depends(get_service),
):
    return service.list_discounts(
        page=page, page_size=limit,
        search=search, status=status,
        discount_type=discount_type,
        sort_by=sort_by, sort_dir=sort_dir,
    )


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=DiscountResponse, status_code=status.HTTP_201_CREATED)
def create_discount(
    data:    DiscountCreateRequest,
    actor:   User = Depends(require_admin_staff),
    service: DiscountService = Depends(get_service),
):
    return service.create(data, actor=actor)


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{discount_id}", response_model=DiscountResponse)
def get_discount(
    discount_id: int,
    _: User = Depends(require_admin_staff),
    service: DiscountService = Depends(get_service),
):
    return service.get(discount_id)


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{discount_id}", response_model=DiscountResponse)
def update_discount(
    discount_id: int,
    data:        DiscountUpdateRequest,
    actor:       User = Depends(require_admin_staff),
    service:     DiscountService = Depends(get_service),
):
    return service.update(discount_id, data, actor=actor)


# ── Archive (soft delete) ─────────────────────────────────────────────────────

@router.delete("/{discount_id}")
def archive_discount(
    discount_id: int,
    actor:       User = Depends(require_admin),
    service:     DiscountService = Depends(get_service),
):
    return service.delete(discount_id, actor=actor)


# ── Reserve ───────────────────────────────────────────────────────────────────

@router.post("/{discount_id}/reserve", response_model=RedemptionResponse)
def reserve_discount(
    discount_id: int,
    req:         RedeemRequest,
    actor:       User = Depends(require_admin_staff),
    service:     DiscountService = Depends(get_service),
):
    return service.reserve(discount_id, req, actor=actor)


# ── Redeem (confirm) ──────────────────────────────────────────────────────────

@router.post("/{discount_id}/redeem/{redemption_id}", response_model=RedemptionResponse)
def redeem_discount(
    discount_id:   int,
    redemption_id: int,
    actor:         User = Depends(require_admin_staff),
    service:       DiscountService = Depends(get_service),
):
    return service.redeem(discount_id, redemption_id, actor=actor)


# ── Reverse ───────────────────────────────────────────────────────────────────

@router.post("/{discount_id}/reverse/{redemption_id}", response_model=RedemptionResponse)
def reverse_discount(
    discount_id:   int,
    redemption_id: int,
    actor:         User = Depends(require_admin_staff),
    service:       DiscountService = Depends(get_service),
):
    return service.reverse(discount_id, redemption_id, actor=actor)


# ── Redemption history ────────────────────────────────────────────────────────

@router.get("/{discount_id}/redemptions", response_model=list[RedemptionResponse])
def get_redemptions(
    discount_id: int,
    _: User = Depends(require_admin_staff),
    service: DiscountService = Depends(get_service),
):
    return service.get_redemptions(discount_id)
