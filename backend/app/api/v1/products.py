"""
REVORA – Product & ProductVariant API endpoints.
Versioned under /api/v1/products.

Authorization:
  Admin + Staff : full product and variant management
  Customer      : no access to product management endpoints
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin_staff
from app.database.session import get_db
from app.models.user import User
from app.schemas.product import (
    ProductCreateRequest, ProductDetailResponse, ProductListResponse,
    ProductResponse, ProductStatsResponse, ProductUpdateRequest,
    VariantCreateRequest, VariantResponse, VariantUpdateRequest,
)
from app.services.product_service import ProductService

router = APIRouter(tags=["Products"])


def get_service(db: Session = Depends(get_db)) -> ProductService:
    return ProductService(db)


# ── Stats (before /{id}) ──────────────────────────────────────────────────────

@router.get("/stats", response_model=ProductStatsResponse, summary="Product statistics")
def get_stats(
    _: User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.get_stats()


# ── List products ─────────────────────────────────────────────────────────────

@router.get("", response_model=ProductListResponse, summary="List products")
def list_products(
    page:         int            = Query(1,    ge=1),
    limit:        int            = Query(10,   ge=1, le=100),
    search:       Optional[str]  = Query(None),
    category:     Optional[str]  = Query(None),
    product_type: Optional[str]  = Query(None),
    billing_type: Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(None),
    sort_by:      str            = Query("created_at"),
    sort_dir:     str            = Query("desc"),
    _: User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.list_products(
        page=page, page_size=limit, search=search, category=category,
        product_type=product_type, billing_type=billing_type,
        is_active=is_active, sort_by=sort_by, sort_dir=sort_dir,
    )


# ── Create product ────────────────────────────────────────────────────────────

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, summary="Create product")
def create_product(
    data:    ProductCreateRequest,
    actor:   User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.create_product(data, actor=actor)


# ── Get product detail (with variants) ───────────────────────────────────────

@router.get("/{product_id}", response_model=ProductDetailResponse, summary="Product details")
def get_product(
    product_id: int,
    _: User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.get_product(product_id)


# ── Update product ────────────────────────────────────────────────────────────

@router.put("/{product_id}", response_model=ProductResponse, summary="Update product")
def update_product(
    product_id: int,
    data: ProductUpdateRequest,
    actor: User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.update_product(product_id, data, actor=actor)


# ── Deactivate product (safe delete) ─────────────────────────────────────────

@router.delete("/{product_id}", response_model=ProductResponse, summary="Deactivate product")
def deactivate_product(
    product_id: int,
    actor: User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.deactivate_product(product_id, actor=actor)


# ─────────────────────────────────────────────────────────────────────────────
# Variant endpoints  /products/{product_id}/variants
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/{product_id}/variants",
    response_model=VariantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create variant",
)
def create_variant(
    product_id: int,
    data: VariantCreateRequest,
    actor: User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.create_variant(product_id, data, actor=actor)


@router.get(
    "/{product_id}/variants",
    response_model=List[VariantResponse],
    summary="List variants",
)
def list_variants(
    product_id: int,
    _: User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.list_variants(product_id)


@router.get(
    "/{product_id}/variants/{variant_id}",
    response_model=VariantResponse,
    summary="Variant details",
)
def get_variant(
    product_id: int,
    variant_id: int,
    _: User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.get_variant(product_id, variant_id)


@router.put(
    "/{product_id}/variants/{variant_id}",
    response_model=VariantResponse,
    summary="Update variant",
)
def update_variant(
    product_id: int,
    variant_id: int,
    data: VariantUpdateRequest,
    actor: User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.update_variant(product_id, variant_id, data, actor=actor)


@router.delete(
    "/{product_id}/variants/{variant_id}",
    response_model=VariantResponse,
    summary="Deactivate variant",
)
def deactivate_variant(
    product_id: int,
    variant_id: int,
    actor: User = Depends(require_admin_staff),
    service: ProductService = Depends(get_service),
):
    return service.deactivate_variant(product_id, variant_id, actor=actor)
