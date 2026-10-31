"""
REVORA – Shared pytest conftest.
Single StaticPool in-memory SQLite engine shared across all test modules.
Each test gets a fresh schema via autouse fixture.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# ── Single shared in-memory engine ────────────────────────────────────────────

engine_test = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

# ── Import app + register ALL model metadata, then hook DB override ────────────

import app.models  # noqa: F401 – registers all ORM tables in Base.metadata

from app.main import app as fastapi_app
from app.database.session import Base, get_db


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Single override — installed once, used by all tests
fastapi_app.dependency_overrides[get_db] = _override_get_db


# ── Per-test schema reset ──────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_db():
    """Drop and recreate all tables before each test for full isolation."""
    Base.metadata.drop_all(bind=engine_test)
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


@pytest.fixture
def client():
    return TestClient(fastapi_app)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
