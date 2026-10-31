"""
REVORA – Product and ProductVariant ORM models.
Uses SQLAlchemy Numeric(precision, scale) for all monetary values
to guarantee decimal-safe financial calculations.
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

class ProductType(str, enum.Enum):
    ONE_TIME     = "one_time"
    SUBSCRIPTION = "subscription"


class BillingType(str, enum.Enum):
    ONE_TIME  = "one_time"
    RECURRING = "recurring"


# ── Code generators ───────────────────────────────────────────────────────────

def _generate_product_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "PROD-" + "".join(random.choices(chars, k=8))


def _generate_variant_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "VAR-" + "".join(random.choices(chars, k=8))


# ── Product ───────────────────────────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    product_code: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True,
        default=_generate_product_code,
    )
    product_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description:  Mapped[str | None] = mapped_column(Text, nullable=True)
    category:     Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    # ── Typing ────────────────────────────────────────────────────────────────
    product_type: Mapped[ProductType] = mapped_column(
        Enum(ProductType, name="producttype", native_enum=False),
        nullable=False,
        default=ProductType.SUBSCRIPTION,
    )
    billing_type: Mapped[BillingType] = mapped_column(
        Enum(BillingType, name="billingtype", native_enum=False),
        nullable=False,
        default=BillingType.RECURRING,
    )

    # ── Pricing (Numeric for decimal safety) ─────────────────────────────────
    base_price:     Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0.0000"))
    currency:       Mapped[str]     = mapped_column(String(3), nullable=False, default="INR")
    tax_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))

    # ── Status ────────────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

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
    variants: Mapped[list["ProductVariant"]] = relationship(
        "ProductVariant",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductVariant.created_at",
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} code={self.product_code!r}>"


# ── ProductVariant ────────────────────────────────────────────────────────────

class ProductVariant(Base):
    __tablename__ = "product_variants"

    id:         Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    variant_code: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True,
        default=_generate_variant_code,
    )
    variant_name: Mapped[str]        = mapped_column(String(200), nullable=False)
    description:  Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Pricing ───────────────────────────────────────────────────────────────
    # price_adjustment can be negative (discount) but final_price must be >= 0
    price_adjustment: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0.0000"))
    final_price:      Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=Decimal("0.0000"))

    # ── Status ────────────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    product: Mapped["Product"] = relationship("Product", back_populates="variants")

    def recalculate_final_price(self) -> None:
        """Recompute final_price from parent base_price + adjustment."""
        raw = (self.product.base_price or Decimal("0")) + (self.price_adjustment or Decimal("0"))
        self.final_price = max(raw, Decimal("0"))

    def __repr__(self) -> str:
        return f"<ProductVariant id={self.id} code={self.variant_code!r} final={self.final_price}>"
