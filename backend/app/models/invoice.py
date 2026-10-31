"""
REVORA – Invoice, InvoiceItem, and BillingRun ORM models.

Design principles:
- All monetary fields use Numeric(14,4) — no floating-point arithmetic.
- InvoiceItem stores historical pricing snapshot (immune to plan/product changes).
- BillingRun records every scheduler execution for idempotency and auditing.
- amount_due is always computed on the backend: total_amount - amount_paid.
- Invoice uniqueness on (subscription_id, billing_period_start) prevents duplicates.
"""

from __future__ import annotations

import enum
import random
import string
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer,
    Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


# ── Enumerations ──────────────────────────────────────────────────────────────

class InvoiceStatus(str, enum.Enum):
    DRAFT           = "draft"
    UNPAID          = "unpaid"
    PARTIALLY_PAID  = "partially_paid"
    PAID            = "paid"
    OVERDUE         = "overdue"
    CANCELLED       = "cancelled"


# ── Code generator ────────────────────────────────────────────────────────────

def _generate_invoice_number() -> str:
    chars = string.ascii_uppercase + string.digits
    return "INV-" + "".join(random.choices(chars, k=8))


# ── Invoice ───────────────────────────────────────────────────────────────────

class Invoice(Base):
    __tablename__ = "invoices"

    # Unique constraint prevents duplicate invoices for the same subscription + period
    __table_args__ = (
        UniqueConstraint(
            "subscription_id", "billing_period_start",
            name="uq_invoice_sub_period",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    invoice_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True,
        default=_generate_invoice_number,
    )

    # ── References ────────────────────────────────────────────────────────────
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    subscription_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("subscriptions.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    quotation_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("quotations.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Dates ─────────────────────────────────────────────────────────────────
    invoice_date:         Mapped[datetime]       = mapped_column(DateTime(timezone=True), nullable=False)
    due_date:             Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    billing_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    billing_period_end:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Financials (Numeric(14,4) – decimal safe) ─────────────────────────────
    currency:        Mapped[str]     = mapped_column(String(3),     nullable=False, default="INR")
    subtotal:        Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    tax_amount:      Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    total_amount:    Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    amount_paid:     Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    amount_due:      Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoicestatus", native_enum=False),
        nullable=False, default=InvoiceStatus.DRAFT, index=True,
    )

    # ── Content ───────────────────────────────────────────────────────────────
    notes:                Mapped[str | None] = mapped_column(Text,   nullable=True)
    terms_and_conditions: Mapped[str | None] = mapped_column(Text,   nullable=True)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    customer:     Mapped["Customer"]       = relationship("Customer",     foreign_keys=[customer_id], lazy="select")  # type: ignore
    subscription: Mapped["Subscription | None"] = relationship("Subscription", foreign_keys=[subscription_id], lazy="select")  # type: ignore
    items:        Mapped[list["InvoiceItem"]] = relationship(
        "InvoiceItem", back_populates="invoice",
        cascade="all, delete-orphan", lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Invoice id={self.id} number={self.invoice_number!r} status={self.status}>"


# ── InvoiceItem ────────────────────────────────────────────────────────────────

class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    invoice_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Optional links (nullable FKs preserve snapshots if referenced records are deleted)
    product_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("products.id",        ondelete="SET NULL"), nullable=True,
    )
    variant_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True,
    )
    plan_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("subscription_plans.id", ondelete="SET NULL"), nullable=True,
    )

    # ── Snapshot / content ────────────────────────────────────────────────────
    description:          Mapped[str]     = mapped_column(Text,           nullable=False)
    quantity:             Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    unit_price:           Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    discount_percentage:  Mapped[Decimal] = mapped_column(Numeric(8, 4),  nullable=False, default=Decimal("0"))
    tax_percentage:       Mapped[Decimal] = mapped_column(Numeric(8, 4),  nullable=False, default=Decimal("0"))

    # ── Calculated (computed on save) ─────────────────────────────────────────
    line_subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    line_discount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    line_tax:      Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    line_total:    Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")

    def recalculate(self) -> None:
        """Compute all line totals using Decimal arithmetic."""
        qty    = Decimal(str(self.quantity))
        up     = Decimal(str(self.unit_price))
        disc_p = Decimal(str(self.discount_percentage))
        tax_p  = Decimal(str(self.tax_percentage))

        gross         = qty * up
        disc_amt      = gross * (disc_p / Decimal("100"))
        after_disc    = gross - disc_amt
        tax_amt       = after_disc * (tax_p / Decimal("100"))

        self.line_subtotal = gross
        self.line_discount = disc_amt
        self.line_tax      = tax_amt
        self.line_total    = after_disc + tax_amt

    def __repr__(self) -> str:
        return f"<InvoiceItem id={self.id} description={self.description!r}>"


# ── BillingRun ────────────────────────────────────────────────────────────────

class BillingRun(Base):
    """Records every execution of the billing engine (manual or scheduled)."""
    __tablename__ = "billing_runs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    triggered_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    started_at:   Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    finished_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status:       Mapped[str]     = mapped_column(String(20), nullable=False, default="running")
    processed:    Mapped[int]     = mapped_column(Integer,    nullable=False, default=0)
    invoices_created: Mapped[int] = mapped_column(Integer,    nullable=False, default=0)
    skipped:      Mapped[int]     = mapped_column(Integer,    nullable=False, default=0)
    errors:       Mapped[int]     = mapped_column(Integer,    nullable=False, default=0)
    error_detail: Mapped[str | None] = mapped_column(Text,    nullable=True)
    dry_run:      Mapped[bool]    = mapped_column(Boolean,    nullable=False, default=False)

    def __repr__(self) -> str:
        return f"<BillingRun id={self.id} status={self.status!r}>"
