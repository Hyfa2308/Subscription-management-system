"""
REVORA – FastAPI Application Entry Point
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.core.exceptions import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.api.v1 import api_router
from app.database.session import Base, engine
import app.models  # noqa: F401 – ensures all tables registered in Base.metadata

settings = get_settings()


# ── Startup / Shutdown lifecycle ───────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan:
      - On startup: create database tables if they don't exist.
      - On shutdown: nothing needed (SQLAlchemy handles connection cleanup).
    """
    # Create all tables defined in models (safe to call on every startup)
    Base.metadata.create_all(bind=engine)
    print(f"✅  REVORA {settings.app_version} started [{settings.app_env}]")
    print(f"📦  Database: {settings.effective_database_url.split('://')[0].upper()}")
    yield
    print("🛑  REVORA shutting down…")


# ── Application factory ────────────────────────────────────────────────────────

app = FastAPI(
    title="REVORA API",
    description=(
        "**REVORA – Subscription Management & Revenue Intelligence Platform**\n\n"
        "Manage subscriptions. Automate billing. Predict risks. Protect revenue.\n\n"
        "_Built for Brightloop Software._"
    ),
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception handlers ─────────────────────────────────────────────────────────

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# ── Routes ─────────────────────────────────────────────────────────────────────

app.include_router(api_router, prefix="/api/v1")


# ── Root redirect ──────────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root():
    return {
        "product": "REVORA",
        "tagline": "Manage subscriptions. Automate billing. Predict risks. Protect revenue.",
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/v1/health",
    }
