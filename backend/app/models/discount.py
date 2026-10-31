"""
REVORA – Discount and DiscountRedemption ORM models.

Design principles:
- All monetary fields use Numeric(14,4) – no floating-point arithmetic.
- Discount codes are unique and auto-generated when required.
- Eligibility validation (dates, limits, currency) is enforced in the service layer.
- DiscountRedemption tracks every use for audit and concurrency safety.
- Usage count is incremented only upon confirmed redemption.
"""

from __future__ import annotations

import enum
import random
import string
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer,
    Numeric, String, Text, UniqueConstraint, func, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


# ── Enumerations ──────────────────────────────────────────────────────────────

class DiscountType(str, enum.Enum):
    PERCENTAGE   = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class DiscountApplicableTo(str, enum.Enum):
    ALL                 = "all"
    PRODUCTS            = "products"
    SUBSCRIPTION_PLANS  = "subscription_plans"


class DiscountStatus(str, enum.Enum):
    ACTIVE   = "active"
    INACTIVE = "inactive"
    EXPIRED  = "expired"
    ARCHIVED = "archived"


class RedemptionStatus(str, enum.Enum):
    RESERVED = "reserved"
    REDEEMED = "redeemed"
    REVERSED = "reversed"


# ── Code generator ────────────────────────────────────────────────────────────

def _generate_discount_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "DISC-" + "".join(random.choices(chars, k=8))


# ── Discount ──────────────────────────────────────────────────────────────────

class Discount(Base):
    __tablename__ = "discounts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    discount_code: Mapped[str] = mapped_column(
        String(60), unique=True, nullable=False, index=True,
        default=_generate_discount_code,
    )
    discount_name: Mapped[str]      = mapped_column(String(200), nullable=False)
    description:   Mapped[str | None] = mapped_column(Text,      nullable=True)

    # ── Configuration ─────────────────────────────────────────────────────────
    discount_type:  Mapped[DiscountType] = mapped_column(
        Enum(DiscountType,  name="discounttype",  native_enum=False),
        nullable=False,
    )
    discount_value: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    currency:       Mapped[str]     = mapped_column(String(3),       nullable=False, default="INR")

    # Optional limits (Numeric for decimal safety)
    maximum_discount_amount:  Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    minimum_purchase_amount:  Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)

    # ── Validity ──────────────────────────────────────────────────────────────
    start_date: Mapped[datetime]       = mapped_column(DateTime(timezone=True), nullable=False)
    end_date:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Usage limits ──────────────────────────────────────────────────────────
    usage_limit:              Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_limit_per_customer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_count:              Mapped[int]         = mapped_column(Integer, nullable=False, default=0, index=True)

    # ── Applicability ─────────────────────────────────────────────────────────
    applicable_to: Mapped[DiscountApplicableTo] = mapped_column(
        Enum(DiscountApplicableTo, name="discountapplicableto", native_enum=False),
        nullable=False, default=DiscountApplicableTo.ALL,
    )
    # Store as JSON list of int IDs; null means no restriction within the category
    applicable_product_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    applicable_plan_ids:    Mapped[list | None] = mapped_column(JSON, nullable=True)

    # ── Behaviour flags ───────────────────────────────────────────────────────
    is_stackable:          Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    requires_coupon_code:  Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[DiscountStatus] = mapped_column(
        Enum(DiscountStatus, name="discountstatus", native_enum=False),
        nullable=False, default=DiscountStatus.ACTIVE, index=True,
    )

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
    redemptions: Mapped[list["DiscountRedemption"]] = relationship(
        "DiscountRedemption", back_populates="discount",
        cascade="all, delete-orphan", lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Discount id={self.id} code={self.discount_code!r} status={self.status}>"


# ── DiscountRedemption ────────────────────────────────────────────────────────

class DiscountRedemption(Base):
    """
    Tracks every discount use.
    UniqueConstraint prevents duplicate redemption for the same discount+customer+transaction.
    """
    __tablename__ = "discount_redemptions"

    __table_args__ = (
        # Prevent the same discount being redeemed twice on the same invoice
        UniqueConstraint("discount_id", "invoice_id",      name="uq_redemption_discount_invoice"),
        # Prevent the same discount being redeemed twice on the same subscription
        UniqueConstraint("discount_id", "subscription_id", name="uq_redemption_discount_subscription"),
        # Prevent the same discount being redeemed twice on the same quotation
        UniqueConstraint("discount_id", "quotation_id",    name="uq_redemption_discount_quotation"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    discount_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("discounts.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )

    # Optional transaction references
    quotation_id:    Mapped[int | None] = mapped_column(Integer, ForeignKey("quotations.id",    ondelete="SET NULL"), nullable=True)
    subscription_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True)
    invoice_id:      Mapped[int | None] = mapped_column(Integer, ForeignKey("invoices.id",      ondelete="SET NULL"), nullable=True)

    redemption_amount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    redeemed_at:       Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[RedemptionStatus] = mapped_column(
        Enum(RedemptionStatus, name="redemptionstatus", native_enum=False),
        nullable=False, default=RedemptionStatus.RESERVED,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    discount: Mapped["Discount"] = relationship("Discount", back_populates="redemptions")

    def __repr__(self) -> str:
        return f"<DiscountRedemption id={self.id} discount_id={self.discount_id} status={self.status}>"
