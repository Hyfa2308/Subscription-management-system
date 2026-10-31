"""
REVORA – Dashboard API router.
/api/v1/dashboard — Admin + Staff only.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin_staff
from app.database.session import get_db
from app.models.user import User
from app.services.dashboard_service import DashboardService

router = APIRouter(tags=["Dashboard"])


def get_service(db: Session = Depends(get_db)) -> DashboardService:
    return DashboardService(db)


@router.get("/overview")
def overview(
    days: int = Query(30, ge=1, le=365, description="Look-back window in days for growth metrics"),
    _: User = Depends(require_admin_staff),
    service: DashboardService = Depends(get_service),
):
    return service.overview(days=days)


@router.get("/revenue-trend")
def revenue_trend(
    months: int = Query(6, ge=1, le=24),
    _: User = Depends(require_admin_staff),
    service: DashboardService = Depends(get_service),
):
    return service.revenue_trend(months=months)


@router.get("/subscription-trend")
def subscription_trend(
    months: int = Query(6, ge=1, le=24),
    _: User = Depends(require_admin_staff),
    service: DashboardService = Depends(get_service),
):
    return service.subscription_trend(months=months)


@router.get("/customer-trend")
def customer_trend(
    months: int = Query(6, ge=1, le=24),
    _: User = Depends(require_admin_staff),
    service: DashboardService = Depends(get_service),
):
    return service.customer_trend(months=months)


@router.get("/recent-activities")
def recent_activities(
    limit: int = Query(15, ge=1, le=50),
    _: User = Depends(require_admin_staff),
    service: DashboardService = Depends(get_service),
):
    return service.recent_activities(limit=limit)


@router.get("/upcoming-renewals")
def upcoming_renewals(
    days:  int = Query(30, ge=1, le=90),
    limit: int = Query(10, ge=1, le=50),
    _: User = Depends(require_admin_staff),
    service: DashboardService = Depends(get_service),
):
    return service.upcoming_renewals(days=days, limit=limit)


@router.get("/alerts")
def alerts(
    _: User = Depends(require_admin_staff),
    service: DashboardService = Depends(get_service),
):
    return service.alerts()
