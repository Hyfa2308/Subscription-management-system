"""
REVORA – Subscription Plan Pydantic schemas.
Decimal used for all monetary fields.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


# ── Helpers ───────────────────────────────────────────────────────────────────

VALID_FREQUENCIES = {"daily", "weekly", "monthly", "quarterly", "half_yearly", "yearly"}
VALID_STATUSES    = {"active", "inactive", "archived"}


# ── Nested product/variant summary (returned inside plan responses) ───────────

class ProductSummary(BaseModel):
    id:           int
    product_code: str
    product_name: str
    base_price:   Decimal
    currency:     str

    model_config = {"from_attributes": True}


class VariantSummary(BaseModel):
    id:           int
    variant_code: str
    variant_name: str
    final_price:  Decimal

    model_config = {"from_attributes": True}


# ── Create ────────────────────────────────────────────────────────────────────

class PlanCreateRequest(BaseModel):
    plan_name:   str
    description: Optional[str] = None

    product_id: int
    variant_id: Optional[int] = None

    # Pricing
    plan_price:     Decimal = Decimal("0.00")
    currency:       str     = "INR"
    setup_fee:      Decimal = Decimal("0.00")
    tax_percentage: Decimal = Decimal("0.00")

    # Billing
    billing_frequency: str = "monthly"
    billing_interval:  int = 1

    # Trial
    trial_period_days: int = 0

    # Feature flags
    discount_allowed:      bool = True
    pause_allowed:         bool = True
    renewal_allowed:       bool = True
    early_closure_allowed: bool = False

    # Commitment
    minimum_commitment_period: Optional[int] = None

    # Status
    status: str = "active"

    @field_validator("plan_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Plan name must be at least 2 characters.")
        return v

    @field_validator("plan_price", "setup_fee")
    @classmethod
    def price_non_negative(cls, v: Decimal) -> Decimal:
        if v < Decimal("0"):
            raise ValueError("Price cannot be negative.")
        return v

    @field_validator("tax_percentage")
    @classmethod
    def tax_range(cls, v: Decimal) -> Decimal:
        if v < Decimal("0") or v > Decimal("100"):
            raise ValueError("Tax must be between 0 and 100.")
        return v

    @field_validator("billing_interval")
    @classmethod
    def interval_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Billing interval must be a positive integer.")
        return v

    @field_validator("trial_period_days")
    @classmethod
    def trial_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Trial period cannot be negative.")
        return v

    @field_validator("billing_frequency")
    @classmethod
    def valid_frequency(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in VALID_FREQUENCIES:
            raise ValueError(f"billing_frequency must be one of {sorted(VALID_FREQUENCIES)}.")
        return v

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_STATUSES)}.")
        return v

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.strip().upper()


# ── Update ────────────────────────────────────────────────────────────────────

class PlanUpdateRequest(BaseModel):
    plan_name:   Optional[str] = None
    description: Optional[str] = None

    variant_id: Optional[int] = None

    plan_price:     Optional[Decimal] = None
    currency:       Optional[str]     = None
    setup_fee:      Optional[Decimal] = None
    tax_percentage: Optional[Decimal] = None

    billing_frequency: Optional[str] = None
    billing_interval:  Optional[int] = None
    trial_period_days: Optional[int] = None

    discount_allowed:      Optional[bool] = None
    pause_allowed:         Optional[bool] = None
    renewal_allowed:       Optional[bool] = None
    early_closure_allowed: Optional[bool] = None

    minimum_commitment_period: Optional[int] = None

    status: Optional[str] = None

    @field_validator("plan_price", "setup_fee")
    @classmethod
    def price_non_negative(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < Decimal("0"):
            raise ValueError("Price cannot be negative.")
        return v

    @field_validator("tax_percentage")
    @classmethod
    def tax_range(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and (v < Decimal("0") or v > Decimal("100")):
            raise ValueError("Tax must be between 0 and 100.")
        return v

    @field_validator("billing_interval")
    @classmethod
    def interval_positive(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("Billing interval must be a positive integer.")
        return v


# ── Responses ─────────────────────────────────────────────────────────────────

class PlanResponse(BaseModel):
    id:        int
    plan_code: str
    plan_name: str
    description: Optional[str]

    product_id: int
    variant_id: Optional[int]

    plan_price:     Decimal
    currency:       str
    setup_fee:      Decimal
    tax_percentage: Decimal

    billing_frequency: str
    billing_interval:  int
    trial_period_days: int

    discount_allowed:      bool
    pause_allowed:         bool
    renewal_allowed:       bool
    early_closure_allowed: bool

    minimum_commitment_period: Optional[int]

    status:     str
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlanDetailResponse(PlanResponse):
    product: Optional[ProductSummary] = None
    variant: Optional[VariantSummary] = None

    model_config = {"from_attributes": True}


class PlanListResponse(BaseModel):
    plans:       list[PlanResponse]
    total:       int
    page:        int
    page_size:   int
    total_pages: int


class PlanStatsResponse(BaseModel):
    total:    int
    active:   int
    inactive: int
    archived: int
    most_popular_frequency: Optional[str]
