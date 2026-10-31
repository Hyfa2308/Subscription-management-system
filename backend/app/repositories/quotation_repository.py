"""
REVORA – Quotation & QuotationTemplate Repository.
"""

from __future__ import annotations

import math
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.quotation import (
    Quotation, QuotationItem, QuotationStatus, QuotationTemplate,
)
from app.models.customer import Customer
from app.schemas.quotation import (
    QuotationCreateRequest, QuotationItemCreate,
    QuotationUpdateRequest, QuotationTemplateCreate, QuotationTemplateUpdate,
)


class QuotationRepository:

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Lookups ───────────────────────────────────────────────────────────────

    def get_customer(self, customer_id: int) -> Optional[Customer]:
        return self.db.get(Customer, customer_id)

    def get(self, quotation_id: int) -> Optional[Quotation]:
        return (
            self.db.execute(
                select(Quotation)
                .where(Quotation.id == quotation_id)
                .options(
                    selectinload(Quotation.customer),
                    selectinload(Quotation.items),
                )
            )
            .scalars().first()
        )

    def number_exists(self, number: str) -> bool:
        return self.db.execute(
            select(Quotation.id).where(Quotation.quotation_number == number)
        ).first() is not None

    # ── Create ────────────────────────────────────────────────────────────────

    def create(
        self,
        data: QuotationCreateRequest,
        created_by: Optional[int] = None,
    ) -> Quotation:
        from datetime import timezone
        now = __import__("datetime").datetime.now(timezone.utc)

        q = Quotation(
            customer_id=data.customer_id,
            quotation_date=data.quotation_date or now,
            expiry_date=data.expiry_date,
            currency=data.currency,
            notes=data.notes,
            terms_and_conditions=data.terms_and_conditions,
            created_by=created_by,
            status=QuotationStatus.DRAFT,
        )
        self.db.add(q)
        self.db.flush()  # get id

        created_items = []
        for item_data in data.items:
            created_items.append(self._create_item(q.id, item_data))

        self.db.flush()
        self._recalc_totals_from(q, created_items)
        self.db.flush()
        return q

    def _create_item(self, quotation_id: int, data: QuotationItemCreate) -> QuotationItem:
        item = QuotationItem(
            quotation_id=quotation_id,
            product_id=data.product_id,
            variant_id=data.variant_id,
            plan_id=data.plan_id,
            description=data.description,
            quantity=data.quantity,
            unit_price=data.unit_price,
            discount_percentage=data.discount_percentage,
            tax_percentage=data.tax_percentage,
        )
        item.recalculate()
        self.db.add(item)
        return item

    def _recalc_totals(self, q: Quotation) -> None:
        """Re-aggregate from relationship (use after commit/refresh)."""
        self._recalc_totals_from(q, list(q.items))

    def _recalc_totals_from(self, q: Quotation, items: list) -> None:
        """Aggregate provided item objects into quotation-level totals."""
        from decimal import Decimal
        sub = disc = tax = Decimal("0")
        for item in items:
            sub  += item.line_subtotal
            disc += item.line_discount
            tax  += item.line_tax
        q.subtotal        = sub
        q.discount_amount = disc
        q.tax_amount      = tax
        q.total_amount    = sub - disc + tax

    # ── Update ────────────────────────────────────────────────────────────────

    def update(self, q: Quotation, data: QuotationUpdateRequest) -> Quotation:
        if data.quotation_date is not None: q.quotation_date = data.quotation_date
        if data.expiry_date    is not None: q.expiry_date    = data.expiry_date
        if data.currency       is not None: q.currency       = data.currency
        if data.notes          is not None: q.notes          = data.notes
        if data.terms_and_conditions is not None:
            q.terms_and_conditions = data.terms_and_conditions

        if data.items is not None:
            # Delete existing items first
            self.db.execute(
                __import__("sqlalchemy").delete(QuotationItem).where(QuotationItem.quotation_id == q.id)
            )
            self.db.flush()
            new_items = []
            for item_data in data.items:
                new_items.append(self._create_item(q.id, item_data))
            self.db.flush()
            self._recalc_totals_from(q, new_items)
        else:
            self._recalc_totals(q)

        self.db.flush()
        return q

    def update_status(self, q: Quotation, new_status: QuotationStatus) -> Quotation:
        q.status = new_status
        self.db.flush()
        return q

    # ── List ──────────────────────────────────────────────────────────────────

    def list(
        self,
        page: int = 1, page_size: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        customer_id: Optional[int] = None,
        sort_by: str = "created_at", sort_dir: str = "desc",
    ) -> tuple[list[Quotation], int]:

        stmt = select(Quotation)

        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.outerjoin(Customer, Quotation.customer_id == Customer.id).where(
                or_(
                    Quotation.quotation_number.ilike(q),
                    Customer.full_name.ilike(q),
                    Customer.company_name.ilike(q),
                )
            )
        if status:
            try:
                stmt = stmt.where(Quotation.status == QuotationStatus(status.lower()))
            except ValueError:
                pass
        if customer_id:
            stmt = stmt.where(Quotation.customer_id == customer_id)

        total = self.db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()

        sort_col = getattr(Quotation, sort_by, Quotation.created_at)
        stmt = stmt.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        return list(self.db.execute(stmt).scalars().all()), total

    # ── Stats ─────────────────────────────────────────────────────────────────

    def stats(self) -> dict:
        rows = self.db.execute(
            select(Quotation.status, func.count().label("cnt"))
            .group_by(Quotation.status)
        ).all()
        counts = {r[0].value: r[1] for r in rows}
        total = sum(counts.values())
        return {
            "total":     total,
            "draft":     counts.get("draft",     0),
            "sent":      counts.get("sent",      0),
            "accepted":  counts.get("accepted",  0),
            "rejected":  counts.get("rejected",  0),
            "expired":   counts.get("expired",   0),
            "cancelled": counts.get("cancelled", 0),
        }


