"""
REVORA – User Repository.
All database access for the User model lives here.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.core.security import hash_password


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Queries ────────────────────────────────────────────────────────────────

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email.lower()).first()

    def email_exists(self, email: str) -> bool:
        return self.get_by_email(email) is not None

    # ── Mutations ──────────────────────────────────────────────────────────────

    def create(
        self,
        *,
        full_name: str,
        email: str,
        password: str,
        phone: Optional[str] = None,
        role: UserRole = UserRole.CUSTOMER,
        is_active: bool = True,
    ) -> User:
        user = User(
            full_name=full_name,
            email=email.lower(),
            phone=phone,
            hashed_password=hash_password(password),
            role=role,
            is_active=is_active,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def set_password(self, user: User, new_password: str) -> User:
        user.hashed_password = hash_password(new_password)
        self.db.commit()
        self.db.refresh(user)
        return user

    def set_active(self, user: User, is_active: bool) -> User:
        user.is_active = is_active
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_role(self, user: User, role: UserRole) -> User:
        user.role = role
        self.db.commit()
        self.db.refresh(user)
        return user
