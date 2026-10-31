"""
REVORA – Invoice Repository.
All DB operations for invoices, items, billing runs, and billing engine queries.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import func, or_, select, and_
from sqlalchemy.orm import Session, selectinload

from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceItem, BillingRun, InvoiceStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.schemas.invoice import InvoiceCreateRequest, InvoiceItemCreate, InvoiceUpdateRequest


class InvoiceRepository:

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Lookups ───────────────────────────────────────────────────────────────

    def get(self, invoice_id: int) -> Optional[Invoice]:
        return self.db.execute(
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(
                selectinload(Invoice.customer),
                selectinload(Invoice.subscription),
                selectinload(Invoice.items),
            )
        ).scalars().first()

    def get_by_number(self, number: str) -> Optional[Invoice]:
        return self.db.execute(
            select(Invoice).where(Invoice.invoice_number == number)
        ).scalars().first()

    def get_customer(self, cid: int):
        return self.db.get(Customer, cid)

    def check_duplicate(self, subscription_id: int, period_start: datetime) -> bool:
        """Return True if an invoice already exists for this subscription+period."""
        exists = self.db.execute(
            select(Invoice.id).where(
                Invoice.subscription_id == subscription_id,
                Invoice.billing_period_start == period_start,
                Invoice.status != InvoiceStatus.CANCELLED,
            )
        ).first()
        return exists is not None

    # ── Create ────────────────────────────────────────────────────────────────

    def create(
        self,
        data: InvoiceCreateRequest,
        created_by: Optional[int] = None,
    ) -> Invoice:
        inv = Invoice(
            customer_id=data.customer_id,
            subscription_id=data.subscription_id,
            quotation_id=data.quotation_id,
            invoice_date=data.invoice_date,
            due_date=data.due_date,
            billing_period_start=data.billing_period_start,
            billing_period_end=data.billing_period_end,
            currency=data.currency,
            notes=data.notes,
            terms_and_conditions=data.terms_and_conditions,
            status=InvoiceStatus.DRAFT,
            created_by=created_by,
        )
        self.db.add(inv)
        self.db.flush()

        created_items: List[InvoiceItem] = []
        for item_data in data.items:
            created_items.append(self._create_item(inv.id, item_data))

        self.db.flush()
        self._recalc_totals_from(inv, created_items)
        self.db.flush()
        return inv

    def _create_item(self, invoice_id: int, data: InvoiceItemCreate) -> InvoiceItem:
        item = InvoiceItem(
            invoice_id=invoice_id,
            product_id=data.product_id,
            variant_id=data.variant_id,
            plan_id=data.plan_id,
            description=data.description,
            quantity=Decimal(str(data.quantity)),
            unit_price=Decimal(str(data.unit_price)),
            discount_percentage=Decimal(str(data.discount_percentage)),
            tax_percentage=Decimal(str(data.tax_percentage)),
        )
        item.recalculate()
        self.db.add(item)
        return item

    def _recalc_totals_from(self, inv: Invoice, items: List[InvoiceItem]) -> None:
        sub = disc = tax = Decimal("0")
        for item in items:
            sub  += item.line_subtotal
            disc += item.line_discount
            tax  += item.line_tax
        inv.subtotal        = sub
        inv.discount_amount = disc
        inv.tax_amount      = tax
        inv.total_amount    = sub - disc + tax
        inv.amount_due      = inv.total_amount - inv.amount_paid

    # ── Update ────────────────────────────────────────────────────────────────

    def update(self, inv: Invoice, data: InvoiceUpdateRequest) -> Invoice:
        if data.due_date             is not None: inv.due_date             = data.due_date
        if data.notes                is not None: inv.notes                = data.notes
        if data.terms_and_conditions is not None: inv.terms_and_conditions = data.terms_and_conditions
        self.db.flush()
        return inv

    def set_status(self, inv: Invoice, status: InvoiceStatus) -> Invoice:
        inv.status = status
        self.db.flush()
        return inv

    def update_amount_paid(self, inv: Invoice, amount: Decimal) -> Invoice:
        """Called by the Payment module — updates paid/due and recalculates status."""
        inv.amount_paid = amount
        inv.amount_due  = inv.total_amount - amount
        if inv.amount_due <= 0:
            inv.status = InvoiceStatus.PAID
        elif inv.amount_paid > 0:
            inv.status = InvoiceStatus.PARTIALLY_PAID
        self.db.flush()
        return inv

    # ── Overdue refresh ───────────────────────────────────────────────────────

    def mark_overdue(self) -> int:
        """Mark all unpaid/partially-paid invoices past due_date as OVERDUE. Returns count."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(Invoice)
            .where(
                Invoice.status.in_([InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID]),
                Invoice.due_date.isnot(None),
                Invoice.due_date < now,
            )
        )
        updated = 0
        for inv in self.db.execute(stmt).scalars().all():
            inv.status = InvoiceStatus.OVERDUE
            updated += 1
        if updated:
            self.db.flush()
        return updated

    # ── List ──────────────────────────────────────────────────────────────────

    def list(
        self,
        page: int = 1, page_size: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        customer_id: Optional[int] = None,
        subscription_id: Optional[int] = None,
        sort_by: str = "created_at", sort_dir: str = "desc",
    ) -> tuple[list[Invoice], int]:

        stmt = select(Invoice)

        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.outerjoin(Customer, Invoice.customer_id == Customer.id).where(
                or_(
                    Invoice.invoice_number.ilike(q),
                    Customer.full_name.ilike(q),
                    Customer.company_name.ilike(q),
                )
            )
        if status:
            try:
                stmt = stmt.where(Invoice.status == InvoiceStatus(status.lower()))
            except ValueError:
                pass
        if customer_id:
            stmt = stmt.where(Invoice.customer_id == customer_id)
        if subscription_id:
            stmt = stmt.where(Invoice.subscription_id == subscription_id)

        total = self.db.execute(
            select(func.count()).select_from(stmt.subquery())
        ).scalar_one()

        sort_col = getattr(Invoice, sort_by, Invoice.created_at)
        stmt = stmt.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        return list(self.db.execute(stmt).scalars().all()), total

    # ── Stats ─────────────────────────────────────────────────────────────────

    def stats(self) -> dict:
        # Refresh overdue first
        self.mark_overdue()

        rows = self.db.execute(
            select(Invoice.status, func.count().label("cnt"))
            .group_by(Invoice.status)
        ).all()
        counts = {r[0].value: r[1] for r in rows}

        outstanding = self.db.execute(
            select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
                Invoice.status.in_([InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE])
            )
        ).scalar_one()

        paid_amt = self.db.execute(
            select(func.coalesce(func.sum(Invoice.amount_paid), 0)).where(
                Invoice.status == InvoiceStatus.PAID
            )
        ).scalar_one()

        return {
            "total":             sum(counts.values()),
            "draft":             counts.get("draft",          0),
            "unpaid":            counts.get("unpaid",         0),
            "partially_paid":    counts.get("partially_paid", 0),
            "paid":              counts.get("paid",           0),
            "overdue":           counts.get("overdue",        0),
            "cancelled":         counts.get("cancelled",      0),
            "total_outstanding": Decimal(str(outstanding)),
            "total_paid_amount": Decimal(str(paid_amt)),
        }

    # ── Billing engine helpers ────────────────────────────────────────────────

    def get_due_subscriptions(self, as_of: datetime) -> list[Subscription]:
        """Return active subscriptions whose next_billing_date <= as_of."""
        stmt = select(Subscription).where(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.next_billing_date.isnot(None),
            Subscription.next_billing_date <= as_of,
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_upcoming_subscriptions(self, days: int = 30) -> list[Subscription]:
        now    = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=days)
        stmt   = select(Subscription).where(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.next_billing_date.isnot(None),
            Subscription.next_billing_date >= now,
            Subscription.next_billing_date <= cutoff,
        ).order_by(Subscription.next_billing_date)
        return list(self.db.execute(stmt).scalars().all())

    # ── Billing Run ───────────────────────────────────────────────────────────

    def create_billing_run(self, triggered_by: Optional[int], dry_run: bool = False) -> BillingRun:
        run = BillingRun(triggered_by=triggered_by, status="running", dry_run=dry_run)
        self.db.add(run)
        self.db.flush()
        return run

    def finish_billing_run(self, run: BillingRun, processed: int, created: int,
                           skipped: int, errors: int, error_detail: Optional[str] = None) -> BillingRun:
        from datetime import timezone
        run.finished_at      = datetime.now(timezone.utc)
        run.status           = "completed" if errors == 0 else "completed_with_errors"
        run.processed        = processed
        run.invoices_created = created
        run.skipped          = skipped
        run.errors           = errors
        run.error_detail     = error_detail
        self.db.flush()
        return run

    def get_billing_history(self, limit: int = 20) -> list[BillingRun]:
        stmt = select(BillingRun).order_by(BillingRun.started_at.desc()).limit(limit)
        return list(self.db.execute(stmt).scalars().all())