# ── QuotationTemplate Repository ─────────────────────────────────────────────

class TemplateRepository:

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, template_id: int) -> Optional[QuotationTemplate]:
        return self.db.get(QuotationTemplate, template_id)

    def name_exists(self, name: str, exclude_id: Optional[int] = None) -> bool:
        stmt = select(QuotationTemplate.id).where(
            func.lower(QuotationTemplate.template_name) == name.lower().strip()
        )
        if exclude_id:
            stmt = stmt.where(QuotationTemplate.id != exclude_id)
        return self.db.execute(stmt).first() is not None

    def create(self, data: QuotationTemplateCreate, created_by: Optional[int] = None) -> QuotationTemplate:
        t = QuotationTemplate(
            template_name=data.template_name,
            description=data.description,
            default_notes=data.default_notes,
            default_terms_and_conditions=data.default_terms_and_conditions,
            default_validity_days=data.default_validity_days,
            is_active=data.is_active,
            created_by=created_by,
        )
        self.db.add(t)
        self.db.flush()
        return t

    def update(self, t: QuotationTemplate, data: QuotationTemplateUpdate) -> QuotationTemplate:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(t, field, value)
        self.db.flush()
        return t

    def delete(self, t: QuotationTemplate) -> None:
        self.db.delete(t)
        self.db.flush()

    def list(
        self,
        page: int = 1, page_size: int = 20,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> tuple[list[QuotationTemplate], int]:
        stmt = select(QuotationTemplate)
        if is_active is not None:
            stmt = stmt.where(QuotationTemplate.is_active == is_active)
        if search:
            stmt = stmt.where(QuotationTemplate.template_name.ilike(f"%{search}%"))
        total = self.db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
        stmt = stmt.order_by(QuotationTemplate.template_name.asc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        return list(self.db.execute(stmt).scalars().all()), total
