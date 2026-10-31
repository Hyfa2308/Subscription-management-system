"""
REVORA – Invoice Service.
Business logic: RBAC, status management, PDF dispatch, billing engine.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.models.invoice import InvoiceStatus
from app.models.user import User, UserRole
from app.repositories.invoice_repository import InvoiceRepository
from app.schemas.invoice import (
    InvoiceCreateRequest, InvoiceDetailResponse, InvoiceListResponse,
    InvoiceResponse, InvoiceStatsResponse, InvoiceUpdateRequest,
    BillingRunResponse, BillingRunRequest, UpcomingBillingItem,
)
from app.services.billing_engine import BillingEngine
from app.services.invoice_pdf import generate_invoice_pdf


class InvoiceService:

    def __init__(self, db: Session) -> None:
        self.db   = db
        self.repo = InvoiceRepository(db)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_or_404(self, invoice_id: int):
        inv = self.repo.get(invoice_id)
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found.")
        return inv

    def _get_customer(self, cid: int):
        from app.models.customer import CustomerStatus
        c = self.repo.get_customer(cid)
        if not c:
            raise HTTPException(status_code=404, detail="Customer not found.")
        if c.status == CustomerStatus.ARCHIVED:
            raise HTTPException(status_code=400, detail="Cannot create invoice for an archived customer.")
        return c

    def _assert_editable(self, inv) -> None:
        if inv.status in (InvoiceStatus.PAID, InvoiceStatus.CANCELLED):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot edit a {inv.status.value} invoice.",
            )

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create(self, data: InvoiceCreateRequest, actor: User) -> InvoiceDetailResponse:
        self._get_customer(data.customer_id)

        if data.subscription_id:
            from app.models.subscription import Subscription, SubscriptionStatus
            sub = self.db.get(Subscription, data.subscription_id)
            if not sub:
                raise HTTPException(status_code=404, detail="Subscription not found.")
            if sub.customer_id != data.customer_id:
                raise HTTPException(status_code=400, detail="Subscription does not belong to the selected customer.")
            if data.billing_period_start and self.repo.check_duplicate(data.subscription_id, data.billing_period_start):
                raise HTTPException(status_code=409, detail="An invoice already exists for this subscription and billing period.")

        if not data.items:
            raise HTTPException(status_code=400, detail="At least one invoice item is required.")

        inv = self.repo.create(data, created_by=actor.id)
        self.db.commit()
        return InvoiceDetailResponse.model_validate(self.repo.get(inv.id))

    def list_invoices(
        self, page: int, page_size: int,
        search: Optional[str] = None, status: Optional[str] = None,
        customer_id: Optional[int] = None, subscription_id: Optional[int] = None,
        sort_by: str = "created_at", sort_dir: str = "desc",
    ) -> InvoiceListResponse:
        self.repo.mark_overdue()
        invs, total = self.repo.list(
            page=page, page_size=page_size, search=search, status=status,
            customer_id=customer_id, subscription_id=subscription_id,
            sort_by=sort_by, sort_dir=sort_dir,
        )
        total_pages = math.ceil(total / page_size) if page_size else 0
        return InvoiceListResponse(
            invoices=[InvoiceResponse.model_validate(i) for i in invs],
            total=total, page=page, page_size=page_size, total_pages=total_pages,
        )

    def get(self, invoice_id: int) -> InvoiceDetailResponse:
        inv = self._get_or_404(invoice_id)
        return InvoiceDetailResponse.model_validate(inv)

    def update(self, invoice_id: int, data: InvoiceUpdateRequest, actor: User) -> InvoiceDetailResponse:
        inv = self._get_or_404(invoice_id)
        self._assert_editable(inv)
        inv = self.repo.update(inv, data)
        self.db.commit()
        return InvoiceDetailResponse.model_validate(self.repo.get(invoice_id))

    def cancel(self, invoice_id: int, actor: User) -> InvoiceDetailResponse:
        inv = self._get_or_404(invoice_id)
        if inv.status in (InvoiceStatus.PAID, InvoiceStatus.CANCELLED):
            raise HTTPException(status_code=400, detail=f"Cannot cancel a {inv.status.value} invoice.")
        self.repo.set_status(inv, InvoiceStatus.CANCELLED)
        self.db.commit()
        return InvoiceDetailResponse.model_validate(self.repo.get(invoice_id))

    def finalize(self, invoice_id: int, actor: User) -> InvoiceDetailResponse:
        """Transition Draft → Unpaid."""
        inv = self._get_or_404(invoice_id)
        if inv.status != InvoiceStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Only draft invoices can be finalized.")
        self.repo.set_status(inv, InvoiceStatus.UNPAID)
        self.db.commit()
        return InvoiceDetailResponse.model_validate(self.repo.get(invoice_id))

    def get_stats(self) -> InvoiceStatsResponse:
        return InvoiceStatsResponse(**self.repo.stats())

    def get_pdf(self, invoice_id: int) -> Response:
        inv = self._get_or_404(invoice_id)
        pdf_bytes = generate_invoice_pdf(
            inv,
            customer=inv.customer,
            subscription=inv.subscription,
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{inv.invoice_number}.pdf"',
                "Cache-Control": "no-cache",
            },
        )

    # ── Billing ───────────────────────────────────────────────────────────────

    def run_billing(self, req: BillingRunRequest, actor: User) -> dict:
        engine = BillingEngine(self.db)
        return engine.run(actor_id=actor.id, dry_run=req.dry_run)

    def billing_history(self) -> list[BillingRunResponse]:
        runs = self.repo.get_billing_history(limit=20)
        return [BillingRunResponse.model_validate(r) for r in runs]

    def upcoming_billing(self) -> list[UpcomingBillingItem]:
        subs = self.repo.get_upcoming_subscriptions(days=30)
        now  = datetime.now(timezone.utc)
        result: list[UpcomingBillingItem] = []
        for sub in subs:
            nbd = sub.next_billing_date
            if nbd and nbd.tzinfo is None:
                nbd = nbd.replace(tzinfo=timezone.utc)
            days_until = (nbd - now).days if nbd else 0
            c = self.repo.get_customer(sub.customer_id)
            result.append(UpcomingBillingItem(
                subscription_id=sub.id,
                subscription_number=sub.subscription_number,
                customer_id=sub.customer_id,
                customer_name=c.full_name if c else f"#{sub.customer_id}",
                plan_name=sub.snap_plan_name,
                next_billing_date=nbd,
                billing_frequency=sub.billing_frequency,
                expected_amount=Decimal(str(sub.total_amount)),
                currency=str(sub.currency),
                days_until_due=max(days_until, 0),
            ))
        return result

    def billing_status(self) -> dict:
        subs = self.repo.get_upcoming_subscriptions(days=30)
        now  = datetime.now(timezone.utc)
        today   = [s for s in subs if s.next_billing_date and (s.next_billing_date.replace(tzinfo=timezone.utc) if s.next_billing_date.tzinfo is None else s.next_billing_date).date() == now.date()]
        in_7    = [s for s in subs if s.next_billing_date and (s.next_billing_date.replace(tzinfo=timezone.utc) if s.next_billing_date.tzinfo is None else s.next_billing_date) <= now.replace(hour=23, minute=59) + __import__("datetime").timedelta(days=7)]
        total_expected = sum(Decimal(str(s.total_amount)) for s in subs)
        return {
            "due_today":         len(today),
            "due_in_7_days":     len(in_7),
            "due_in_30_days":    len(subs),
            "total_expected":    str(total_expected),
        }
