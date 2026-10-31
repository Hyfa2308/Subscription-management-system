"""
REVORA – Product Repository.
All database queries for Product and ProductVariant models.
Uses Decimal arithmetic throughout for financial precision.
"""

from __future__ import annotations

import math
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.product import Product, ProductVariant, ProductType, BillingType
from app.schemas.product import (
    ProductCreateRequest, ProductUpdateRequest,
    VariantCreateRequest, VariantUpdateRequest,
)


class ProductRepository:

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Product CRUD ──────────────────────────────────────────────────────────

    def create_product(
        self,
        data: ProductCreateRequest,
        created_by: Optional[int] = None,
    ) -> Product:
        product = Product(
            product_name=data.product_name,
            description=data.description,
            category=data.category,
            product_type=ProductType(data.product_type),
            billing_type=BillingType(data.billing_type),
            base_price=data.base_price,
            currency=data.currency,
            tax_percentage=data.tax_percentage,
            is_active=data.is_active,
            created_by=created_by,
        )
        self.db.add(product)
        self.db.flush()
        return product

    def get_product(self, product_id: int) -> Optional[Product]:
        return (
            self.db.execute(
                select(Product)
                .where(Product.id == product_id)
                .options(selectinload(Product.variants))
            )
            .scalars().first()
        )

    def get_product_simple(self, product_id: int) -> Optional[Product]:
        return self.db.get(Product, product_id)

    def name_exists(self, name: str, exclude_id: Optional[int] = None) -> bool:
        stmt = select(Product.id).where(
            func.lower(Product.product_name) == name.lower().strip()
        )
        if exclude_id:
            stmt = stmt.where(Product.id != exclude_id)
        return self.db.execute(stmt).first() is not None

    def list_products(
        self,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        category: Optional[str] = None,
        product_type: Optional[str] = None,
        billing_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
    ) -> tuple[list[Product], int]:

        stmt = select(Product)

        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Product.product_name.ilike(q),
                    Product.product_code.ilike(q),
                    Product.category.ilike(q),
                )
            )
        if category:
            stmt = stmt.where(Product.category.ilike(f"%{category}%"))
        if product_type:
            try:
                stmt = stmt.where(Product.product_type == ProductType(product_type.lower()))
            except ValueError:
                pass
        if billing_type:
            try:
                stmt = stmt.where(Product.billing_type == BillingType(billing_type.lower()))
            except ValueError:
                pass
        if is_active is not None:
            stmt = stmt.where(Product.is_active == is_active)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total: int = self.db.execute(count_stmt).scalar_one()

        sort_col = getattr(Product, sort_by, Product.created_at)
        stmt = stmt.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        products = list(self.db.execute(stmt).scalars().all())
        return products, total

    def update_product(self, product: Product, data: ProductUpdateRequest) -> Product:
        update_data = data.model_dump(exclude_unset=True)
        if "product_type" in update_data and update_data["product_type"]:
            update_data["product_type"] = ProductType(update_data["product_type"])
        if "billing_type" in update_data and update_data["billing_type"]:
            update_data["billing_type"] = BillingType(update_data["billing_type"])
        for field, value in update_data.items():
            setattr(product, field, value)
        self.db.flush()
        # Recalculate all variant final prices if base_price changed
        if "base_price" in update_data:
            for v in product.variants:
                v.recalculate_final_price()
            self.db.flush()
        return product

    def deactivate_product(self, product: Product) -> Product:
        product.is_active = False
        for variant in product.variants:
            variant.is_active = False
        self.db.flush()
        return product

    def stats(self) -> dict:
        total    = self.db.execute(select(func.count(Product.id))).scalar_one()
        active   = self.db.execute(select(func.count(Product.id)).where(Product.is_active == True)).scalar_one()
        inactive = self.db.execute(select(func.count(Product.id)).where(Product.is_active == False)).scalar_one()
        sub_type = self.db.execute(
            select(func.count(Product.id)).where(Product.product_type == ProductType.SUBSCRIPTION)
        ).scalar_one()
        one_type = self.db.execute(
            select(func.count(Product.id)).where(Product.product_type == ProductType.ONE_TIME)
        ).scalar_one()
        # Products that have at least one variant
        with_var = self.db.execute(
            select(func.count(func.distinct(ProductVariant.product_id)))
        ).scalar_one()
        return {
            "total": total,
            "active": active,
            "inactive": inactive,
            "subscription": sub_type,
            "one_time": one_type,
            "with_variants": with_var,
        }

    # ── Variant CRUD ──────────────────────────────────────────────────────────

    def create_variant(
        self,
        product: Product,
        data: VariantCreateRequest,
    ) -> ProductVariant:
        final = product.base_price + data.price_adjustment
        if final < Decimal("0"):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail=f"Final price (base {product.base_price} + adjustment {data.price_adjustment} = {final}) cannot be negative.",
            )
        variant = ProductVariant(
            product_id=product.id,
            variant_name=data.variant_name,
            description=data.description,
            price_adjustment=data.price_adjustment,
            final_price=final,
            is_active=data.is_active,
        )
        self.db.add(variant)
        self.db.flush()
        return variant

    def get_variant(self, variant_id: int, product_id: int) -> Optional[ProductVariant]:
        return (
            self.db.execute(
                select(ProductVariant).where(
                    ProductVariant.id == variant_id,
                    ProductVariant.product_id == product_id,
                )
            )
            .scalars().first()
        )

    def list_variants(self, product_id: int) -> list[ProductVariant]:
        return list(
            self.db.execute(
                select(ProductVariant)
                .where(ProductVariant.product_id == product_id)
                .order_by(ProductVariant.created_at)
            )
            .scalars().all()
        )

    def update_variant(
        self,
        variant: ProductVariant,
        data: VariantUpdateRequest,
        base_price: Decimal,
    ) -> ProductVariant:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(variant, field, value)
        # Recalculate final price
        adj = variant.price_adjustment or Decimal("0")
        final = base_price + adj
        if final < Decimal("0"):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail=f"Final price cannot be negative (base {base_price} + adjustment {adj} = {final}).",
            )
        variant.final_price = final
        self.db.flush()
        return variant

    def deactivate_variant(self, variant: ProductVariant) -> ProductVariant:
        variant.is_active = False
        self.db.flush()
        return variant
