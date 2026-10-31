"""
REVORA – Discount Service.
Business logic: RBAC, validation, redemption lifecycle.
"""

from __future__ import annotations

import math
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.discount import DiscountStatus, RedemptionStatus
from app.models.user import User
from app.repositories.discount_repository import DiscountRepository
from app.schemas.discount import (
    DiscountCreateRequest, DiscountListResponse, DiscountResponse,
    DiscountStatsResponse, DiscountUpdateRequest, DiscountValidateRequest,
    DiscountValidateResponse, RedeemRequest, RedemptionResponse,
)
from app.services.discount_validator import DiscountValidator


class DiscountService:

    def __init__(self, db: Session) -> None:
        self.db        = db
        self.repo      = DiscountRepository(db)
        self.validator = DiscountValidator(self.repo)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_or_404(self, discount_id: int):
        d = self.repo.get(discount_id)
        if not d:
            raise HTTPException(status_code=404, detail="Discount not found.")
        return d

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create(self, data: DiscountCreateRequest, actor: User) -> DiscountResponse:
        # Check code uniqueness if provided
        if data.discount_code:
            existing = self.repo.get_by_code(data.discount_code)
            if existing:
                raise HTTPException(status_code=409, detail="Discount code already exists.")
        d = self.repo.create(data, created_by=actor.id)
        self.db.commit()
        return DiscountResponse.model_validate(d)

    def list_discounts(
        self,
        page: int, page_size: int,
        search: Optional[str] = None,
        status: Optional[str] = None,
        discount_type: Optional[str] = None,
        sort_by: str = "created_at", sort_dir: str = "desc",
    ) -> DiscountListResponse:
        self.repo.expire_stale()
        discounts, total = self.repo.list(
            page=page, page_size=page_size,
            search=search, status=status,
            discount_type=discount_type,
            sort_by=sort_by, sort_dir=sort_dir,
        )
        total_pages = math.ceil(total / page_size) if page_size else 0
        return DiscountListResponse(
            discounts=[DiscountResponse.model_validate(d) for d in discounts],
            total=total, page=page, page_size=page_size, total_pages=total_pages,
        )

    def get(self, discount_id: int) -> DiscountResponse:
        return DiscountResponse.model_validate(self._get_or_404(discount_id))

    def update(self, discount_id: int, data: DiscountUpdateRequest, actor: User) -> DiscountResponse:
        d = self._get_or_404(discount_id)
        if d.status == DiscountStatus.ARCHIVED:
            raise HTTPException(status_code=400, detail="Cannot update an archived discount.")
        d = self.repo.update(d, data)
        self.db.commit()
        return DiscountResponse.model_validate(d)

    def delete(self, discount_id: int, actor: User) -> dict:
        d = self._get_or_404(discount_id)
        self.repo.delete(d)
        self.db.commit()
        return {"detail": f"Discount {d.discount_code} archived."}

    def get_stats(self) -> DiscountStatsResponse:
        return DiscountStatsResponse(**self.repo.stats())

    # ── Validation ────────────────────────────────────────────────────────────

    def validate(self, req: DiscountValidateRequest) -> DiscountValidateResponse:
        result = self.validator.validate(req)
        return result.to_response(req.purchase_amount, req.discount_code)

    # ── Redemption lifecycle ──────────────────────────────────────────────────

    def reserve(self, discount_id: int, req: RedeemRequest, actor: User) -> RedemptionResponse:
        d = self._get_or_404(discount_id)
        # Validate eligibility
        from app.schemas.discount import DiscountValidateRequest
        val_req = DiscountValidateRequest(
            discount_code=d.discount_code,
            customer_id=req.customer_id,
            purchase_amount=req.purchase_amount,
            currency=req.currency,
            product_ids=req.product_ids,
            plan_ids=req.plan_ids,
        )
        result = self.validator.validate(val_req)
        if not result.valid:
            raise HTTPException(status_code=400, detail=result.reason)

        r = self.repo.create_redemption(
            d, customer_id=req.customer_id,
            amount=result.discount_amount,
            quotation_id=req.quotation_id,
            subscription_id=req.subscription_id,
            invoice_id=req.invoice_id,
        )
        self.db.commit()
        return RedemptionResponse.model_validate(r)

    def redeem(self, discount_id: int, redemption_id: int, actor: User) -> RedemptionResponse:
        self._get_or_404(discount_id)
        r = self.repo.get_redemption(redemption_id)
        if not r or r.discount_id != discount_id:
            raise HTTPException(status_code=404, detail="Redemption not found.")
        if r.status != RedemptionStatus.RESERVED:
            raise HTTPException(status_code=400, detail=f"Redemption is already {r.status.value}.")
        r = self.repo.confirm_redemption(r)
        self.db.commit()
        return RedemptionResponse.model_validate(r)

    def reverse(self, discount_id: int, redemption_id: int, actor: User) -> RedemptionResponse:
        self._get_or_404(discount_id)
        r = self.repo.get_redemption(redemption_id)
        if not r or r.discount_id != discount_id:
            raise HTTPException(status_code=404, detail="Redemption not found.")
        if r.status == RedemptionStatus.REVERSED:
            raise HTTPException(status_code=400, detail="Redemption is already reversed.")
        r = self.repo.reverse_redemption(r)
        self.db.commit()
        return RedemptionResponse.model_validate(r)

    def get_redemptions(self, discount_id: int) -> list[RedemptionResponse]:
        self._get_or_404(discount_id)
        redemptions = self.repo.get_redemptions(discount_id)
        return [RedemptionResponse.model_validate(r) for r in redemptions]
