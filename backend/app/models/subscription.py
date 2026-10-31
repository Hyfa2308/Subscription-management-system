"""
REVORA – Subscription & SubscriptionActivity ORM models.

Design principles:
- All monetary fields use Numeric(14,4) for decimal safety.
- Pricing is snapshotted at creation time — plan/product changes are immune.
- Status transitions are validated via VALID_TRANSITIONS.
- Every lifecycle action is recorded in SubscriptionActivity.
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

class SubscriptionStatus(str, enum.Enum):
    DRAFT     = "draft"
    PENDING   = "pending"
    ACTIVE    = "active"
    PAUSED    = "paused"
    EXPIRED   = "expired"
    CLOSED    = "closed"
    CANCELLED = "cancelled"


# Valid status transitions: current → allowed next states
SUBSCRIPTION_TRANSITIONS: dict[SubscriptionStatus, list[SubscriptionStatus]] = {
    SubscriptionStatus.DRAFT:     [SubscriptionStatus.PENDING, SubscriptionStatus.CANCELLED],
    SubscriptionStatus.PENDING:   [SubscriptionStatus.ACTIVE,  SubscriptionStatus.CANCELLED],
    SubscriptionStatus.ACTIVE:    [SubscriptionStatus.PAUSED,  SubscriptionStatus.EXPIRED,
                                   SubscriptionStatus.CLOSED,  SubscriptionStatus.CANCELLED],
    SubscriptionStatus.PAUSED:    [SubscriptionStatus.ACTIVE,  SubscriptionStatus.CANCELLED],
    SubscriptionStatus.EXPIRED:   [],
    SubscriptionStatus.CLOSED:    [],
    SubscriptionStatus.CANCELLED: [],
}

# Activity action constants
class ActivityAction(str, enum.Enum):
    CREATED    = "created"
    ACTIVATED  = "activated"
    PAUSED     = "paused"
    RESUMED    = "resumed"
    RENEWED    = "renewed"
    CLOSED     = "closed"
    CANCELLED  = "cancelled"
    UPDATED    = "updated"
    EXPIRED    = "expired"
    PENDING    = "pending"


# ── Code generator ────────────────────────────────────────────────────────────

def _generate_subscription_number() -> str:
    chars = string.ascii_uppercase + string.digits
    return "SUB-" + "".join(random.choices(chars, k=8))


# ── Subscription ──────────────────────────────────────────────────────────────

class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    subscription_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True,
        default=_generate_subscription_number,
    )

    # ── Foreign keys ──────────────────────────────────────────────────────────
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscription_plans.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    product_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    variant_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_variants.id", ondelete="SET NULL"),
        nullable=True,
    )
    quotation_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("quotations.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Dates ─────────────────────────────────────────────────────────────────
    start_date:        Mapped[datetime]        = mapped_column(DateTime(timezone=True), nullable=False)
    end_date:          Mapped[datetime | None]  = mapped_column(DateTime(timezone=True), nullable=True)
    next_billing_date: Mapped[datetime | None]  = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Billing snapshot (immutable after first activation) ───────────────────
    billing_frequency: Mapped[str]     = mapped_column(String(20), nullable=False)
    billing_interval:  Mapped[int]     = mapped_column(Integer,    nullable=False, default=1)
    currency:          Mapped[str]     = mapped_column(String(3),  nullable=False, default="INR")
    unit_price:        Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    quantity:          Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("1"))
    discount_amount:   Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    tax_amount:        Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0"))
    total_amount:      Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, name="subscriptionstatus", native_enum=False),
        nullable=False, default=SubscriptionStatus.DRAFT, index=True,
    )

    # ── Configuration ─────────────────────────────────────────────────────────
    auto_renew:      Mapped[bool]        = mapped_column(Boolean, nullable=False, default=True)
    pause_reason:    Mapped[str | None]  = mapped_column(Text,   nullable=True)
    closure_reason:  Mapped[str | None]  = mapped_column(Text,   nullable=True)

    # ── Snapshot: plan permissions at creation time ───────────────────────────
    # Prevents plan permission changes from silently altering existing subscriptions
    snap_pause_allowed:         Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    snap_renewal_allowed:       Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    snap_early_closure_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    snap_discount_allowed:      Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Plan name snapshot (for display after plan is deleted/renamed) ────────
    snap_plan_name:    Mapped[str | None] = mapped_column(String(200), nullable=True)
    snap_product_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

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
    customer:   Mapped["Customer"]   = relationship("Customer",   foreign_keys=[customer_id], lazy="select")  # type: ignore
    plan:       Mapped["SubscriptionPlan"] = relationship("SubscriptionPlan", foreign_keys=[plan_id], lazy="select")  # type: ignore
    activities: Mapped[list["SubscriptionActivity"]] = relationship(
        "SubscriptionActivity", back_populates="subscription",
        cascade="all, delete-orphan", order_by="SubscriptionActivity.created_at.desc()",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Subscription id={self.id} number={self.subscription_number!r} status={self.status}>"


# ── SubscriptionActivity ──────────────────────────────────────────────────────

class SubscriptionActivity(Base):
    __tablename__ = "subscription_activities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    subscription_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    actor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    action:  Mapped[str]        = mapped_column(String(50), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    subscription: Mapped["Subscription"] = relationship("Subscription", back_populates="activities")

    def __repr__(self) -> str:
        return f"<SubscriptionActivity id={self.id} action={self.action!r}>"
