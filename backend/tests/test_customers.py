"""
REVORA – Customer API tests.
Engine/fixtures provided by conftest.py.
"""

from __future__ import annotations

import pytest

from app.models.user import User, UserRole
from app.models.customer import Customer, CustomerStatus
from app.core.security import create_access_token, hash_password


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_user(db, email="admin@test.com", role=UserRole.ADMIN):
    user = User(
        full_name="Admin User",
        email=email,
        hashed_password=hash_password("Test1234"),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_headers(user: User) -> dict:
    token = create_access_token(str(user.id))
    return {"Authorization": f"Bearer {token}"}


PAYLOAD = {
    "full_name": "Acme Corp",
    "email": "acme@example.com",
    "phone": "+1-555-0100",
    "company_name": "Acme Inc",
    "billing_address": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "country": "US",
    "postal_code": "78701",
}


# ── 1. Create customer ─────────────────────────────────────────────────────────

def test_create_customer(client, db):
    admin = make_user(db)
    r = client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin))
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["email"] == "acme@example.com"
    assert data["customer_code"].startswith("CUST-")
    assert data["status"] == "active"


# ── 2. Reject invalid email ────────────────────────────────────────────────────

def test_reject_invalid_email(client, db):
    admin = make_user(db)
    bad = {**PAYLOAD, "email": "not-an-email"}
    r = client.post("/api/v1/customers", json=bad, headers=auth_headers(admin))
    assert r.status_code == 422


# ── 3. Reject duplicate email ──────────────────────────────────────────────────

def test_reject_duplicate_email(client, db):
    admin = make_user(db)
    client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin))
    r = client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin))
    assert r.status_code == 409


# ── 4. List customers ──────────────────────────────────────────────────────────

def test_list_customers(client, db):
    admin = make_user(db)
    client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin))
    r = client.get("/api/v1/customers", headers=auth_headers(admin))
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 1
    assert "customers" in data


# ── 5. Search customers ────────────────────────────────────────────────────────

def test_search_customers(client, db):
    admin = make_user(db)
    client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin))
    r = client.get("/api/v1/customers?search=acme", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["total"] >= 1

    r2 = client.get("/api/v1/customers?search=nonexistent_xyz", headers=auth_headers(admin))
    assert r2.json()["total"] == 0


# ── 6. Filter by status ────────────────────────────────────────────────────────

def test_filter_by_status(client, db):
    admin = make_user(db)
    client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin))
    r = client.get("/api/v1/customers?status=active", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["total"] >= 1

    r2 = client.get("/api/v1/customers?status=archived", headers=auth_headers(admin))
    assert r2.json()["total"] == 0


# ── 7. Paginate customers ──────────────────────────────────────────────────────

def test_paginate_customers(client, db):
    admin = make_user(db)
    for i in range(5):
        client.post("/api/v1/customers", json={**PAYLOAD, "email": f"c{i}@example.com"}, headers=auth_headers(admin))
    r = client.get("/api/v1/customers?page=1&limit=2", headers=auth_headers(admin))
    data = r.json()
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert len(data["customers"]) == 2
    assert data["total_pages"] >= 3


# ── 8. Get customer details ────────────────────────────────────────────────────

def test_get_customer_details(client, db):
    admin = make_user(db)
    created = client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin)).json()
    r = client.get(f"/api/v1/customers/{created['id']}", headers=auth_headers(admin))
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == created["id"]
    assert "activities" in data
    assert len(data["activities"]) >= 1


# ── 9. Update customer ─────────────────────────────────────────────────────────

def test_update_customer(client, db):
    admin = make_user(db)
    created = client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin)).json()
    r = client.put(
        f"/api/v1/customers/{created['id']}",
        json={"company_name": "Updated Corp"},
        headers=auth_headers(admin),
    )
    assert r.status_code == 200
    assert r.json()["company_name"] == "Updated Corp"


# ── 10. Archive customer ───────────────────────────────────────────────────────

def test_archive_customer(client, db):
    admin = make_user(db)
    created = client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin)).json()
    r = client.delete(f"/api/v1/customers/{created['id']}", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["status"] == "archived"


# ── 11. Reject unauthorized access (no token) ─────────────────────────────────

def test_reject_unauthorized(client, db):
    r = client.get("/api/v1/customers")
    assert r.status_code == 401


# ── 12. Customer-role ownership restriction ────────────────────────────────────

def test_customer_ownership_restriction(client, db):
    admin     = make_user(db, email="admin@test.com",  role=UserRole.ADMIN)
    cust_user = make_user(db, email="jane@example.com", role=UserRole.CUSTOMER)
    client.post("/api/v1/customers", json={**PAYLOAD, "email": "jane@example.com"}, headers=auth_headers(admin))
    other = client.post("/api/v1/customers", json={**PAYLOAD, "email": "other@example.com"}, headers=auth_headers(admin)).json()
    r = client.get(f"/api/v1/customers/{other['id']}", headers=auth_headers(cust_user))
    assert r.status_code == 403


# ── 13. Archived customer visible in filter ────────────────────────────────────

def test_archived_customer_visible_in_filter(client, db):
    admin   = make_user(db)
    created = client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin)).json()
    client.delete(f"/api/v1/customers/{created['id']}", headers=auth_headers(admin))
    r = client.get("/api/v1/customers?status=archived", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["total"] >= 1


# ── Bonus: Stats ───────────────────────────────────────────────────────────────

def test_get_stats(client, db):
    admin = make_user(db)
    client.post("/api/v1/customers", json=PAYLOAD, headers=auth_headers(admin))
    r = client.get("/api/v1/customers/stats", headers=auth_headers(admin))
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 1
    assert "active" in data
    assert "new_this_month" in data
