"""
REVORA – Auth Pydantic schemas.
Request / response models for authentication endpoints.
hashed_password is NEVER included in any response schema.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.user import UserRole

# ── Password validation helper ─────────────────────────────────────────────────

_MIN_PASSWORD_LENGTH = 8


def _validate_password_strength(password: str) -> str:
    if len(password) < _MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {_MIN_PASSWORD_LENGTH} characters.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must contain at least one digit.")
    return password


# ── Registration ───────────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    full_name:        str      = Field(..., min_length=2, max_length=200)
    email:            EmailStr
    phone:            Optional[str] = Field(None, max_length=30)
    password:         str      = Field(..., min_length=8)
    confirm_password: str

    @field_validator("full_name")
    @classmethod
    def full_name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be blank.")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)

    @model_validator(mode="after")
    def passwords_match(self) -> "UserRegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


# ── Login ──────────────────────────────────────────────────────────────────────

class UserLoginRequest(BaseModel):
    email:    EmailStr
    password: str = Field(..., min_length=1)


# ── Responses (safe – no hashed_password) ─────────────────────────────────────

class UserResponse(BaseModel):
    id:         int
    full_name:  str
    email:      str
    phone:      Optional[str]
    role:       UserRole
    is_active:  bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserResponse


class MeResponse(BaseModel):
    user: UserResponse


# ── Password reset ─────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token:            str
    new_password:     str = Field(..., min_length=8)
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)

    @model_validator(mode="after")
    def passwords_match(self) -> "ResetPasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


# ── Generic message ────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    detail:  Optional[str] = None
