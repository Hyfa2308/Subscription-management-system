"""
REVORA – Billing API router.
/api/v1/billing — Admin only.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin_staff, require_admin
from app.database.session import get_db
from app.models.user import User
from app.schemas.invoice import (
    BillingRunRequest, BillingRunResponse, UpcomingBillingItem,
)
from app.services.invoice_service import InvoiceService

router = APIRouter(tags=["Billing"])


def get_service(db: Session = Depends(get_db)) -> InvoiceService:
    return InvoiceService(db)


@router.post("/run")
def run_billing(
    req:     BillingRunRequest = BillingRunRequest(),
    actor:   User = Depends(require_admin),
    service: InvoiceService = Depends(get_service),
):
    """Execute recurring billing for all due active subscriptions. Admin only."""
    return service.run_billing(req, actor=actor)


@router.get("/status")
def billing_status(
    _: User = Depends(require_admin_staff),
    service: InvoiceService = Depends(get_service),
):
    return service.billing_status()


@router.get("/history", response_model=list[BillingRunResponse])
def billing_history(
    _: User = Depends(require_admin_staff),
    service: InvoiceService = Depends(get_service),
):
    return service.billing_history()


@router.get("/upcoming", response_model=list[UpcomingBillingItem])
def upcoming_billing(
    _: User = Depends(require_admin_staff),
    service: InvoiceService = Depends(get_service),
):
    return service.upcoming_billing()
