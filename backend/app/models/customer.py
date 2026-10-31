"""
REVORA – Customer ORM model.
Represents a customer profile in the subscription management system.
Customer codes are auto-generated (CUST-XXXXXXXX).
"""

from __future__ import annotations

import enum
import random
import string
from datetime import datetime

from sqlalchemy import (
    DateTime, Enum, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class CustomerStatus(str, enum.Enum):
    ACTIVE   = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


def _generate_customer_code() -> str:
    """Generate a unique 8-char alphanumeric code prefixed with CUST-."""
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=8))
    return f"CUST-{suffix}"


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    customer_code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True,
        default=_generate_customer_code,
    )

    # ── Personal ─────────────────────────────────────────────────────────────
    full_name:    Mapped[str]        = mapped_column(String(200), nullable=False)
    email:        Mapped[str]        = mapped_column(String(320), unique=True, nullable=False, index=True)
    phone:        Mapped[str | None] = mapped_column(String(30),  nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # ── Billing address ───────────────────────────────────────────────────────
    billing_address: Mapped[str | None] = mapped_column(Text,      nullable=True)
    city:            Mapped[str | None] = mapped_column(String(100), nullable=True)
    state:           Mapped[str | None] = mapped_column(String(100), nullable=True)
    country:         Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code:     Mapped[str | None] = mapped_column(String(20),  nullable=True)

    # ── Status & meta ─────────────────────────────────────────────────────────
    status: Mapped[CustomerStatus] = mapped_column(
        Enum(CustomerStatus, name="customerstatus", native_enum=False),
        nullable=False,
        default=CustomerStatus.ACTIVE,
    )

    registration_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    activities: Mapped[list["CustomerActivity"]] = relationship(
        "CustomerActivity",
        back_populates="customer",
        cascade="all, delete-orphan",
        order_by="CustomerActivity.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Customer id={self.id} code={self.customer_code!r} email={self.email!r}>"


class CustomerActivity(Base):
    """
    Immutable activity log entries for a customer.
    Other modules append events here as business actions occur.
    """
    __tablename__ = "customer_activities"

    id:          Mapped[int] = mapped_column(primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    event_type:  Mapped[str] = mapped_column(String(80),  nullable=False)   # e.g. "customer.created"
    description: Mapped[str] = mapped_column(Text,        nullable=False)
    actor_id:    Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    actor_name:  Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    customer: Mapped["Customer"] = relationship("Customer", back_populates="activities")

    def __repr__(self) -> str:
        return f"<CustomerActivity id={self.id} event={self.event_type!r}>"
