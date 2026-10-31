"""
REVORA – Quotation & QuotationTemplate Pydantic schemas.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


# ── QuotationItem ─────────────────────────────────────────────────────────────

class QuotationItemCreate(BaseModel):
    product_id:          Optional[int]     = None
    variant_id:          Optional[int]     = None
    plan_id:             Optional[int]     = None
    description:         str
    quantity:            Decimal
    unit_price:          Decimal
    discount_percentage: Decimal           = Decimal("0")
    tax_percentage:      Decimal           = Decimal("0")

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Quantity must be greater than zero.")
        return v

    @field_validator("unit_price")
    @classmethod
    def price_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Unit price cannot be negative.")
        return v

    @field_validator("discount_percentage", "tax_percentage")
    @classmethod
    def pct_range(cls, v: Decimal) -> Decimal:
        if v < 0 or v > 100:
            raise ValueError("Percentage must be between 0 and 100.")
        return v

    @field_validator("description")
    @classmethod
    def desc_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Item description cannot be empty.")
        return v.strip()


class QuotationItemResponse(BaseModel):
    id:                  int
    quotation_id:        int
    product_id:          Optional[int]
    variant_id:          Optional[int]
    plan_id:             Optional[int]
    description:         str
    quantity:            Decimal
    unit_price:          Decimal
    discount_percentage: Decimal
    tax_percentage:      Decimal
    line_subtotal:       Decimal
    line_discount:       Decimal
    line_tax:            Decimal
    line_total:          Decimal

    model_config = {"from_attributes": True}


# ── Quotation ─────────────────────────────────────────────────────────────────

class QuotationCreateRequest(BaseModel):
    customer_id:          int
    quotation_date:       Optional[datetime] = None
    expiry_date:          Optional[datetime] = None
    currency:             str                = "INR"
    notes:                Optional[str]      = None
    terms_and_conditions: Optional[str]      = None
    items:                list[QuotationItemCreate] = []

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.strip().upper()


class QuotationUpdateRequest(BaseModel):
    quotation_date:       Optional[datetime]         = None
    expiry_date:          Optional[datetime]          = None
    currency:             Optional[str]               = None
    notes:                Optional[str]               = None
    terms_and_conditions: Optional[str]               = None
    items:                Optional[list[QuotationItemCreate]] = None

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v else v


class CustomerSummary(BaseModel):
    id:           int
    customer_code: str
    full_name:    str
    email:        str
    company_name: Optional[str]
    phone:        Optional[str]

    model_config = {"from_attributes": True}


class QuotationResponse(BaseModel):
    id:               int
    quotation_number: str
    customer_id:      int
    quotation_date:   datetime
    expiry_date:      Optional[datetime]
    status:           str
    currency:         str
    subtotal:         Decimal
    discount_amount:  Decimal
    tax_amount:       Decimal
    total_amount:     Decimal
    notes:            Optional[str]
    terms_and_conditions: Optional[str]
    created_by:       Optional[int]
    created_at:       datetime
    updated_at:       datetime

    model_config = {"from_attributes": True}


class QuotationDetailResponse(QuotationResponse):
    customer: Optional[CustomerSummary] = None
    items:    list[QuotationItemResponse] = []

    model_config = {"from_attributes": True}


class QuotationListResponse(BaseModel):
    quotations:  list[QuotationResponse]
    total:       int
    page:        int
    page_size:   int
    total_pages: int


class QuotationStatsResponse(BaseModel):
    total:     int
    draft:     int
    sent:      int
    accepted:  int
    rejected:  int
    expired:   int
    cancelled: int


# ── QuotationTemplate ─────────────────────────────────────────────────────────

class QuotationTemplateCreate(BaseModel):
    template_name:              str
    description:                Optional[str] = None
    default_notes:              Optional[str] = None
    default_terms_and_conditions: Optional[str] = None
    default_validity_days:      int           = 30
    is_active:                  bool          = True

    @field_validator("template_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Template name must be at least 2 characters.")
        return v

    @field_validator("default_validity_days")
    @classmethod
    def validity_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Validity days must be at least 1.")
        return v


class QuotationTemplateUpdate(BaseModel):
    template_name:              Optional[str]  = None
    description:                Optional[str]  = None
    default_notes:              Optional[str]  = None
    default_terms_and_conditions: Optional[str] = None
    default_validity_days:      Optional[int]  = None
    is_active:                  Optional[bool] = None


class QuotationTemplateResponse(BaseModel):
    id:                           int
    template_name:                str
    description:                  Optional[str]
    default_notes:                Optional[str]
    default_terms_and_conditions: Optional[str]
    default_validity_days:        int
    is_active:                    bool
    created_by:                   Optional[int]
    created_at:                   datetime
    updated_at:                   datetime

    model_config = {"from_attributes": True}


class TemplateListResponse(BaseModel):
    templates:   list[QuotationTemplateResponse]
    total:       int
    page:        int
    page_size:   int
    total_pages: int
