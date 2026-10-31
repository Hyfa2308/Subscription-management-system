"""
REVORA – SubscriptionPlan ORM model.

A plan ties a Product (+ optional Variant) to billing configuration.
All monetary fields use Numeric(14,4) for decimal safety.
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

class BillingFrequency(str, enum.Enum):
    DAILY       = "daily"
    WEEKLY      = "weekly"
    MONTHLY     = "monthly"
    QUARTERLY   = "quarterly"
    HALF_YEARLY = "half_yearly"
    YEARLY      = "yearly"


class PlanStatus(str, enum.Enum):
    ACTIVE   = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


# ── Code generator ────────────────────────────────────────────────────────────

def _generate_plan_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "PLAN-" + "".join(random.choices(chars, k=8))


# ── SubscriptionPlan ──────────────────────────────────────────────────────────

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    plan_code: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True,
        default=_generate_plan_code,
    )
    plan_name:   Mapped[str]        = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Product / Variant link ────────────────────────────────────────────────
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    variant_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_variants.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    # ── Pricing (all Numeric for decimal safety) ──────────────────────────────
    plan_price:     Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0.0000"))
    currency:       Mapped[str]     = mapped_column(String(3), nullable=False, default="INR")
    setup_fee:      Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0.0000"))
    tax_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2),  nullable=False, default=Decimal("0.00"))

    # ── Billing ───────────────────────────────────────────────────────────────
    billing_frequency: Mapped[BillingFrequency] = mapped_column(
        Enum(BillingFrequency, name="billingfrequency", native_enum=False),
        nullable=False, default=BillingFrequency.MONTHLY,
    )
    billing_interval: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # ── Trial ─────────────────────────────────────────────────────────────────
    trial_period_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Feature flags ─────────────────────────────────────────────────────────
    discount_allowed:    Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    pause_allowed:       Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    renewal_allowed:     Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    early_closure_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Commitment ────────────────────────────────────────────────────────────
    minimum_commitment_period: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[PlanStatus] = mapped_column(
        Enum(PlanStatus, name="planstatus", native_enum=False),
        nullable=False, default=PlanStatus.ACTIVE, index=True,
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
    product: Mapped["Product"] = relationship(  # type: ignore[name-defined]
        "Product", foreign_keys=[product_id], lazy="select",
    )
    variant: Mapped["ProductVariant | None"] = relationship(  # type: ignore[name-defined]
        "ProductVariant", foreign_keys=[variant_id], lazy="select",
    )

    def __repr__(self) -> str:
        return f"<SubscriptionPlan id={self.id} code={self.plan_code!r} status={self.status}>"
