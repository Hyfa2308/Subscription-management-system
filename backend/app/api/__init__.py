from fastapi import APIRouter

api_router = APIRouter()

from app.api.v1 import api_router as v1_router  # noqa: E402

__all__ = ["api_router", "v1_router"]
