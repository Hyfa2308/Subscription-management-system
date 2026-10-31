"""
REVORA – Quotation Templates API router.
/api/v1/quotation-templates — Admin + Staff only.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin_staff
from app.database.session import get_db
from app.models.user import User
from app.schemas.quotation import (
    QuotationTemplateCreate, QuotationTemplateResponse,
    QuotationTemplateUpdate, TemplateListResponse,
)
from app.services.quotation_service import TemplateService

router = APIRouter(tags=["Quotation Templates"])


def get_service(db: Session = Depends(get_db)) -> TemplateService:
    return TemplateService(db)


@router.get("", response_model=TemplateListResponse)
def list_templates(
    page:      int            = Query(1,   ge=1),
    limit:     int            = Query(20,  ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    search:    Optional[str]  = Query(None),
    _: User = Depends(require_admin_staff),
    service: TemplateService = Depends(get_service),
):
    return service.list_templates(page=page, page_size=limit, is_active=is_active, search=search)


@router.post("", response_model=QuotationTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    data:    QuotationTemplateCreate,
    actor:   User = Depends(require_admin_staff),
    service: TemplateService = Depends(get_service),
):
    return service.create(data, actor=actor)


@router.get("/{template_id}", response_model=QuotationTemplateResponse)
def get_template(
    template_id: int,
    _: User = Depends(require_admin_staff),
    service: TemplateService = Depends(get_service),
):
    return service.get(template_id)


@router.put("/{template_id}", response_model=QuotationTemplateResponse)
def update_template(
    template_id: int,
    data:    QuotationTemplateUpdate,
    actor:   User = Depends(require_admin_staff),
    service: TemplateService = Depends(get_service),
):
    return service.update(template_id, data, actor=actor)


@router.delete("/{template_id}", response_model=QuotationTemplateResponse)
def delete_template(
    template_id: int,
    actor:   User = Depends(require_admin_staff),
    service: TemplateService = Depends(get_service),
):
    return service.delete(template_id, actor=actor)
