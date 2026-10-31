"""
REVORA – Quotation API tests (16 scenarios).
Engine/fixtures from conftest.py.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal

import pytest

from app.models.user import User, UserRole
from app.models.customer import Customer, CustomerStatus
from app.models.product import Product
from app.core.security import create_access_token, hash_password


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_admin(db, email="admin@test.com"):
    u = User(full_name="Admin", email=email,
             hashed_password=hash_password("Test1234"),
             role=UserRole.ADMIN, is_active=True)
    db.add(u); db.commit(); db.refresh(u); return u


def make_customer_record(db, email="cust@acme.com"):
    c = Customer(
        full_name="Acme Corp", email=email,
        status=CustomerStatus.ACTIVE,
    )
    db.add(c); db.commit(); db.refresh(c); return c


def make_product(db, name="Basic SaaS", price="500.00"):
    p = Product(product_name=name, base_price=Decimal(price), currency="INR",
                tax_percentage=Decimal("18.00"), is_active=True,
                product_type="subscription", billing_type="recurring")
    db.add(p); db.commit(); db.refresh(p); return p


def auth(u): return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


def qt_payload(customer_id: int, product_id: int, **kw) -> dict:
    return {
        "customer_id": customer_id,
        "currency": "INR",
        "items": [{
            "product_id": product_id,
            "description": "Basic SaaS — 1 year",
            "quantity": "2",
            "unit_price": "500.00",
            "discount_percentage": "10",
            "tax_percentage": "18",
        }],
        **kw,
    }


# ── 1. Create quotation ────────────────────────────────────────────────────────

def test_create_quotation(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    r = client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin))
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["quotation_number"].startswith("QT-")
    assert d["status"] == "draft"
    assert d["customer"]["id"] == cust.id
    assert len(d["items"]) == 1


# ── 2. Financial calculations ──────────────────────────────────────────────────

def test_financial_calculations(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    r = client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin))
    assert r.status_code == 201
    d = r.json()
    # qty=2, unit=500, disc=10%, tax=18%
    # subtotal = 2*500 = 1000
    # discount = 1000*10% = 100
    # after_discount = 900
    # tax = 900*18% = 162
    # total = 900+162 = 1062
    assert Decimal(d["subtotal"])        == Decimal("1000.0000")
    assert Decimal(d["discount_amount"]) == Decimal("100.0000")
    assert Decimal(d["tax_amount"])      == Decimal("162.0000")
    assert Decimal(d["total_amount"])    == Decimal("1062.0000")


# ── 3. Multiple items ──────────────────────────────────────────────────────────

def test_multiple_items(client, db):
    admin = make_admin(db)
    cust  = make_customer_record(db)
    p1 = make_product(db, "Product A", "100.00")
    p2 = make_product(db, "Product B", "200.00")
    payload = {
        "customer_id": cust.id, "currency": "INR",
        "items": [
            {"product_id": p1.id, "description": "A", "quantity": "1", "unit_price": "100.00", "discount_percentage": "0", "tax_percentage": "0"},
            {"product_id": p2.id, "description": "B", "quantity": "2", "unit_price": "200.00", "discount_percentage": "0", "tax_percentage": "0"},
        ],
    }
    r = client.post("/api/v1/quotations", json=payload, headers=auth(admin))
    assert r.status_code == 201
    assert len(r.json()["items"]) == 2
    assert Decimal(r.json()["total_amount"]) == Decimal("500.0000")


# ── 4. Reject zero quantity ────────────────────────────────────────────────────

def test_reject_zero_quantity(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    r = client.post("/api/v1/quotations",
        json=qt_payload(cust.id, product.id, items=[{
            "product_id": product.id, "description": "Item",
            "quantity": "0", "unit_price": "100.00",
            "discount_percentage": "0", "tax_percentage": "0",
        }]),
        headers=auth(admin))
    assert r.status_code == 422


# ── 5. Reject invalid customer ─────────────────────────────────────────────────

def test_reject_invalid_customer(client, db):
    admin = make_admin(db)
    r = client.post("/api/v1/quotations", json={"customer_id": 9999, "currency": "INR", "items": []}, headers=auth(admin))
    assert r.status_code == 404


# ── 6. List quotations ─────────────────────────────────────────────────────────

def test_list_quotations(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin))
    r = client.get("/api/v1/quotations", headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["total"] >= 1


# ── 7. Search quotations ───────────────────────────────────────────────────────

def test_search_quotations(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    created = client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin)).json()
    number  = created["quotation_number"]
    r = client.get(f"/api/v1/quotations?search={number}", headers=auth(admin))
    assert r.json()["total"] >= 1


# ── 8. Get quotation detail ────────────────────────────────────────────────────

def test_get_quotation_detail(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    created = client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin)).json()
    r = client.get(f"/api/v1/quotations/{created['id']}", headers=auth(admin))
    assert r.status_code == 200
    assert "items" in r.json()
    assert "customer" in r.json()


# ── 9. Update quotation ────────────────────────────────────────────────────────

def test_update_quotation(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    created = client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin)).json()
    r = client.put(f"/api/v1/quotations/{created['id']}",
        json={"notes": "Updated note", "items": [
            {"product_id": product.id, "description": "Updated item",
             "quantity": "3", "unit_price": "100.00",
             "discount_percentage": "0", "tax_percentage": "0"},
        ]},
        headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["notes"] == "Updated note"
    assert Decimal(r.json()["total_amount"]) == Decimal("300.0000")


# ── 10. Status transition: draft → sent ────────────────────────────────────────

def test_send_quotation(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    created = client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin)).json()
    r = client.post(f"/api/v1/quotations/{created['id']}/send", headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["status"] == "sent"


# ── 11. Cannot send empty quotation ───────────────────────────────────────────

def test_cannot_send_empty_quotation(client, db):
    admin = make_admin(db)
    cust  = make_customer_record(db)
    created = client.post("/api/v1/quotations", json={"customer_id": cust.id, "currency": "INR", "items": []}, headers=auth(admin)).json()
    r = client.post(f"/api/v1/quotations/{created['id']}/send", headers=auth(admin))
    assert r.status_code == 400


# ── 12. Status transition: sent → accepted ────────────────────────────────────

def test_accept_quotation(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    created = client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin)).json()
    client.post(f"/api/v1/quotations/{created['id']}/send",   headers=auth(admin))
    r = client.post(f"/api/v1/quotations/{created['id']}/accept", headers=auth(admin))
    assert r.json()["status"] == "accepted"


# ── 13. Invalid transition (accepted → sent) ───────────────────────────────────

def test_invalid_transition(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    created = client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin)).json()
    client.post(f"/api/v1/quotations/{created['id']}/send",   headers=auth(admin))
    client.post(f"/api/v1/quotations/{created['id']}/accept", headers=auth(admin))
    r = client.post(f"/api/v1/quotations/{created['id']}/send", headers=auth(admin))
    assert r.status_code == 400


# ── 14. Cancel quotation ───────────────────────────────────────────────────────

def test_cancel_quotation(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    created = client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin)).json()
    r = client.delete(f"/api/v1/quotations/{created['id']}/cancel", headers=auth(admin))
    # cancel is a POST, not DELETE
    r = client.post(f"/api/v1/quotations/{created['id']}/cancel", headers=auth(admin))
    assert r.json()["status"] == "cancelled"


# ── 15. Stats ──────────────────────────────────────────────────────────────────

def test_stats(client, db):
    admin   = make_admin(db)
    cust    = make_customer_record(db)
    product = make_product(db)
    client.post("/api/v1/quotations", json=qt_payload(cust.id, product.id), headers=auth(admin))
    r = client.get("/api/v1/quotations/stats", headers=auth(admin))
    assert r.status_code == 200
    d = r.json()
    assert d["total"] >= 1
    assert d["draft"] >= 1


# ── 16. Template CRUD ──────────────────────────────────────────────────────────

def test_template_crud(client, db):
    admin = make_admin(db)
    # Create
    r = client.post("/api/v1/quotation-templates",
        json={"template_name": "Standard 30-day", "default_validity_days": 30,
              "default_notes": "Thank you for your business.", "is_active": True},
        headers=auth(admin))
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    # List
    r2 = client.get("/api/v1/quotation-templates", headers=auth(admin))
    assert r2.json()["total"] >= 1

    # Get
    r3 = client.get(f"/api/v1/quotation-templates/{tid}", headers=auth(admin))
    assert r3.json()["template_name"] == "Standard 30-day"

    # Update
    r4 = client.put(f"/api/v1/quotation-templates/{tid}",
        json={"default_validity_days": 14}, headers=auth(admin))
    assert r4.json()["default_validity_days"] == 14

    # Delete
    r5 = client.delete(f"/api/v1/quotation-templates/{tid}", headers=auth(admin))
    assert r5.status_code == 200

    # Verify gone
    r6 = client.get(f"/api/v1/quotation-templates/{tid}", headers=auth(admin))
    assert r6.status_code == 404
