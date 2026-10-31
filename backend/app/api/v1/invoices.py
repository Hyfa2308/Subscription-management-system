"""
REVORA – Invoices API router.
/api/v1/invoices — Admin + Staff.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin_staff
from app.database.session import get_db
from app.models.user import User
from app.schemas.invoice import (
    InvoiceCreateRequest, InvoiceDetailResponse,
    InvoiceListResponse, InvoiceResponse,
    InvoiceStatsResponse, InvoiceUpdateRequest,
)
from app.services.invoice_service import InvoiceService

router = APIRouter(tags=["Invoices"])


def get_service(db: Session = Depends(get_db)) -> InvoiceService:
    return InvoiceService(db)


# ── Stats (before /{id}) ──────────────────────────────────────────────────────

@router.get("/stats", response_model=InvoiceStatsResponse)
def get_stats(
    _: User = Depends(require_admin_staff),
    service: InvoiceService = Depends(get_service),
):
    return service.get_stats()


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=InvoiceListResponse)
def list_invoices(
    page:            int           = Query(1,   ge=1),
    limit:           int           = Query(10,  ge=1, le=100),
    search:          Optional[str] = Query(None),
    status:          Optional[str] = Query(None),
    customer_id:     Optional[int] = Query(None),
    subscription_id: Optional[int] = Query(None),
    sort_by:         str           = Query("created_at"),
    sort_dir:        str           = Query("desc"),
    _: User = Depends(require_admin_staff),
    service: InvoiceService = Depends(get_service),
):
    return service.list_invoices(
        page=page, page_size=limit, search=search, status=status,
        customer_id=customer_id, subscription_id=subscription_id,
        sort_by=sort_by, sort_dir=sort_dir,
    )


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=InvoiceDetailResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    data:    InvoiceCreateRequest,
    actor:   User = Depends(require_admin_staff),
    service: InvoiceService = Depends(get_service),
):
    return service.create(data, actor=actor)


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{invoice_id}", response_model=InvoiceDetailResponse)
def get_invoice(
    invoice_id: int,
    _: User = Depends(require_admin_staff),
    service: InvoiceService = Depends(get_service),
):
    return service.get(invoice_id)


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{invoice_id}", response_model=InvoiceDetailResponse)
def update_invoice(
    invoice_id: int,
    data:       InvoiceUpdateRequest,
    actor:      User = Depends(require_admin_staff),
    service:    InvoiceService = Depends(get_service),
):
    return service.update(invoice_id, data, actor=actor)


# ── Finalize ──────────────────────────────────────────────────────────────────

@router.post("/{invoice_id}/finalize", response_model=InvoiceDetailResponse)
def finalize_invoice(
    invoice_id: int,
    actor:      User = Depends(require_admin_staff),
    service:    InvoiceService = Depends(get_service),
):
    return service.finalize(invoice_id, actor=actor)


# ── Cancel ────────────────────────────────────────────────────────────────────

@router.post("/{invoice_id}/cancel", response_model=InvoiceDetailResponse)
def cancel_invoice(
    invoice_id: int,
    actor:      User = Depends(require_admin_staff),
    service:    InvoiceService = Depends(get_service),
):
    return service.cancel(invoice_id, actor=actor)


# ── PDF ────────────────────────────────────────────────────────────────────────

@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(
    invoice_id: int,
    _: User = Depends(require_admin_staff),
    service: InvoiceService = Depends(get_service),
):
    return service.get_pdf(invoice_id)
