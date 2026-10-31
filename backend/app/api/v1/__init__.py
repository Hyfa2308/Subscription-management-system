"""
REVORA – v1 API Router aggregator.
All v1 endpoint routers are registered here.
"""

from fastapi import APIRouter

from app.api.v1 import health
from app.api.v1 import auth

api_router = APIRouter()

# ── Core ──────────────────────────────────────────────────────────────────────
api_router.include_router(health.router)

# ── Authentication ────────────────────────────────────────────────────────────
api_router.include_router(auth.router, prefix="/auth")

# ── Future modules (uncomment as implemented) ─────────────────────────────────
# api_router.include_router(customers.router, prefix="/customers")
# api_router.include_router(products.router, prefix="/products")
# api_router.include_router(subscriptions.router, prefix="/subscriptions")
# api_router.include_router(invoices.router, prefix="/invoices")
# api_router.include_router(payments.router, prefix="/payments")
# api_router.include_router(analytics.router, prefix="/analytics")
