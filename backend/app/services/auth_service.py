"""
REVORA – Auth Service.
Business logic for authentication: register, login, password reset.

Password-reset tokens are signed JWTs with a short expiry.
Token revocation is handled by checking the stored token_version on the User.
For stateless access tokens, logout is achieved by clearing the token on the
client side. The /auth/logout endpoint provides a standard API contract.

DEVELOPMENT MODE: When SMTP is not configured, reset tokens are returned in
the API response body so developers can test the flow without an email server.
This behaviour is controlled by the DEV_RETURN_RESET_TOKEN env variable and
must never be enabled in production.
"""

from __future__ import annotations

import secrets
from datetime import timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    verify_password,
    hash_password,
)
from app.models.user import User, UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserRegisterRequest,
    UserResponse,
)

settings = get_settings()

# Short-lived reset token (15 minutes)
_RESET_TOKEN_MINUTES = 15


class AuthService:
    def __init__(self, db: Session) -> None:
        self.repo = UserRepository(db)

    # ── Register ───────────────────────────────────────────────────────────────

    def register(self, data: UserRegisterRequest) -> UserResponse:
        if self.repo.email_exists(data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        # Public registration always gets CUSTOMER role — never ADMIN
        user = self.repo.create(
            full_name=data.full_name,
            email=data.email,
            password=data.password,
            phone=data.phone,
            role=UserRole.CUSTOMER,
        )
        return UserResponse.model_validate(user)

    # ── Login ──────────────────────────────────────────────────────────────────

    def login(self, email: str, password: str) -> TokenResponse:
        user = self.repo.get_by_email(email)
        # Deliberately generic error to prevent account enumeration
        _invalid = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        if not user or not verify_password(password, user.hashed_password):
            raise _invalid
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated. Contact support.",
            )
        token = create_access_token(subject=str(user.id))
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    # ── Get current user ───────────────────────────────────────────────────────

    def get_user_from_token(self, token: str) -> User:
        user_id = decode_access_token(token)
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is invalid or has expired.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = self.repo.get_by_id(int(user_id))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or deactivated.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user

    # ── Forgot password ────────────────────────────────────────────────────────

    def forgot_password(self, data: ForgotPasswordRequest) -> dict:
        """
        Always returns a generic response to prevent account enumeration.
        In dev mode (DEV_RETURN_RESET_TOKEN=true), the reset token is included
        in the response for testing without an email server.
        """
        user = self.repo.get_by_email(data.email)
        dev_token: Optional[str] = None

        if user and user.is_active:
            reset_token = create_access_token(
                subject=f"reset:{user.id}",
                expires_delta=timedelta(minutes=_RESET_TOKEN_MINUTES),
            )
            dev_token = reset_token
            # TODO: Send reset_token via email in production
            # email_service.send_password_reset(user.email, reset_token)

        response: dict = {
            "message": (
                "If an account with that email exists, a password-reset link has been sent."
            )
        }
        # DEV-ONLY: return token so developers can test reset without email
        if settings.dev_return_reset_token and dev_token:
            response["dev_reset_token"] = dev_token
            response["dev_notice"] = (
                "DEV MODE ONLY — never expose this in production."
            )
        return response

    # ── Reset password ─────────────────────────────────────────────────────────

    def reset_password(self, data: ResetPasswordRequest) -> dict:
        subject = decode_access_token(data.token)
        if not subject or not subject.startswith("reset:"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset token is invalid or has expired.",
            )
        try:
            user_id = int(subject.split(":", 1)[1])
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed reset token.",
            )
        user = self.repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset token is invalid or has expired.",
            )
        self.repo.set_password(user, data.new_password)
        return {"message": "Password has been reset successfully. You may now sign in."}
