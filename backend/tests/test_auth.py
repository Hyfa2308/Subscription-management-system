"""
REVORA – Authentication API tests.

Uses SQLAlchemy StaticPool so all connections (TestClient + fixtures) share the
same in-memory SQLite database within a single test process.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import timedelta

# ── Shared in-memory engine via StaticPool ─────────────────────────────────────
engine_test = create_engine(
    "sqlite://",                       # in-memory
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,              # single shared connection
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

# ── App imports ────────────────────────────────────────────────────────────────
from app.main import app as fastapi_app
from app.database.session import Base, get_db
from app.models.user import User, UserRole
from app.core.security import create_access_token, hash_password
import app.models  # noqa: F401 – ensures all models are in metadata


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


fastapi_app.dependency_overrides[get_db] = override_get_db

# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def setup_db():
    """Create tables before each test and drop them after."""
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


# ── Helper ─────────────────────────────────────────────────────────────────────

def create_user(db, email="test@example.com", password="Test1234",
                role=UserRole.CUSTOMER, is_active=True):
    user = User(
        full_name="Test User",
        email=email.lower(),
        hashed_password=hash_password(password),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Successful registration
# ═══════════════════════════════════════════════════════════════════════════════

def test_register_success(client):
    resp = client.post("/api/v1/auth/register", json={
        "full_name": "Jane Smith",
        "email": "jane@example.com",
        "password": "Secure1234",
        "confirm_password": "Secure1234",
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["email"] == "jane@example.com"
    assert data["role"] == "customer"
    assert "hashed_password" not in data


# 2. Invalid email
def test_register_invalid_email(client):
    resp = client.post("/api/v1/auth/register", json={
        "full_name": "Bad Email",
        "email": "not-an-email",
        "password": "Secure1234",
        "confirm_password": "Secure1234",
    })
    assert resp.status_code == 422, resp.text


# 3. Duplicate email
def test_register_duplicate_email(client, db):
    create_user(db, email="dup@example.com")
    resp = client.post("/api/v1/auth/register", json={
        "full_name": "Dup",
        "email": "dup@example.com",
        "password": "Secure1234",
        "confirm_password": "Secure1234",
    })
    assert resp.status_code == 409, resp.text


# 4. Weak password
def test_register_weak_password(client):
    resp = client.post("/api/v1/auth/register", json={
        "full_name": "Weak",
        "email": "weak@example.com",
        "password": "abc",
        "confirm_password": "abc",
    })
    assert resp.status_code == 422, resp.text


# 5. Password mismatch
def test_register_password_mismatch(client):
    resp = client.post("/api/v1/auth/register", json={
        "full_name": "Mismatch",
        "email": "mm@example.com",
        "password": "Secure1234",
        "confirm_password": "Different1",
    })
    assert resp.status_code == 422, resp.text


# 6. Successful login
def test_login_success(client, db):
    create_user(db, email="login@example.com", password="Test1234")
    resp = client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "Test1234",
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "login@example.com"


# 7. Incorrect password
def test_login_wrong_password(client, db):
    create_user(db, email="wrong@example.com", password="Test1234")
    resp = client.post("/api/v1/auth/login", json={
        "email": "wrong@example.com",
        "password": "WrongPass1",
    })
    assert resp.status_code == 401, resp.text


# 8. Inactive account login
def test_login_inactive_account(client, db):
    create_user(db, email="inactive@example.com", is_active=False)
    resp = client.post("/api/v1/auth/login", json={
        "email": "inactive@example.com",
        "password": "Test1234",
    })
    assert resp.status_code == 403, resp.text


# 9. Get current user (me)
def test_me_success(client, db):
    user = create_user(db, email="me@example.com")
    token = create_access_token(str(user.id))
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["email"] == "me@example.com"


# 10. Expired JWT
def test_expired_token(client, db):
    user = create_user(db)
    token = create_access_token(str(user.id), expires_delta=timedelta(seconds=-1))
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401, resp.text


# 11. Invalid JWT
def test_invalid_token(client):
    resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer totally.invalid.token"})
    assert resp.status_code == 401, resp.text


# 12. Password reset flow (dev mode)
def test_password_reset_flow(client, db):
    create_user(db, email="reset@example.com", password="OldPass1")
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "reset@example.com"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "message" in data
    reset_token = data.get("dev_reset_token")
    if reset_token:
        resp2 = client.post("/api/v1/auth/reset-password", json={
            "token": reset_token,
            "new_password": "NewPass99",
            "confirm_password": "NewPass99",
        })
        assert resp2.status_code == 200, resp2.text
        resp3 = client.post("/api/v1/auth/login", json={
            "email": "reset@example.com",
            "password": "NewPass99",
        })
        assert resp3.status_code == 200, resp3.text


# 13. Admin authorization
def test_admin_can_access_me(client, db):
    admin = create_user(db, email="admin@example.com", role=UserRole.ADMIN)
    token = create_access_token(str(admin.id))
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["role"] == "admin"


# 14. Staff authorization
def test_staff_can_access_me(client, db):
    staff = create_user(db, email="staff@example.com", role=UserRole.STAFF)
    token = create_access_token(str(staff.id))
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["role"] == "staff"


# 15. Public registration cannot set ADMIN role
def test_register_cannot_set_admin_role(client):
    resp = client.post("/api/v1/auth/register", json={
        "full_name": "Hacker",
        "email": "hacker@example.com",
        "password": "Secure1234",
        "confirm_password": "Secure1234",
        "role": "admin",
    })
    if resp.status_code == 201:
        assert resp.json()["role"] == "customer"
    else:
        assert resp.status_code == 422
