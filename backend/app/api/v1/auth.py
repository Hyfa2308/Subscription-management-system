"""
REVORA – Authentication API endpoints.

Routes:
  POST   /api/v1/auth/register          — public registration (CUSTOMER role)
  POST   /api/v1/auth/login             — JSON login, returns JWT + user
  POST   /api/v1/auth/login-form        — OAuth2 form login (for Swagger UI)
  GET    /api/v1/auth/me                — get current authenticated user
  POST   /api/v1/auth/logout            — client-side token invalidation contract
  POST   /api/v1/auth/forgot-password   — initiate password reset
  POST   /api/v1/auth/reset-password    — complete password reset

Token architecture:
  - Stateless JWT access tokens (HS256).
  - Logout is handled by the client discarding the token. The backend endpoint
    provides a standard contract for future token revocation (refresh tokens,
    blocklist) without breaking the API contract.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.dependencies import get_auth_service, get_current_active_user
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    MessageResponse,
    MeResponse,
    ResetPasswordRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(tags=["Authentication"])


# ── Register ───────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new customer account",
)
def register(
    data: UserRegisterRequest,
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    return service.register(data)


# ── Login (JSON) ───────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Sign in with email and password (JSON)",
)
def login(
    data: UserLoginRequest,
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    return service.login(email=str(data.email), password=data.password)


# ── Login (OAuth2 form – Swagger UI compatibility) ─────────────────────────────

@router.post(
    "/login-form",
    response_model=TokenResponse,
    include_in_schema=False,  # Hidden from public docs; used by OAuth2PasswordBearer
)
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    return service.login(email=form_data.username, password=form_data.password)


# ── Me ─────────────────────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get the currently authenticated user",
)
def me(current_user: User = Depends(get_current_active_user)) -> MeResponse:
    return MeResponse(user=UserResponse.model_validate(current_user))


# ── Logout ─────────────────────────────────────────────────────────────────────

@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Sign out (invalidate client-side token)",
)
def logout(
    _current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """
    With stateless JWT tokens the client is responsible for discarding the
    access token. This endpoint validates the token (so the client knows it
    is still valid) and signals that the session should end. Future versions
    will support refresh-token revocation.
    """
    return MessageResponse(
        message="Signed out successfully.",
        detail="Please discard your access token on the client.",
    )


# ── Forgot password ────────────────────────────────────────────────────────────

@router.post(
    "/forgot-password",
    response_model=dict,
    summary="Request a password-reset link",
)
def forgot_password(
    data: ForgotPasswordRequest,
    service: AuthService = Depends(get_auth_service),
) -> dict:
    return service.forgot_password(data)


# ── Reset password ─────────────────────────────────────────────────────────────

@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Complete a password reset using a reset token",
)
def reset_password(
    data: ResetPasswordRequest,
    service: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    result = service.reset_password(data)
    return MessageResponse(**result)
