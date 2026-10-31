"""
REVORA – Health check endpoint.
GET /api/v1/health
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.session import get_db
from app.core.config import get_settings

router = APIRouter(tags=["Health"])
settings = get_settings()


class HealthResponse(BaseModel):
    status: str
    message: str
    version: str
    environment: str
    timestamp: str
    database: str


@router.get("/health", response_model=HealthResponse, summary="Platform health check")
async def health_check(db: Session = Depends(get_db)) -> HealthResponse:
    """
    Returns a JSON payload confirming the backend is running,
    along with database connectivity status.
    """
    # Probe the database
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:  # noqa: BLE001
        db_status = f"error: {exc}"

    return HealthResponse(
        status="ok",
        message="REVORA backend is running",
        version=settings.app_version,
        environment=settings.app_env,
        timestamp=datetime.now(timezone.utc).isoformat(),
        database=db_status,
    )
