"""
REVORA – Recurring Billing Engine.

Responsibilities:
- Identify active subscriptions due for billing.
- Compute billing periods using Decimal-safe arithmetic.
- Generate invoices idempotently (duplicate guard via UniqueConstraint).
- Advance next_billing_date.
- Log activity on subscription.
- Return summary of processed/skipped/created/error counts.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.subscription import Subscription, SubscriptionStatus, ActivityAction
from app.models.invoice import Invoice, InvoiceStatus
from app.repositories.invoice_repository import InvoiceRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.schemas.invoice import InvoiceCreateRequest, InvoiceItemCreate

logger = logging.getLogger(__name__)


class BillingEngine:

    def __init__(self, db: Session) -> None:
        self.db       = db
        self.inv_repo = InvoiceRepository(db)
        self.sub_repo = SubscriptionRepository(db)

    def run(
        self,
        actor_id: Optional[int] = None,
        dry_run: bool = False,
        as_of: Optional[datetime] = None,
    ) -> dict:
        """
        Execute recurring billing for all due active subscriptions.
        Returns summary dict: processed, invoices_created, skipped, errors, error_details.
        """
        as_of = as_of or datetime.now(timezone.utc)

        billing_run = self.inv_repo.create_billing_run(triggered_by=actor_id, dry_run=dry_run)
        self.db.commit()

        processed = created = skipped = errors = 0
        error_details: list[str] = []

        due_subs = self.inv_repo.get_due_subscriptions(as_of)

        for sub in due_subs:
            processed += 1
            try:
                result = self._process_subscription(sub, as_of=as_of, actor_id=actor_id, dry_run=dry_run)
                if result == "created":
                    created += 1
                else:
                    skipped += 1
            except Exception as exc:
                logger.exception("Billing failed for subscription %s", sub.subscription_number)
                errors += 1
                error_details.append(f"{sub.subscription_number}: {exc}")
                self.db.rollback()

        self.db.commit()
        self.inv_repo.finish_billing_run(
            billing_run,
            processed=processed, created=created,
            skipped=skipped,     errors=errors,
            error_detail="\n".join(error_details) or None,
        )
        self.db.commit()

        return {
            "billing_run_id":  billing_run.id,
            "processed":       processed,
            "invoices_created": created,
            "skipped":         skipped,
            "errors":          errors,
            "error_details":   error_details,
            "dry_run":         dry_run,
        }

    def _process_subscription(
        self,
        sub: Subscription,
        as_of: datetime,
        actor_id: Optional[int],
        dry_run: bool,
    ) -> str:
        """Create an invoice for a single due subscription. Returns 'created' or 'skipped'."""

        # Guard: only active
        if sub.status != SubscriptionStatus.ACTIVE:
            return "skipped"

        # Determine billing period
        period_start = sub.next_billing_date
        if period_start is None:
            return "skipped"

        # Ensure timezone-aware
        if period_start.tzinfo is None:
            period_start = period_start.replace(tzinfo=timezone.utc)

        period_end = SubscriptionRepository._calc_next_billing(
            period_start, sub.billing_frequency, sub.billing_interval
        )

        # Duplicate guard (also enforced by UniqueConstraint on the DB)
        if self.inv_repo.check_duplicate(sub.id, period_start):
            return "skipped"

        # End-date guard
        if sub.end_date:
            end = sub.end_date if sub.end_date.tzinfo else sub.end_date.replace(tzinfo=timezone.utc)
            if period_start > end:
                return "skipped"

        if dry_run:
            return "created"

        # Calculate invoice amounts (all Decimal)
        unit_price = Decimal(str(sub.unit_price))
        quantity   = Decimal(str(sub.quantity))
        tax_pct    = Decimal("0")
        gross      = unit_price * quantity
        if gross > 0 and sub.tax_amount > 0:
            # Derive effective tax% from snapshot
            total_before_tax = unit_price * quantity - Decimal(str(sub.discount_amount))
            if total_before_tax > 0:
                tax_pct = (Decimal(str(sub.tax_amount)) / total_before_tax) * 100

        due_date = period_end  # Due at next cycle

        description = (
            f"{sub.snap_plan_name or 'Subscription'} — "
            f"{sub.billing_frequency.title()} billing "
            f"({period_start.strftime('%d %b %Y')} to {period_end.strftime('%d %b %Y')})"
        )

        invoice_data = InvoiceCreateRequest(
            customer_id=sub.customer_id,
            subscription_id=sub.id,
            invoice_date=as_of,
            due_date=due_date,
            billing_period_start=period_start,
            billing_period_end=period_end,
            currency=str(sub.currency),
            items=[
                InvoiceItemCreate(
                    plan_id=sub.plan_id,
                    product_id=sub.product_id,
                    variant_id=sub.variant_id,
                    description=description,
                    quantity=quantity,
                    unit_price=unit_price,
                    discount_percentage=Decimal("0"),
                    tax_percentage=tax_pct,
                )
            ],
        )

        try:
            inv = self.inv_repo.create(invoice_data, created_by=actor_id)
            # Finalize to Unpaid
            inv.status = InvoiceStatus.UNPAID
            self.db.flush()
        except IntegrityError:
            # Race condition — already created
            self.db.rollback()
            return "skipped"

        # Advance next_billing_date
        sub.next_billing_date = period_end
        self.db.flush()

        # Log activity on subscription
        self.sub_repo.log_activity(
            sub, ActivityAction.RENEWED.value, actor_id=actor_id,
            details=f"Billing invoice {inv.invoice_number} generated. Next billing: {period_end.date()}.",
        )
        self.db.flush()

        return "created"
