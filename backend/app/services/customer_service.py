"""
REVORA – Customer Service.
Business logic layer for customer management operations.
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer, CustomerStatus
from app.models.user import User, UserRole
from app.repositories.customer_repository import CustomerRepository
from app.schemas.customer import (
    CustomerCreateRequest,
    CustomerDetailResponse,
    CustomerListResponse,
    CustomerResponse,
    CustomerStatsResponse,
    CustomerUpdateRequest,
)


class CustomerService:

    def __init__(self, db: Session) -> None:
        self.db   = db
        self.repo = CustomerRepository(db)

    # ── Create ────────────────────────────────────────────────────────────────

    def create_customer(
        self,
        data: CustomerCreateRequest,
        actor: User,
    ) -> CustomerResponse:
        # Uniqueness check
        if self.repo.email_exists(data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A customer with this email address already exists.",
            )

        customer = self.repo.create(data, created_by=actor.id)

        # Activity record
        self.repo.add_activity(
            customer_id=customer.id,
            event_type="customer.created",
            description=f"Customer profile created by {actor.full_name}.",
            actor_id=actor.id,
            actor_name=actor.full_name,
        )

        self.db.commit()
        self.db.refresh(customer)
        return CustomerResponse.model_validate(customer)

    # ── List ──────────────────────────────────────────────────────────────────

    def list_customers(
        self,
        actor: User,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        registered_after: Optional[datetime] = None,
        registered_before: Optional[datetime] = None,
    ) -> CustomerListResponse:

        # Customer-role users can only see their own record
        if actor.role == UserRole.CUSTOMER:
            customer = self.repo.get_by_email(actor.email)
            if not customer:
                return CustomerListResponse(
                    customers=[], total=0, page=1, page_size=page_size, total_pages=0,
                )
            return CustomerListResponse(
                customers=[CustomerResponse.model_validate(customer)],
                total=1, page=1, page_size=page_size, total_pages=1,
            )

        customers, total = self.repo.list(
            page=page,
            page_size=page_size,
            search=search,
            status=status,
            sort_by=sort_by,
            sort_dir=sort_dir,
            registered_after=registered_after,
            registered_before=registered_before,
        )

        total_pages = math.ceil(total / page_size) if page_size > 0 else 0

        return CustomerListResponse(
            customers=[CustomerResponse.model_validate(c) for c in customers],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    # ── Get detail ────────────────────────────────────────────────────────────

    def get_customer(self, customer_id: int, actor: User) -> CustomerDetailResponse:
        customer = self.repo.get_by_id(customer_id)   # eager-loads activities
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found.",
            )
        # Customer-role: may only see own record
        if actor.role == UserRole.CUSTOMER:
            own = self.repo.get_by_email(actor.email)
            if not own or own.id != customer_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to access this customer record.",
                )
        return CustomerDetailResponse.model_validate(customer)

    # ── Update ────────────────────────────────────────────────────────────────

    def update_customer(
        self,
        customer_id: int,
        data: CustomerUpdateRequest,
        actor: User,
    ) -> CustomerResponse:
        customer = self.repo.get_by_id_simple(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found.")

        # Email uniqueness if changed
        if data.email and data.email.lower() != customer.email:
            if self.repo.email_exists(data.email, exclude_id=customer_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Another customer with this email address already exists.",
                )

        old_status = customer.status
        customer   = self.repo.update(customer, data)

        # Activity
        changed = data.model_dump(exclude_unset=True, exclude_none=True)
        fields  = ", ".join(changed.keys()) if changed else "no fields"
        self.repo.add_activity(
            customer_id=customer.id,
            event_type="customer.updated",
            description=f"Customer profile updated by {actor.full_name}. Changed: {fields}.",
            actor_id=actor.id,
            actor_name=actor.full_name,
        )

        self.db.commit()
        self.db.refresh(customer)
        return CustomerResponse.model_validate(customer)

    # ── Status change ─────────────────────────────────────────────────────────

    def change_status(
        self,
        customer_id: int,
        new_status: CustomerStatus,
        actor: User,
    ) -> CustomerResponse:
        customer = self.repo.get_by_id_simple(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found.")

        old_status = customer.status
        customer   = self.repo.set_status(customer, new_status)

        event_map = {
            CustomerStatus.ACTIVE:   "customer.activated",
            CustomerStatus.INACTIVE: "customer.deactivated",
            CustomerStatus.ARCHIVED: "customer.archived",
        }
        self.repo.add_activity(
            customer_id=customer.id,
            event_type=event_map[new_status],
            description=f"Customer status changed from {old_status.value} to {new_status.value} by {actor.full_name}.",
            actor_id=actor.id,
            actor_name=actor.full_name,
        )

        self.db.commit()
        self.db.refresh(customer)
        return CustomerResponse.model_validate(customer)

    # ── Archive (safe delete) ─────────────────────────────────────────────────

    def archive_customer(self, customer_id: int, actor: User) -> CustomerResponse:
        return self.change_status(customer_id, CustomerStatus.ARCHIVED, actor)

    # ── Stats ─────────────────────────────────────────────────────────────────

    def get_stats(self) -> CustomerStatsResponse:
        data = self.repo.stats()
        return CustomerStatsResponse(**data)
