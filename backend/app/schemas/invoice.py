"""
REVORA – Invoice Pydantic schemas.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, field_validator


# ── Item schemas ──────────────────────────────────────────────────────────────

class InvoiceItemCreate(BaseModel):
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
        if not (Decimal("0") <= v <= Decimal("100")):
            raise ValueError("Percentage must be between 0 and 100.")
        return v


class InvoiceItemResponse(BaseModel):
    id:                  int
    invoice_id:          int
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


# ── Invoice schemas ───────────────────────────────────────────────────────────

class InvoiceCreateRequest(BaseModel):
    customer_id:          int
    subscription_id:      Optional[int]      = None
    quotation_id:         Optional[int]      = None
    invoice_date:         datetime
    due_date:             Optional[datetime] = None
    billing_period_start: Optional[datetime] = None
    billing_period_end:   Optional[datetime] = None
    currency:             str                = "INR"
    notes:                Optional[str]      = None
    terms_and_conditions: Optional[str]      = None
    items:                List[InvoiceItemCreate] = []


class InvoiceUpdateRequest(BaseModel):
    due_date:             Optional[datetime] = None
    notes:                Optional[str]      = None
    terms_and_conditions: Optional[str]      = None


class CustomerSummary(BaseModel):
    id:           int
    customer_code: str
    full_name:    str
    email:        str
    company_name: Optional[str] = None
    phone:        Optional[str] = None
    model_config = {"from_attributes": True}


class SubscriptionSummary(BaseModel):
    id:                  int
    subscription_number: str
    snap_plan_name:      Optional[str]
    billing_frequency:   str
    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id:                   int
    invoice_number:       str
    customer_id:          int
    subscription_id:      Optional[int]
    quotation_id:         Optional[int]
    invoice_date:         datetime
    due_date:             Optional[datetime]
    billing_period_start: Optional[datetime]
    billing_period_end:   Optional[datetime]
    currency:             str
    subtotal:             Decimal
    discount_amount:      Decimal
    tax_amount:           Decimal
    total_amount:         Decimal
    amount_paid:          Decimal
    amount_due:           Decimal
    status:               str
    notes:                Optional[str]
    terms_and_conditions: Optional[str]
    created_by:           Optional[int]
    created_at:           datetime
    updated_at:           datetime
    model_config = {"from_attributes": True}


class InvoiceDetailResponse(InvoiceResponse):
    customer:     Optional[CustomerSummary]     = None
    subscription: Optional[SubscriptionSummary] = None
    items:        List[InvoiceItemResponse]      = []
    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    invoices:    List[InvoiceResponse]
    total:       int
    page:        int
    page_size:   int
    total_pages: int


class InvoiceStatsResponse(BaseModel):
    total:              int
    draft:              int
    unpaid:             int
    partially_paid:     int
    paid:               int
    overdue:            int
    cancelled:          int
    total_outstanding:  Decimal
    total_paid_amount:  Decimal


# ── Billing schemas ───────────────────────────────────────────────────────────

class BillingRunResponse(BaseModel):
    id:               int
    triggered_by:     Optional[int]
    started_at:       datetime
    finished_at:      Optional[datetime]
    status:           str
    processed:        int
    invoices_created: int
    skipped:          int
    errors:           int
    error_detail:     Optional[str]
    dry_run:          bool
    model_config = {"from_attributes": True}


class BillingRunRequest(BaseModel):
    dry_run: bool = False


class UpcomingBillingItem(BaseModel):
    subscription_id:     int
    subscription_number: str
    customer_id:         int
    customer_name:       str
    plan_name:           Optional[str]
    next_billing_date:   datetime
    billing_frequency:   str
    expected_amount:     Decimal
    currency:            str
    days_until_due:      int
