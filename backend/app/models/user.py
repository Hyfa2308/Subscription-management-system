"""
REVORA – User ORM model.
Represents platform users across Admin, Staff, and Customer roles.
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class UserRole(str, enum.Enum):
    ADMIN    = "admin"
    STAFF    = "staff"
    CUSTOMER = "customer"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email:     Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    phone:     Mapped[str | None] = mapped_column(String(30), nullable=True)

    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    role:      Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="userrole", native_enum=False),
        nullable=False,
        default=UserRole.CUSTOMER,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

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

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"
