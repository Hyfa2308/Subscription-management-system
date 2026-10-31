"""
REVORA – Customer Repository.
All database queries for the Customer and CustomerActivity models.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.customer import Customer, CustomerActivity, CustomerStatus
from app.schemas.customer import CustomerCreateRequest, CustomerUpdateRequest


class CustomerRepository:

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Create ────────────────────────────────────────────────────────────────

    def create(
        self,
        data: CustomerCreateRequest,
        created_by: Optional[int] = None,
    ) -> Customer:
        customer = Customer(
            full_name=data.full_name,
            email=data.email.lower(),
            phone=data.phone,
            company_name=data.company_name,
            billing_address=data.billing_address,
            city=data.city,
            state=data.state,
            country=data.country,
            postal_code=data.postal_code,
            created_by=created_by,
        )
        self.db.add(customer)
        self.db.flush()   # get id / customer_code before commit
        return customer

    # ── Read ──────────────────────────────────────────────────────────────────

    def get_by_id(self, customer_id: int) -> Optional[Customer]:
        return (
            self.db.execute(
                select(Customer)
                .where(Customer.id == customer_id)
                .options(selectinload(Customer.activities))
            )
            .scalars()
            .first()
        )

    def get_by_id_simple(self, customer_id: int) -> Optional[Customer]:
        return self.db.get(Customer, customer_id)

    def get_by_email(self, email: str) -> Optional[Customer]:
        return (
            self.db.execute(
                select(Customer).where(Customer.email == email.lower())
            )
            .scalars()
            .first()
        )

    def get_by_customer_code(self, code: str) -> Optional[Customer]:
        return (
            self.db.execute(
                select(Customer).where(Customer.customer_code == code)
            )
            .scalars()
            .first()
        )

    def email_exists(self, email: str, exclude_id: Optional[int] = None) -> bool:
        stmt = select(Customer.id).where(Customer.email == email.lower())
        if exclude_id:
            stmt = stmt.where(Customer.id != exclude_id)
        return self.db.execute(stmt).first() is not None

    # ── List / Search / Filter / Paginate ─────────────────────────────────────

    def list(
        self,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        registered_after: Optional[datetime] = None,
        registered_before: Optional[datetime] = None,
    ) -> tuple[list[Customer], int]:

        stmt = select(Customer)

        # Search
        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Customer.full_name.ilike(q),
                    Customer.email.ilike(q),
                    Customer.company_name.ilike(q),
                    Customer.customer_code.ilike(q),
                )
            )

        # Status filter
        if status:
            try:
                status_enum = CustomerStatus(status.lower())
                stmt = stmt.where(Customer.status == status_enum)
            except ValueError:
                pass   # ignore unknown status values

        # Date filters
        if registered_after:
            stmt = stmt.where(Customer.registration_date >= registered_after)
        if registered_before:
            stmt = stmt.where(Customer.registration_date <= registered_before)

        # Count before pagination
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total: int = self.db.execute(count_stmt).scalar_one()

        # Sorting
        sort_col = getattr(Customer, sort_by, Customer.created_at)
        stmt = stmt.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())

        # Pagination
        offset = (page - 1) * page_size
        stmt = stmt.offset(offset).limit(page_size)

        customers = list(self.db.execute(stmt).scalars().all())
        return customers, total

    # ── Update ────────────────────────────────────────────────────────────────

    def update(self, customer: Customer, data: CustomerUpdateRequest) -> Customer:
        update_data = data.model_dump(exclude_unset=True)
        if "email" in update_data and update_data["email"]:
            update_data["email"] = update_data["email"].lower()
        for field, value in update_data.items():
            setattr(customer, field, value)
        self.db.flush()
        return customer

    def set_status(self, customer: Customer, status: CustomerStatus) -> Customer:
        customer.status = status
        self.db.flush()
        return customer

    # ── Stats ─────────────────────────────────────────────────────────────────

    def stats(self) -> dict:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        week_start  = now - timedelta(days=now.weekday())

        total    = self.db.execute(select(func.count(Customer.id))).scalar_one()
        active   = self.db.execute(select(func.count(Customer.id)).where(Customer.status == CustomerStatus.ACTIVE)).scalar_one()
        inactive = self.db.execute(select(func.count(Customer.id)).where(Customer.status == CustomerStatus.INACTIVE)).scalar_one()
        archived = self.db.execute(select(func.count(Customer.id)).where(Customer.status == CustomerStatus.ARCHIVED)).scalar_one()
        new_month = self.db.execute(
            select(func.count(Customer.id)).where(Customer.registration_date >= month_start)
        ).scalar_one()
        new_week = self.db.execute(
            select(func.count(Customer.id)).where(Customer.registration_date >= week_start)
        ).scalar_one()

        return {
            "total": total,
            "active": active,
            "inactive": inactive,
            "archived": archived,
            "new_this_month": new_month,
            "new_this_week": new_week,
        }

    # ── Activity ──────────────────────────────────────────────────────────────

    def add_activity(
        self,
        customer_id: int,
        event_type: str,
        description: str,
        actor_id: Optional[int] = None,
        actor_name: Optional[str] = None,
    ) -> CustomerActivity:
        activity = CustomerActivity(
            customer_id=customer_id,
            event_type=event_type,
            description=description,
            actor_id=actor_id,
            actor_name=actor_name,
        )
        self.db.add(activity)
        self.db.flush()
        return activity
