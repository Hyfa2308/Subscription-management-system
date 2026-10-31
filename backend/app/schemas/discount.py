"""
REVORA – Discount Pydantic schemas.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, field_validator, model_validator


# ── Discount CRUD ─────────────────────────────────────────────────────────────

class DiscountCreateRequest(BaseModel):
    discount_code:            Optional[str]     = None   # auto-generated if omitted
    discount_name:            str
    description:              Optional[str]     = None
    discount_type:            str                         # "percentage" | "fixed_amount"
    discount_value:           Decimal
    currency:                 str               = "INR"
    maximum_discount_amount:  Optional[Decimal] = None
    minimum_purchase_amount:  Optional[Decimal] = None
    start_date:               datetime
    end_date:                 Optional[datetime] = None
    usage_limit:              Optional[int]     = None
    usage_limit_per_customer: Optional[int]     = None
    applicable_to:            str               = "all"
    applicable_product_ids:   Optional[List[int]] = None
    applicable_plan_ids:      Optional[List[int]] = None
    is_stackable:             bool              = False
    requires_coupon_code:     bool              = True
    status:                   str               = "active"

    @field_validator("discount_value")
    @classmethod
    def value_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Discount value must be greater than zero.")
        return v

    @field_validator("discount_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in ("percentage", "fixed_amount"):
            raise ValueError("discount_type must be 'percentage' or 'fixed_amount'.")
        return v

    @model_validator(mode="after")
    def check_percentage_cap(self) -> "DiscountCreateRequest":
        if self.discount_type == "percentage" and self.discount_value > 100:
            raise ValueError("Percentage discount cannot exceed 100%.")
        return self

    @model_validator(mode="after")
    def check_dates(self) -> "DiscountCreateRequest":
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must not precede start_date.")
        return self

    @field_validator("maximum_discount_amount", "minimum_purchase_amount")
    @classmethod
    def non_negative(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("Amount cannot be negative.")
        return v


class DiscountUpdateRequest(BaseModel):
    discount_name:            Optional[str]     = None
    description:              Optional[str]     = None
    discount_value:           Optional[Decimal] = None
    maximum_discount_amount:  Optional[Decimal] = None
    minimum_purchase_amount:  Optional[Decimal] = None
    end_date:                 Optional[datetime] = None
    usage_limit:              Optional[int]     = None
    usage_limit_per_customer: Optional[int]     = None
    applicable_to:            Optional[str]     = None
    applicable_product_ids:   Optional[List[int]] = None
    applicable_plan_ids:      Optional[List[int]] = None
    is_stackable:             Optional[bool]    = None
    status:                   Optional[str]     = None


class DiscountResponse(BaseModel):
    id:                       int
    discount_code:            str
    discount_name:            str
    description:              Optional[str]
    discount_type:            str
    discount_value:           Decimal
    currency:                 str
    maximum_discount_amount:  Optional[Decimal]
    minimum_purchase_amount:  Optional[Decimal]
    start_date:               datetime
    end_date:                 Optional[datetime]
    usage_limit:              Optional[int]
    usage_limit_per_customer: Optional[int]
    usage_count:              int
    applicable_to:            str
    applicable_product_ids:   Optional[list]
    applicable_plan_ids:      Optional[list]
    is_stackable:             bool
    requires_coupon_code:     bool
    status:                   str
    created_by:               Optional[int]
    created_at:               datetime
    updated_at:               datetime
    model_config = {"from_attributes": True}


class DiscountListResponse(BaseModel):
    discounts:   List[DiscountResponse]
    total:       int
    page:        int
    page_size:   int
    total_pages: int


class DiscountStatsResponse(BaseModel):
    total:               int
    active:              int
    inactive:            int
    expired:             int
    archived:            int
    total_redemptions:   int


# ── Validation ────────────────────────────────────────────────────────────────

class DiscountValidateRequest(BaseModel):
    discount_code:   str
    customer_id:     int
    purchase_amount: Decimal
    currency:        str               = "INR"
    product_ids:     Optional[List[int]] = None
    plan_ids:        Optional[List[int]] = None
    context:         Optional[str]     = None   # "quotation" | "subscription" | "invoice"


class DiscountValidateResponse(BaseModel):
    valid:                bool
    reason:               str
    discount_code:        Optional[str]
    discount_amount:      Decimal
    final_amount:         Decimal
    applicable_rules:     List[str]
    discount_id:          Optional[int]


# ── Redemption ────────────────────────────────────────────────────────────────

class RedeemRequest(BaseModel):
    customer_id:     int
    purchase_amount: Decimal
    currency:        str               = "INR"
    product_ids:     Optional[List[int]] = None
    plan_ids:        Optional[List[int]] = None
    quotation_id:    Optional[int]     = None
    subscription_id: Optional[int]     = None
    invoice_id:      Optional[int]     = None


class RedemptionResponse(BaseModel):
    id:                int
    discount_id:       int
    customer_id:       int
    quotation_id:      Optional[int]
    subscription_id:   Optional[int]
    invoice_id:        Optional[int]
    redemption_amount: Decimal
    redeemed_at:       Optional[datetime]
    status:            str
    created_at:        datetime
    model_config = {"from_attributes": True}
