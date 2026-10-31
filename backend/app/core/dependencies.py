"""
REVORA – RBAC FastAPI dependency functions.
Reusable dependencies for protected routes and role-based authorization.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.services.auth_service import AuthService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login-form")


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


# ── Authenticated user ─────────────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    service: AuthService = Depends(get_auth_service),
) -> User:
    """Dependency: returns the currently authenticated User or raises 401."""
    return service.get_user_from_token(token)


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency: ensures the user is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )
    return current_user


# ── Role guards ────────────────────────────────────────────────────────────────

def require_roles(*roles: UserRole):
    """
    Factory that returns a dependency restricting access to specified roles.
    Usage: Depends(require_roles(UserRole.ADMIN, UserRole.STAFF))
    """
    def _check(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user
    return _check


# Convenience shortcuts
require_admin        = require_roles(UserRole.ADMIN)
require_admin_staff  = require_roles(UserRole.ADMIN, UserRole.STAFF)
require_any          = require_roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CUSTOMER)


# ── Ownership check helper ─────────────────────────────────────────────────────

def assert_owns_resource(current_user: User, owner_id: int) -> None:
    """
    Raises 403 if the current user is a CUSTOMER and does not own the resource.
    Admin and Staff bypass ownership checks.
    """
    if current_user.role == UserRole.CUSTOMER and current_user.id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this resource.",
        )
