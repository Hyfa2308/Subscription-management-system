"""
REVORA – Customer API endpoints.
Versioned under /api/v1/customers.

Authorization:
  Admin + Staff  : full CRUD access
  Customer       : read-only own record
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_active_user,
    require_admin_staff,
    require_any,
)
from app.database.session import get_db
from app.models.customer import CustomerStatus
from app.models.user import User, UserRole
from app.schemas.customer import (
    CustomerCreateRequest,
    CustomerDetailResponse,
    CustomerListResponse,
    CustomerResponse,
    CustomerStatusUpdateRequest,
    CustomerStatsResponse,
    CustomerUpdateRequest,
)
from app.services.customer_service import CustomerService

router = APIRouter(tags=["Customers"])


def get_service(db: Session = Depends(get_db)) -> CustomerService:
    return CustomerService(db)


# ── Statistics — placed BEFORE /{id} to avoid route conflict ─────────────────

@router.get(
    "/stats",
    response_model=CustomerStatsResponse,
    summary="Get customer statistics",
)
def get_customer_stats(
    _: User = Depends(require_admin_staff),
    service: CustomerService = Depends(get_service),
):
    """Returns real-time customer counts broken down by status and time period."""
    return service.get_stats()


# ── List customers ────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=CustomerListResponse,
    summary="List customers",
)
def list_customers(
    page:              int            = Query(1,    ge=1),
    limit:             int            = Query(10,   ge=1, le=100),
    search:            Optional[str]  = Query(None),
    status:            Optional[str]  = Query(None),
    sort_by:           str            = Query("created_at"),
    sort_dir:          str            = Query("desc"),
    registered_after:  Optional[datetime] = Query(None),
    registered_before: Optional[datetime] = Query(None),
    current_user: User                = Depends(get_current_active_user),
    service: CustomerService          = Depends(get_service),
):
    return service.list_customers(
        actor=current_user,
        page=page,
        page_size=limit,
        search=search,
        status=status,
        sort_by=sort_by,
        sort_dir=sort_dir,
        registered_after=registered_after,
        registered_before=registered_before,
    )


# ── Create customer ───────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new customer",
)
def create_customer(
    data:         CustomerCreateRequest,
    current_user: User                 = Depends(require_admin_staff),
    service: CustomerService           = Depends(get_service),
):
    return service.create_customer(data, actor=current_user)


# ── Get customer detail ───────────────────────────────────────────────────────

@router.get(
    "/{customer_id}",
    response_model=CustomerDetailResponse,
    summary="Get customer details",
)
def get_customer(
    customer_id:  int,
    current_user: User            = Depends(get_current_active_user),
    service: CustomerService      = Depends(get_service),
):
    return service.get_customer(customer_id, actor=current_user)


# ── Update customer ───────────────────────────────────────────────────────────

@router.put(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Update customer",
)
def update_customer(
    customer_id:  int,
    data:         CustomerUpdateRequest,
    current_user: User               = Depends(require_admin_staff),
    service: CustomerService         = Depends(get_service),
):
    return service.update_customer(customer_id, data, actor=current_user)


# ── Status change ─────────────────────────────────────────────────────────────

@router.patch(
    "/{customer_id}/status",
    response_model=CustomerResponse,
    summary="Change customer status",
)
def change_status(
    customer_id:  int,
    data:         CustomerStatusUpdateRequest,
    current_user: User                       = Depends(require_admin_staff),
    service: CustomerService                 = Depends(get_service),
):
    try:
        new_status = CustomerStatus(data.status.lower())
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status!r}")
    return service.change_status(customer_id, new_status, actor=current_user)


# ── Archive customer (safe delete) ────────────────────────────────────────────

@router.delete(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Archive customer (soft delete)",
)
def archive_customer(
    customer_id:  int,
    current_user: User           = Depends(require_admin_staff),
    service: CustomerService     = Depends(get_service),
):
    """Archives the customer instead of deleting to preserve referential integrity."""
    return service.archive_customer(customer_id, actor=current_user)
