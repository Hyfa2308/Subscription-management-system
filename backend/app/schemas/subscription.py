"""
REVORA – Subscription Pydantic schemas.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


# ── Nested summaries ──────────────────────────────────────────────────────────

class CustomerSummary(BaseModel):
    id:           int
    customer_code: str
    full_name:    str
    email:        str
    company_name: Optional[str] = None
    phone:        Optional[str] = None
    model_config = {"from_attributes": True}


class PlanSummary(BaseModel):
    id:                int
    plan_code:         str
    plan_name:         str
    billing_frequency: str
    billing_interval:  int
    plan_price:        Decimal
    currency:          str
    model_config = {"from_attributes": True}


class ActivityResponse(BaseModel):
    id:              int
    subscription_id: int
    actor_id:        Optional[int]
    action:          str
    details:         Optional[str]
    created_at:      datetime
    model_config = {"from_attributes": True}


# ── Subscription create ───────────────────────────────────────────────────────

class SubscriptionCreateRequest(BaseModel):
    customer_id:   int
    plan_id:       int
    variant_id:    Optional[int]      = None
    quotation_id:  Optional[int]      = None
    start_date:    datetime
    end_date:      Optional[datetime] = None
    quantity:      Decimal            = Decimal("1")
    auto_renew:    bool               = True

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Quantity must be greater than zero.")
        return v


class SubscriptionUpdateRequest(BaseModel):
    end_date:   Optional[datetime] = None
    quantity:   Optional[Decimal]  = None
    auto_renew: Optional[bool]     = None

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("Quantity must be greater than zero.")
        return v


# ── Lifecycle action payloads ─────────────────────────────────────────────────

class PauseRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("A pause reason is required.")
        return v.strip()


class CloseRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("A closure reason is required.")
        return v.strip()


class CancelRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("A cancellation reason is required.")
        return v.strip()


# ── Responses ─────────────────────────────────────────────────────────────────

class SubscriptionResponse(BaseModel):
    id:                  int
    subscription_number: str
    customer_id:         int
    plan_id:             int
    product_id:          Optional[int]
    variant_id:          Optional[int]
    quotation_id:        Optional[int]
    start_date:          datetime
    end_date:            Optional[datetime]
    next_billing_date:   Optional[datetime]
    billing_frequency:   str
    billing_interval:    int
    currency:            str
    unit_price:          Decimal
    quantity:            Decimal
    discount_amount:     Decimal
    tax_amount:          Decimal
    total_amount:        Decimal
    status:              str
    auto_renew:          bool
    pause_reason:        Optional[str]
    closure_reason:      Optional[str]
    snap_plan_name:      Optional[str]
    snap_product_name:   Optional[str]
    snap_pause_allowed:         bool
    snap_renewal_allowed:       bool
    snap_early_closure_allowed: bool
    created_by:          Optional[int]
    created_at:          datetime
    updated_at:          datetime
    model_config = {"from_attributes": True}


class SubscriptionDetailResponse(SubscriptionResponse):
    customer:   Optional[CustomerSummary] = None
    plan:       Optional[PlanSummary]     = None
    activities: list[ActivityResponse]    = []
    model_config = {"from_attributes": True}


class SubscriptionListResponse(BaseModel):
    subscriptions: list[SubscriptionResponse]
    total:         int
    page:          int
    page_size:     int
    total_pages:   int


class SubscriptionStatsResponse(BaseModel):
    total:          int
    draft:          int
    pending:        int
    active:         int
    paused:         int
    expired:        int
    closed:         int
    cancelled:      int
    expiring_soon:  int   # active, end_date within 30 days
