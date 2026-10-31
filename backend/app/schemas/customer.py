"""
REVORA – Customer Pydantic schemas.
Request / response models for the customer management API.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip(v: str | None) -> str | None:
    return v.strip() if v else v


# ── Create / Update Requests ──────────────────────────────────────────────────

class CustomerCreateRequest(BaseModel):
    full_name:       str
    email:           EmailStr
    phone:           Optional[str] = None
    company_name:    Optional[str] = None
    billing_address: Optional[str] = None
    city:            Optional[str] = None
    state:           Optional[str] = None
    country:         Optional[str] = None
    postal_code:     Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return v

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if v and len(v) < 5:
            raise ValueError("Phone number is too short.")
        return v or None

    @field_validator(
        "company_name", "billing_address", "city", "state", "country", "postal_code",
        mode="before",
    )
    @classmethod
    def strip_strings(cls, v):
        return _strip(v)


class CustomerUpdateRequest(BaseModel):
    full_name:       Optional[str]      = None
    email:           Optional[EmailStr] = None
    phone:           Optional[str]      = None
    company_name:    Optional[str]      = None
    billing_address: Optional[str]      = None
    city:            Optional[str]      = None
    state:           Optional[str]      = None
    country:         Optional[str]      = None
    postal_code:     Optional[str]      = None

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return v

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str | None) -> str | None:
        return v.strip().lower() if v else None

    @field_validator(
        "phone", "company_name", "billing_address", "city",
        "state", "country", "postal_code", mode="before",
    )
    @classmethod
    def strip_strings(cls, v):
        return _strip(v)


class CustomerStatusUpdateRequest(BaseModel):
    status: str  # "active" | "inactive" | "archived"


# ── Response schemas ──────────────────────────────────────────────────────────

class CustomerActivityResponse(BaseModel):
    id:          int
    event_type:  str
    description: str
    actor_name:  Optional[str] = None
    created_at:  datetime

    model_config = {"from_attributes": True}


class CustomerResponse(BaseModel):
    id:               int
    customer_code:    str
    full_name:        str
    email:            str
    phone:            Optional[str] = None
    company_name:     Optional[str] = None
    billing_address:  Optional[str] = None
    city:             Optional[str] = None
    state:            Optional[str] = None
    country:          Optional[str] = None
    postal_code:      Optional[str] = None
    status:           str
    registration_date: datetime
    created_at:       datetime
    updated_at:       datetime
    created_by:       Optional[int] = None

    model_config = {"from_attributes": True}


class CustomerDetailResponse(CustomerResponse):
    activities: List[CustomerActivityResponse] = []

    model_config = {"from_attributes": True}


# ── List / Pagination ─────────────────────────────────────────────────────────

class CustomerListResponse(BaseModel):
    customers:   List[CustomerResponse]
    total:       int
    page:        int
    page_size:   int
    total_pages: int


# ── Stats ─────────────────────────────────────────────────────────────────────

class CustomerStatsResponse(BaseModel):
    total:    int
    active:   int
    inactive: int
    archived: int
    new_this_month: int
    new_this_week:  int
