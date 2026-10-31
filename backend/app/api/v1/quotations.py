"""
REVORA – Quotations API router.
/api/v1/quotations — Admin + Staff only (customers read-only future).
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin_staff, get_current_active_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.quotation import (
    QuotationCreateRequest, QuotationDetailResponse,
    QuotationListResponse, QuotationResponse,
    QuotationStatsResponse, QuotationUpdateRequest,
)
from app.services.quotation_service import QuotationService

router = APIRouter(tags=["Quotations"])


def get_service(db: Session = Depends(get_db)) -> QuotationService:
    return QuotationService(db)


# ── Stats (before /{id}) ──────────────────────────────────────────────────────

@router.get("/stats", response_model=QuotationStatsResponse)
def get_stats(
    _: User = Depends(require_admin_staff),
    service: QuotationService = Depends(get_service),
):
    return service.get_stats()


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=QuotationListResponse)
def list_quotations(
    page:        int           = Query(1,    ge=1),
    limit:       int           = Query(10,   ge=1, le=100),
    search:      Optional[str] = Query(None),
    status:      Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    sort_by:     str           = Query("created_at"),
    sort_dir:    str           = Query("desc"),
    actor: User = Depends(require_admin_staff),
    service: QuotationService = Depends(get_service),
):
    return service.list_quotations(
        page=page, page_size=limit, search=search,
        status=status, customer_id=customer_id,
        sort_by=sort_by, sort_dir=sort_dir, actor=actor,
    )


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=QuotationDetailResponse, status_code=status.HTTP_201_CREATED)
def create_quotation(
    data:    QuotationCreateRequest,
    actor:   User = Depends(require_admin_staff),
    service: QuotationService = Depends(get_service),
):
    return service.create_quotation(data, actor=actor)


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{quotation_id}", response_model=QuotationDetailResponse)
def get_quotation(
    quotation_id: int,
    _: User = Depends(require_admin_staff),
    service: QuotationService = Depends(get_service),
):
    return service.get_quotation(quotation_id)


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{quotation_id}", response_model=QuotationDetailResponse)
def update_quotation(
    quotation_id: int,
    data:         QuotationUpdateRequest,
    actor:        User = Depends(require_admin_staff),
    service:      QuotationService = Depends(get_service),
):
    return service.update_quotation(quotation_id, data, actor=actor)


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{quotation_id}", response_model=QuotationDetailResponse)
def delete_quotation(
    quotation_id: int,
    actor:   User = Depends(require_admin_staff),
    service: QuotationService = Depends(get_service),
):
    return service.delete_quotation(quotation_id, actor=actor)


# ── Status transitions ────────────────────────────────────────────────────────

@router.post("/{quotation_id}/send", response_model=QuotationDetailResponse)
def send_quotation(
    quotation_id: int,
    actor:   User = Depends(require_admin_staff),
    service: QuotationService = Depends(get_service),
):
    return service.send_quotation(quotation_id, actor=actor)


@router.post("/{quotation_id}/accept", response_model=QuotationDetailResponse)
def accept_quotation(
    quotation_id: int,
    actor:   User = Depends(require_admin_staff),
    service: QuotationService = Depends(get_service),
):
    return service.accept_quotation(quotation_id, actor=actor)


@router.post("/{quotation_id}/reject", response_model=QuotationDetailResponse)
def reject_quotation(
    quotation_id: int,
    actor:   User = Depends(require_admin_staff),
    service: QuotationService = Depends(get_service),
):
    return service.reject_quotation(quotation_id, actor=actor)


@router.post("/{quotation_id}/cancel", response_model=QuotationDetailResponse)
def cancel_quotation(
    quotation_id: int,
    actor:   User = Depends(require_admin_staff),
    service: QuotationService = Depends(get_service),
):
    return service.cancel_quotation(quotation_id, actor=actor)


# ── PDF Download ──────────────────────────────────────────────────────────────

@router.get("/{quotation_id}/pdf")
def download_pdf(
    quotation_id: int,
    _: User = Depends(require_admin_staff),
    service: QuotationService = Depends(get_service),
):
    pdf_bytes = service.generate_pdf(quotation_id)
    q = service.get_quotation(quotation_id)
    filename = f"quotation-{q.quotation_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
