from fastapi import APIRouter

from app.api.v1 import health
from app.api.v1 import auth
from app.api.v1 import customers
from app.api.v1 import products
from app.api.v1 import plans
from app.api.v1 import quotations
from app.api.v1 import quotation_templates
from app.api.v1 import subscriptions
from app.api.v1 import invoices
from app.api.v1 import billing

api_router = APIRouter()

# ── Core ──────────────────────────────────────────────────────────────────────
api_router.include_router(health.router)

# ── Authentication ────────────────────────────────────────────────────────────
api_router.include_router(auth.router, prefix="/auth")

# ── Customers ─────────────────────────────────────────────────────────────────
api_router.include_router(customers.router, prefix="/customers")

# ── Products ──────────────────────────────────────────────────────────────────
api_router.include_router(products.router, prefix="/products")

# ── Subscription Plans ────────────────────────────────────────────────────────
api_router.include_router(plans.router, prefix="/plans")

# ── Quotations ────────────────────────────────────────────────────────────────
api_router.include_router(quotations.router,          prefix="/quotations")
api_router.include_router(quotation_templates.router, prefix="/quotation-templates")

# ── Subscriptions ─────────────────────────────────────────────────────────────
api_router.include_router(subscriptions.router, prefix="/subscriptions")

# ── Invoices & Billing ────────────────────────────────────────────────────────
api_router.include_router(invoices.router, prefix="/invoices")
api_router.include_router(billing.router,  prefix="/billing")

# ── Future modules ────────────────────────────────────────────────────────────
# api_router.include_router(payments.router, prefix="/payments")
# api_router.include_router(analytics.router, prefix="/analytics")
