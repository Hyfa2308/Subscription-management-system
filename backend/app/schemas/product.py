"""
REVORA – Product and ProductVariant Pydantic schemas.
Uses Decimal throughout for financial precision.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, field_validator


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip(v: str | None) -> str | None:
    return v.strip() if v else v


# ─────────────────────────────────────────────────────────────────────────────
# Product schemas
# ─────────────────────────────────────────────────────────────────────────────

class ProductCreateRequest(BaseModel):
    product_name:   str
    description:    Optional[str]  = None
    category:       Optional[str]  = None
    product_type:   str            = "subscription"   # "one_time" | "subscription"
    billing_type:   str            = "recurring"      # "one_time" | "recurring"
    base_price:     Decimal        = Decimal("0.00")
    currency:       str            = "INR"
    tax_percentage: Decimal        = Decimal("0.00")
    is_active:      bool           = True

    @field_validator("product_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Product name must be at least 2 characters.")
        return v

    @field_validator("base_price")
    @classmethod
    def price_non_negative(cls, v: Decimal) -> Decimal:
        if v < Decimal("0"):
            raise ValueError("Base price cannot be negative.")
        return v

    @field_validator("tax_percentage")
    @classmethod
    def tax_range(cls, v: Decimal) -> Decimal:
        if v < Decimal("0") or v > Decimal("100"):
            raise ValueError("Tax percentage must be between 0 and 100.")
        return v

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("product_type")
    @classmethod
    def validate_product_type(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in ("one_time", "subscription"):
            raise ValueError("product_type must be 'one_time' or 'subscription'.")
        return v

    @field_validator("billing_type")
    @classmethod
    def validate_billing_type(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in ("one_time", "recurring"):
            raise ValueError("billing_type must be 'one_time' or 'recurring'.")
        return v

    @field_validator("description", "category", mode="before")
    @classmethod
    def strip_strings(cls, v):
        return _strip(v)


class ProductUpdateRequest(BaseModel):
    product_name:   Optional[str]     = None
    description:    Optional[str]     = None
    category:       Optional[str]     = None
    product_type:   Optional[str]     = None
    billing_type:   Optional[str]     = None
    base_price:     Optional[Decimal] = None
    currency:       Optional[str]     = None
    tax_percentage: Optional[Decimal] = None
    is_active:      Optional[bool]    = None

    @field_validator("product_name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is None: return None
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Product name must be at least 2 characters.")
        return v

    @field_validator("base_price")
    @classmethod
    def price_non_negative(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < Decimal("0"):
            raise ValueError("Base price cannot be negative.")
        return v

    @field_validator("tax_percentage")
    @classmethod
    def tax_range(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and (v < Decimal("0") or v > Decimal("100")):
            raise ValueError("Tax percentage must be between 0 and 100.")
        return v


# ─────────────────────────────────────────────────────────────────────────────
# Variant schemas
# ─────────────────────────────────────────────────────────────────────────────

class VariantCreateRequest(BaseModel):
    variant_name:     str
    description:      Optional[str] = None
    price_adjustment: Decimal       = Decimal("0.00")
    is_active:        bool          = True

    @field_validator("variant_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Variant name is required.")
        return v

    @field_validator("description", mode="before")
    @classmethod
    def strip_desc(cls, v):
        return _strip(v)


class VariantUpdateRequest(BaseModel):
    variant_name:     Optional[str]     = None
    description:      Optional[str]     = None
    price_adjustment: Optional[Decimal] = None
    is_active:        Optional[bool]    = None


# ─────────────────────────────────────────────────────────────────────────────
# Response schemas
# ─────────────────────────────────────────────────────────────────────────────

class VariantResponse(BaseModel):
    id:               int
    variant_code:     str
    variant_name:     str
    description:      Optional[str]
    price_adjustment: Decimal
    final_price:      Decimal
    is_active:        bool
    created_at:       datetime
    updated_at:       datetime

    model_config = {"from_attributes": True}


class ProductResponse(BaseModel):
    id:             int
    product_code:   str
    product_name:   str
    description:    Optional[str]
    category:       Optional[str]
    product_type:   str
    billing_type:   str
    base_price:     Decimal
    currency:       str
    tax_percentage: Decimal
    is_active:      bool
    created_by:     Optional[int]
    created_at:     datetime
    updated_at:     datetime

    model_config = {"from_attributes": True}


class ProductDetailResponse(ProductResponse):
    variants: List[VariantResponse] = []

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    products:    List[ProductResponse]
    total:       int
    page:        int
    page_size:   int
    total_pages: int


class ProductStatsResponse(BaseModel):
    total:        int
    active:       int
    inactive:     int
    subscription: int
    one_time:     int
    with_variants: int
