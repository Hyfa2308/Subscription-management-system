"""
REVORA – Subscription Plan API tests.
15 test scenarios. Engine/fixtures from conftest.py.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.models.user import User, UserRole
from app.models.product import Product, ProductVariant
from app.core.security import create_access_token, hash_password


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_admin(db, email="admin@test.com"):
    user = User(
        full_name="Admin", email=email,
        hashed_password=hash_password("Test1234"),
        role=UserRole.ADMIN, is_active=True,
    )
    db.add(user); db.commit(); db.refresh(user)
    return user


def make_product(db, name="Cloud Suite", price="999.00", is_active=True):
    p = Product(
        product_name=name, base_price=Decimal(price),
        currency="INR", tax_percentage=Decimal("18.00"),
        is_active=is_active,
        product_type="subscription", billing_type="recurring",
    )
    db.add(p); db.commit(); db.refresh(p)
    return p


def make_variant(db, product, name="Standard", adj="0.00"):
    v = ProductVariant(
        product_id=product.id, variant_name=name,
        price_adjustment=Decimal(adj),
        final_price=product.base_price + Decimal(adj),
        is_active=True,
    )
    db.add(v); db.commit(); db.refresh(v)
    return v


def auth_headers(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def plan_payload(product_id: int, **overrides) -> dict:
    return {
        "plan_name": "Standard Monthly",
        "description": "Monthly cloud subscription",
        "product_id": product_id,
        "plan_price": "999.00",
        "currency": "INR",
        "setup_fee": "0.00",
        "tax_percentage": "18.00",
        "billing_frequency": "monthly",
        "billing_interval": 1,
        "trial_period_days": 14,
        "discount_allowed": True,
        "pause_allowed": True,
        "renewal_allowed": True,
        "early_closure_allowed": False,
        "status": "active",
        **overrides,
    }


# ── 1. Create plan ─────────────────────────────────────────────────────────────

def test_create_plan(client, db):
    admin = make_admin(db)
    product = make_product(db)
    r = client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin))
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["plan_code"].startswith("PLAN-")
    assert d["plan_name"] == "Standard Monthly"
    assert d["status"] == "active"
    assert d["product"]["id"] == product.id


# ── 2. Reject duplicate plan name ──────────────────────────────────────────────

def test_reject_duplicate_name(client, db):
    admin = make_admin(db)
    product = make_product(db)
    client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin))
    r = client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin))
    assert r.status_code == 409


# ── 3. Reject inactive product ─────────────────────────────────────────────────

def test_reject_inactive_product(client, db):
    admin = make_admin(db)
    product = make_product(db, is_active=False)
    r = client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin))
    assert r.status_code == 400


# ── 4. Reject invalid billing interval ────────────────────────────────────────

def test_reject_invalid_billing_interval(client, db):
    admin = make_admin(db)
    product = make_product(db)
    r = client.post("/api/v1/plans", json=plan_payload(product.id, billing_interval=0), headers=auth_headers(admin))
    assert r.status_code == 422


# ── 5. Reject negative price ───────────────────────────────────────────────────

def test_reject_negative_price(client, db):
    admin = make_admin(db)
    product = make_product(db)
    r = client.post("/api/v1/plans", json=plan_payload(product.id, plan_price="-10.00"), headers=auth_headers(admin))
    assert r.status_code == 422


# ── 6. Reject invalid tax ──────────────────────────────────────────────────────

def test_reject_invalid_tax(client, db):
    admin = make_admin(db)
    product = make_product(db)
    r = client.post("/api/v1/plans", json=plan_payload(product.id, tax_percentage="120.00"), headers=auth_headers(admin))
    assert r.status_code == 422


# ── 7. Create plan with variant ────────────────────────────────────────────────

def test_create_plan_with_variant(client, db):
    admin = make_admin(db)
    product = make_product(db)
    variant = make_variant(db, product, name="Premium", adj="200.00")
    r = client.post(
        "/api/v1/plans",
        json=plan_payload(product.id, variant_id=variant.id, plan_price="1199.00"),
        headers=auth_headers(admin),
    )
    assert r.status_code == 201
    assert r.json()["variant"]["id"] == variant.id


# ── 8. Reject variant from wrong product ──────────────────────────────────────

def test_reject_variant_wrong_product(client, db):
    admin = make_admin(db)
    p1 = make_product(db, name="Product 1")
    p2 = make_product(db, name="Product 2")
    variant = make_variant(db, p2)
    r = client.post(
        "/api/v1/plans",
        json=plan_payload(p1.id, variant_id=variant.id),
        headers=auth_headers(admin),
    )
    assert r.status_code == 400


# ── 9. List plans ──────────────────────────────────────────────────────────────

def test_list_plans(client, db):
    admin = make_admin(db)
    product = make_product(db)
    client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin))
    r = client.get("/api/v1/plans", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["total"] >= 1


# ── 10. Search plans ────────────────────────────────────────────────────────────

def test_search_plans(client, db):
    admin = make_admin(db)
    product = make_product(db)
    client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin))
    r = client.get("/api/v1/plans?search=monthly", headers=auth_headers(admin))
    assert r.json()["total"] >= 1
    r2 = client.get("/api/v1/plans?search=nonexistent_xyz_123", headers=auth_headers(admin))
    assert r2.json()["total"] == 0


# ── 11. Filter by billing frequency ───────────────────────────────────────────

def test_filter_by_billing_frequency(client, db):
    admin = make_admin(db)
    product = make_product(db)
    client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin))
    r = client.get("/api/v1/plans?billing_frequency=monthly", headers=auth_headers(admin))
    assert r.json()["total"] >= 1
    r2 = client.get("/api/v1/plans?billing_frequency=yearly", headers=auth_headers(admin))
    assert r2.json()["total"] == 0


# ── 12. Get plan detail ────────────────────────────────────────────────────────

def test_get_plan_detail(client, db):
    admin = make_admin(db)
    product = make_product(db)
    created = client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin)).json()
    r = client.get(f"/api/v1/plans/{created['id']}", headers=auth_headers(admin))
    assert r.status_code == 200
    d = r.json()
    assert d["product"]["product_name"] == "Cloud Suite"
    assert d["trial_period_days"] == 14


# ── 13. Update plan ────────────────────────────────────────────────────────────

def test_update_plan(client, db):
    admin = make_admin(db)
    product = make_product(db)
    created = client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin)).json()
    r = client.put(
        f"/api/v1/plans/{created['id']}",
        json={"plan_name": "Premium Monthly", "plan_price": "1499.00", "trial_period_days": 30},
        headers=auth_headers(admin),
    )
    assert r.status_code == 200
    assert r.json()["plan_name"] == "Premium Monthly"
    assert Decimal(r.json()["plan_price"]) == Decimal("1499.00")
    assert r.json()["trial_period_days"] == 30


# ── 14. Archive plan ────────────────────────────────────────────────────────────

def test_archive_plan(client, db):
    admin = make_admin(db)
    product = make_product(db)
    created = client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin)).json()
    r = client.delete(f"/api/v1/plans/{created['id']}", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["status"] == "archived"


# ── 15. Stats and RBAC ─────────────────────────────────────────────────────────

def test_stats_and_rbac(client, db):
    admin = make_admin(db)
    product = make_product(db)
    client.post("/api/v1/plans", json=plan_payload(product.id), headers=auth_headers(admin))

    r = client.get("/api/v1/plans/stats", headers=auth_headers(admin))
    assert r.status_code == 200
    d = r.json()
    assert d["total"] >= 1
    assert d["active"] >= 1
    assert d["most_popular_frequency"] == "monthly"

    # No token → 401
    r2 = client.get("/api/v1/plans")
    assert r2.status_code == 401
