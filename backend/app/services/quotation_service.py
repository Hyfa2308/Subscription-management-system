"""
REVORA – Quotation & QuotationTemplate Service.
Business logic: RBAC, status transitions, financial validation, PDF dispatch.
"""

from __future__ import annotations

import math
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.quotation import QuotationStatus, VALID_TRANSITIONS
from app.models.user import User, UserRole
from app.repositories.quotation_repository import QuotationRepository, TemplateRepository
from app.schemas.quotation import (
    QuotationCreateRequest, QuotationDetailResponse, QuotationListResponse,
    QuotationResponse, QuotationStatsResponse, QuotationUpdateRequest,
    QuotationTemplateCreate, QuotationTemplateUpdate,
    QuotationTemplateResponse, TemplateListResponse,
)


class QuotationService:

    def __init__(self, db: Session) -> None:
        self.db   = db
        self.repo = QuotationRepository(db)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_or_404(self, quotation_id: int):
        q = self.repo.get(quotation_id)
        if not q:
            raise HTTPException(status_code=404, detail="Quotation not found.")
        return q

    def _assert_editable(self, q) -> None:
        if q.status not in (QuotationStatus.DRAFT,):
            raise HTTPException(
                status_code=400,
                detail=f"Quotation in '{q.status.value}' status cannot be edited.",
            )

    def _validate_customer(self, customer_id: int):
        customer = self.repo.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found.")
        if customer.status.value == "archived":
            raise HTTPException(status_code=400, detail="Cannot create a quotation for an archived customer.")
        return customer

    def _transition(self, q, target: QuotationStatus) -> None:
        allowed = VALID_TRANSITIONS.get(q.status, [])
        if target not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from '{q.status.value}' to '{target.value}'.",
            )

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create_quotation(self, data: QuotationCreateRequest, actor: User) -> QuotationDetailResponse:
        self._validate_customer(data.customer_id)
        q = self.repo.create(data, created_by=actor.id)
        self.db.commit()
        q = self.repo.get(q.id)
        return QuotationDetailResponse.model_validate(q)

    def list_quotations(
        self,
        page: int = 1, page_size: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        customer_id: Optional[int] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        actor: Optional[User] = None,
    ) -> QuotationListResponse:
        # Customers can only see their own quotations
        if actor and actor.role == UserRole.CUSTOMER:
            # Match by customer linked to this user's email (best effort)
            pass  # Future: filter by actor-linked customer

        qs, total = self.repo.list(
            page=page, page_size=page_size, search=search,
            status=status, customer_id=customer_id,
            sort_by=sort_by, sort_dir=sort_dir,
        )
        total_pages = math.ceil(total / page_size) if page_size > 0 else 0
        return QuotationListResponse(
            quotations=[QuotationResponse.model_validate(q) for q in qs],
            total=total, page=page, page_size=page_size, total_pages=total_pages,
        )

    def get_quotation(self, quotation_id: int) -> QuotationDetailResponse:
        q = self._get_or_404(quotation_id)
        return QuotationDetailResponse.model_validate(q)

    def update_quotation(self, quotation_id: int, data: QuotationUpdateRequest, actor: User) -> QuotationDetailResponse:
        q = self._get_or_404(quotation_id)
        self._assert_editable(q)
        if data.items is not None and len(data.items) == 0:
            # Allow saving with 0 items as draft — just validate nothing
            pass
        q = self.repo.update(q, data)
        self.db.commit()
        q = self.repo.get(quotation_id)
        return QuotationDetailResponse.model_validate(q)

    def delete_quotation(self, quotation_id: int, actor: User) -> QuotationDetailResponse:
        q = self._get_or_404(quotation_id)
        if q.status not in (QuotationStatus.DRAFT, QuotationStatus.CANCELLED):
            raise HTTPException(
                status_code=400,
                detail="Only draft or cancelled quotations can be deleted.",
            )
        result = QuotationDetailResponse.model_validate(q)
        self.db.delete(q)
        self.db.commit()
        return result

    def get_stats(self) -> QuotationStatsResponse:
        return QuotationStatsResponse(**self.repo.stats())

    # ── Status transitions ────────────────────────────────────────────────────

    def _do_transition(self, quotation_id: int, target: QuotationStatus, require_items: bool = False) -> QuotationDetailResponse:
        q = self._get_or_404(quotation_id)
        self._transition(q, target)
        if require_items and len(q.items) == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot send a quotation with no items.",
            )
        self.repo.update_status(q, target)
        self.db.commit()
        q = self.repo.get(quotation_id)
        return QuotationDetailResponse.model_validate(q)

    def send_quotation(self,   quotation_id: int, actor: User) -> QuotationDetailResponse:
        return self._do_transition(quotation_id, QuotationStatus.SENT, require_items=True)

    def accept_quotation(self, quotation_id: int, actor: User) -> QuotationDetailResponse:
        return self._do_transition(quotation_id, QuotationStatus.ACCEPTED)

    def reject_quotation(self, quotation_id: int, actor: User) -> QuotationDetailResponse:
        return self._do_transition(quotation_id, QuotationStatus.REJECTED)

    def cancel_quotation(self, quotation_id: int, actor: User) -> QuotationDetailResponse:
        return self._do_transition(quotation_id, QuotationStatus.CANCELLED)

    # ── PDF ───────────────────────────────────────────────────────────────────

    def generate_pdf(self, quotation_id: int) -> bytes:
        q = self._get_or_404(quotation_id)
        from app.services.quotation_pdf import generate_quotation_pdf
        return generate_quotation_pdf(q)


# ── Template Service ──────────────────────────────────────────────────────────

class TemplateService:

    def __init__(self, db: Session) -> None:
        self.db   = db
        self.repo = TemplateRepository(db)

    def _get_or_404(self, template_id: int):
        t = self.repo.get(template_id)
        if not t:
            raise HTTPException(status_code=404, detail="Template not found.")
        return t

    def create(self, data: QuotationTemplateCreate, actor: User) -> QuotationTemplateResponse:
        if self.repo.name_exists(data.template_name):
            raise HTTPException(status_code=409, detail="A template with this name already exists.")
        t = self.repo.create(data, created_by=actor.id)
        self.db.commit()
        self.db.refresh(t)
        return QuotationTemplateResponse.model_validate(t)

    def list_templates(
        self, page: int = 1, page_size: int = 20,
        is_active: Optional[bool] = None, search: Optional[str] = None,
    ) -> TemplateListResponse:
        templates, total = self.repo.list(page=page, page_size=page_size, is_active=is_active, search=search)
        total_pages = math.ceil(total / page_size) if page_size else 0
        return TemplateListResponse(
            templates=[QuotationTemplateResponse.model_validate(t) for t in templates],
            total=total, page=page, page_size=page_size, total_pages=total_pages,
        )

    def get(self, template_id: int) -> QuotationTemplateResponse:
        return QuotationTemplateResponse.model_validate(self._get_or_404(template_id))

    def update(self, template_id: int, data: QuotationTemplateUpdate, actor: User) -> QuotationTemplateResponse:
        t = self._get_or_404(template_id)
        if data.template_name and self.repo.name_exists(data.template_name, exclude_id=template_id):
            raise HTTPException(status_code=409, detail="Another template with this name already exists.")
        t = self.repo.update(t, data)
        self.db.commit()
        self.db.refresh(t)
        return QuotationTemplateResponse.model_validate(t)

    def delete(self, template_id: int, actor: User) -> QuotationTemplateResponse:
        t = self._get_or_404(template_id)
        result = QuotationTemplateResponse.model_validate(t)
        self.repo.delete(t)
        self.db.commit()
        return result
