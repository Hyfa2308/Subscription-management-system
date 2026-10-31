"""
REVORA – Quotation, QuotationItem, and QuotationTemplate ORM models.
All monetary fields use Numeric(14,4) for decimal safety.
Line item prices are stored as historical snapshots – immune to future
product/plan price changes.
"""

from __future__ import annotations

import enum
import random
import string
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer,
    Numeric, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


# ── Enumerations ──────────────────────────────────────────────────────────────

class QuotationStatus(str, enum.Enum):
    DRAFT     = "draft"
    SENT      = "sent"
    ACCEPTED  = "accepted"
    REJECTED  = "rejected"
    EXPIRED   = "expired"
    CANCELLED = "cancelled"


# Valid transitions: current_status -> [allowed next statuses]
VALID_TRANSITIONS: dict[QuotationStatus, list[QuotationStatus]] = {
    QuotationStatus.DRAFT:     [QuotationStatus.SENT, QuotationStatus.CANCELLED],
    QuotationStatus.SENT:      [QuotationStatus.ACCEPTED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED, QuotationStatus.CANCELLED],
    QuotationStatus.ACCEPTED:  [],
    QuotationStatus.REJECTED:  [],
    QuotationStatus.EXPIRED:   [],
    QuotationStatus.CANCELLED: [],
}


# ── Code generator ────────────────────────────────────────────────────────────

def _generate_quotation_number() -> str:
    chars = string.ascii_uppercase + string.digits
    return "QT-" + "".join(random.choices(chars, k=8))


# ── Quotation ─────────────────────────────────────────────────────────────────

class Quotation(Base):
    __tablename__ = "quotations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    quotation_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True,
        default=_generate_quotation_number,
    )

    # ── Customer ──────────────────────────────────────────────────────────────
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )

    # ── Dates ─────────────────────────────────────────────────────────────────
    quotation_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now,
    )
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[QuotationStatus] = mapped_column(
        Enum(QuotationStatus, name="quotationstatus", native_enum=False),
        nullable=False, default=QuotationStatus.DRAFT, index=True,
    )

    # ── Financial totals (always server-calculated) ───────────────────────────
    currency:        Mapped[str]     = mapped_column(String(3),   nullable=False, default="INR")
    subtotal:        Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    tax_amount:      Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    total_amount:    Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))

    # ── Text fields ───────────────────────────────────────────────────────────
    notes:                  Mapped[str | None] = mapped_column(Text, nullable=True)
    terms_and_conditions:   Mapped[str | None] = mapped_column(Text, nullable=True)

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
    customer: Mapped["Customer"] = relationship("Customer", foreign_keys=[customer_id], lazy="select")  # type: ignore
    items:    Mapped[list["QuotationItem"]] = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan", lazy="select")

    def __repr__(self) -> str:
        return f"<Quotation id={self.id} number={self.quotation_number!r} status={self.status}>"


# ── QuotationItem ─────────────────────────────────────────────────────────────

class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Parent ────────────────────────────────────────────────────────────────
    quotation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("quotations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # ── Snapshot references (stored for history; actual pricing is a snapshot) ──
    product_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True,
    )
    variant_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True,
    )
    plan_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("subscription_plans.id", ondelete="SET NULL"), nullable=True,
    )

    # ── Price snapshot (immutable after creation) ─────────────────────────────
    description:         Mapped[str]     = mapped_column(Text, nullable=False)
    quantity:            Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    unit_price:          Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    discount_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2),  nullable=False, default=Decimal("0"))
    tax_percentage:      Mapped[Decimal] = mapped_column(Numeric(5, 2),  nullable=False, default=Decimal("0"))

    # ── Computed line totals (server-calculated) ──────────────────────────────
    line_subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    line_discount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    line_tax:      Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    line_total:    Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))

    # ── Relationships ─────────────────────────────────────────────────────────
    quotation: Mapped["Quotation"] = relationship("Quotation", back_populates="items")

    def recalculate(self) -> None:
        """Recompute line totals from base fields (all Decimal)."""
        qty  = Decimal(str(self.quantity))
        up   = Decimal(str(self.unit_price))
        disc = Decimal(str(self.discount_percentage))
        tax  = Decimal(str(self.tax_percentage))

        gross             = qty * up
        discount_amount   = gross * (disc / Decimal("100"))
        after_discount    = gross - discount_amount
        tax_amount        = after_discount * (tax / Decimal("100"))

        self.line_subtotal = gross
        self.line_discount = discount_amount
        self.line_tax      = tax_amount
        self.line_total    = after_discount + tax_amount

    def __repr__(self) -> str:
        return f"<QuotationItem id={self.id} qty={self.quantity} unit={self.unit_price}>"


# ── QuotationTemplate ─────────────────────────────────────────────────────────

class QuotationTemplate(Base):
    __tablename__ = "quotation_templates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    template_name:             Mapped[str]        = mapped_column(String(200), nullable=False, unique=True, index=True)
    description:               Mapped[str | None] = mapped_column(Text, nullable=True)
    default_notes:             Mapped[str | None] = mapped_column(Text, nullable=True)
    default_terms_and_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_validity_days:     Mapped[int]         = mapped_column(Integer, nullable=False, default=30)
    is_active:                 Mapped[bool]        = mapped_column(Boolean, nullable=False, default=True)

    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    def __repr__(self) -> str:
        return f"<QuotationTemplate id={self.id} name={self.template_name!r}>"
