"""
REVORA – Product Service.
Business logic for product and variant management.
"""

from __future__ import annotations

import math
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.product import Product, ProductVariant
from app.models.user import User, UserRole
from app.repositories.product_repository import ProductRepository
from app.schemas.product import (
    ProductCreateRequest, ProductDetailResponse, ProductListResponse,
    ProductResponse, ProductStatsResponse, ProductUpdateRequest,
    VariantCreateRequest, VariantResponse, VariantUpdateRequest,
)


class ProductService:

    def __init__(self, db: Session) -> None:
        self.db   = db
        self.repo = ProductRepository(db)

    # ── Products ──────────────────────────────────────────────────────────────

    def create_product(self, data: ProductCreateRequest, actor: User) -> ProductResponse:
        if self.repo.name_exists(data.product_name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A product with this name already exists.",
            )
        product = self.repo.create_product(data, created_by=actor.id)
        self.db.commit()
        self.db.refresh(product)
        return ProductResponse.model_validate(product)

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
    ) -> ProductListResponse:
        products, total = self.repo.list_products(
            page=page, page_size=page_size, search=search, category=category,
            product_type=product_type, billing_type=billing_type,
            is_active=is_active, sort_by=sort_by, sort_dir=sort_dir,
        )
        total_pages = math.ceil(total / page_size) if page_size > 0 else 0
        return ProductListResponse(
            products=[ProductResponse.model_validate(p) for p in products],
            total=total, page=page, page_size=page_size, total_pages=total_pages,
        )

    def get_product(self, product_id: int) -> ProductDetailResponse:
        product = self.repo.get_product(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found.")
        return ProductDetailResponse.model_validate(product)

    def update_product(
        self, product_id: int, data: ProductUpdateRequest, actor: User,
    ) -> ProductResponse:
        product = self.repo.get_product(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found.")
        if data.product_name:
            if self.repo.name_exists(data.product_name, exclude_id=product_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Another product with this name already exists.",
                )
        product = self.repo.update_product(product, data)
        self.db.commit()
        self.db.refresh(product)
        return ProductResponse.model_validate(product)

    def deactivate_product(self, product_id: int, actor: User) -> ProductResponse:
        product = self.repo.get_product(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found.")
        product = self.repo.deactivate_product(product)
        self.db.commit()
        self.db.refresh(product)
        return ProductResponse.model_validate(product)

    def get_stats(self) -> ProductStatsResponse:
        return ProductStatsResponse(**self.repo.stats())

    # ── Variants ──────────────────────────────────────────────────────────────

    def _get_or_404(self, product_id: int) -> Product:
        p = self.repo.get_product(product_id)
        if not p:
            raise HTTPException(status_code=404, detail="Product not found.")
        return p

    def create_variant(
        self, product_id: int, data: VariantCreateRequest, actor: User,
    ) -> VariantResponse:
        product = self._get_or_404(product_id)
        variant = self.repo.create_variant(product, data)
        self.db.commit()
        self.db.refresh(variant)
        return VariantResponse.model_validate(variant)

    def list_variants(self, product_id: int) -> list[VariantResponse]:
        self._get_or_404(product_id)
        variants = self.repo.list_variants(product_id)
        return [VariantResponse.model_validate(v) for v in variants]

    def get_variant(self, product_id: int, variant_id: int) -> VariantResponse:
        self._get_or_404(product_id)
        variant = self.repo.get_variant(variant_id, product_id)
        if not variant:
            raise HTTPException(status_code=404, detail="Variant not found.")
        return VariantResponse.model_validate(variant)

    def update_variant(
        self, product_id: int, variant_id: int,
        data: VariantUpdateRequest, actor: User,
    ) -> VariantResponse:
        product = self._get_or_404(product_id)
        variant = self.repo.get_variant(variant_id, product_id)
        if not variant:
            raise HTTPException(status_code=404, detail="Variant not found.")
        variant = self.repo.update_variant(variant, data, base_price=product.base_price)
        self.db.commit()
        self.db.refresh(variant)
        return VariantResponse.model_validate(variant)

    def deactivate_variant(
        self, product_id: int, variant_id: int, actor: User,
    ) -> VariantResponse:
        self._get_or_404(product_id)
        variant = self.repo.get_variant(variant_id, product_id)
        if not variant:
            raise HTTPException(status_code=404, detail="Variant not found.")
        variant = self.repo.deactivate_variant(variant)
        self.db.commit()
        self.db.refresh(variant)
        return VariantResponse.model_validate(variant)
