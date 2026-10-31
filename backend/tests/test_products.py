"""
REVORA – Product & Variant API tests.
Engine/fixtures provided by conftest.py.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.models.user import User, UserRole
from app.core.security import create_access_token, hash_password


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_admin(db, email="admin@test.com"):
    user = User(
        full_name="Admin User", email=email,
        hashed_password=hash_password("Test1234"),
        role=UserRole.ADMIN, is_active=True,
    )
    db.add(user); db.commit(); db.refresh(user)
    return user


def auth_headers(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


BASE_PRODUCT = {
    "product_name":   "Cloud Storage Pro",
    "description":    "Enterprise cloud storage",
    "category":       "Cloud",
    "product_type":   "subscription",
    "billing_type":   "recurring",
    "base_price":     "299.99",
    "currency":       "INR",
    "tax_percentage": "18.00",
}


# ── 1. Create product ──────────────────────────────────────────────────────────

def test_create_product(client, db):
    admin = make_admin(db)
    r = client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin))
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["product_code"].startswith("PROD-")
    assert d["product_name"] == "Cloud Storage Pro"
    assert d["is_active"] is True
    assert Decimal(d["base_price"]) == Decimal("299.99")


# ── 2. Reject duplicate name ───────────────────────────────────────────────────

def test_reject_duplicate_name(client, db):
    admin = make_admin(db)
    client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin))
    r = client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin))
    assert r.status_code == 409


# ── 3. Reject negative price ───────────────────────────────────────────────────

def test_reject_negative_price(client, db):
    admin = make_admin(db)
    r = client.post("/api/v1/products", json={**BASE_PRODUCT, "base_price": "-1.00"}, headers=auth_headers(admin))
    assert r.status_code == 422


# ── 4. Reject invalid tax percentage ──────────────────────────────────────────

def test_reject_invalid_tax(client, db):
    admin = make_admin(db)
    r = client.post("/api/v1/products", json={**BASE_PRODUCT, "tax_percentage": "150"}, headers=auth_headers(admin))
    assert r.status_code == 422


# ── 5. List products ───────────────────────────────────────────────────────────

def test_list_products(client, db):
    admin = make_admin(db)
    client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin))
    r = client.get("/api/v1/products", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["total"] >= 1


# ── 6. Search products ─────────────────────────────────────────────────────────

def test_search_products(client, db):
    admin = make_admin(db)
    client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin))
    r = client.get("/api/v1/products?search=cloud", headers=auth_headers(admin))
    assert r.json()["total"] >= 1
    r2 = client.get("/api/v1/products?search=nonexistent_xyz", headers=auth_headers(admin))
    assert r2.json()["total"] == 0


# ── 7. Filter products ─────────────────────────────────────────────────────────

def test_filter_products(client, db):
    admin = make_admin(db)
    client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin))
    r = client.get("/api/v1/products?product_type=subscription", headers=auth_headers(admin))
    assert r.json()["total"] >= 1
    r2 = client.get("/api/v1/products?product_type=one_time", headers=auth_headers(admin))
    assert r2.json()["total"] == 0


# ── 8. Get product detail ──────────────────────────────────────────────────────

def test_get_product_detail(client, db):
    admin = make_admin(db)
    created = client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin)).json()
    r = client.get(f"/api/v1/products/{created['id']}", headers=auth_headers(admin))
    assert r.status_code == 200
    assert "variants" in r.json()


# ── 9. Update product ──────────────────────────────────────────────────────────

def test_update_product(client, db):
    admin = make_admin(db)
    created = client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin)).json()
    r = client.put(
        f"/api/v1/products/{created['id']}",
        json={"product_name": "Cloud Storage Enterprise", "base_price": "399.99"},
        headers=auth_headers(admin),
    )
    assert r.status_code == 200
    assert r.json()["product_name"] == "Cloud Storage Enterprise"
    assert Decimal(r.json()["base_price"]) == Decimal("399.99")


# ── 10. Deactivate product ─────────────────────────────────────────────────────

def test_deactivate_product(client, db):
    admin = make_admin(db)
    created = client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin)).json()
    r = client.delete(f"/api/v1/products/{created['id']}", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["is_active"] is False


# ── 11. Create variant ─────────────────────────────────────────────────────────

def test_create_variant(client, db):
    admin = make_admin(db)
    prod = client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin)).json()
    r = client.post(
        f"/api/v1/products/{prod['id']}/variants",
        json={"variant_name": "Standard", "price_adjustment": "0.00"},
        headers=auth_headers(admin),
    )
    assert r.status_code == 201
    d = r.json()
    assert d["variant_code"].startswith("VAR-")
    assert Decimal(d["final_price"]) == Decimal("299.99")


# ── 12. Variant final price calculation ────────────────────────────────────────

def test_variant_price_calculation(client, db):
    admin = make_admin(db)
    prod = client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin)).json()
    r1 = client.post(
        f"/api/v1/products/{prod['id']}/variants",
        json={"variant_name": "Premium", "price_adjustment": "100.00"},
        headers=auth_headers(admin),
    )
    assert Decimal(r1.json()["final_price"]) == Decimal("399.99")
    r2 = client.post(
        f"/api/v1/products/{prod['id']}/variants",
        json={"variant_name": "Basic", "price_adjustment": "-100.00"},
        headers=auth_headers(admin),
    )
    assert Decimal(r2.json()["final_price"]) == Decimal("199.99")


# ── 13. Reject negative final price ────────────────────────────────────────────

def test_reject_negative_final_price(client, db):
    admin = make_admin(db)
    prod = client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin)).json()
    r = client.post(
        f"/api/v1/products/{prod['id']}/variants",
        json={"variant_name": "Free", "price_adjustment": "-9999.00"},
        headers=auth_headers(admin),
    )
    assert r.status_code == 400


# ── 14. Update variant & recalculate ──────────────────────────────────────────

def test_update_variant(client, db):
    admin = make_admin(db)
    prod = client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin)).json()
    var = client.post(
        f"/api/v1/products/{prod['id']}/variants",
        json={"variant_name": "Standard", "price_adjustment": "0.00"},
        headers=auth_headers(admin),
    ).json()
    r = client.put(
        f"/api/v1/products/{prod['id']}/variants/{var['id']}",
        json={"price_adjustment": "50.00"},
        headers=auth_headers(admin),
    )
    assert r.status_code == 200
    assert Decimal(r.json()["final_price"]) == Decimal("349.99")


# ── 15. Stats and RBAC ────────────────────────────────────────────────────────

def test_stats_and_rbac(client, db):
    admin = make_admin(db)
    client.post("/api/v1/products", json=BASE_PRODUCT, headers=auth_headers(admin))

    r = client.get("/api/v1/products/stats", headers=auth_headers(admin))
    assert r.status_code == 200
    d = r.json()
    assert d["total"] >= 1
    assert "active" in d and "subscription" in d

    r2 = client.get("/api/v1/products")
    assert r2.status_code == 401
