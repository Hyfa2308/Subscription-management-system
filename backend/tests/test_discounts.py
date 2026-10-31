"""
REVORA – Discount & Redemption tests (22 scenarios).
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal

import pytest

from app.models.user import User, UserRole
from app.models.customer import Customer, CustomerStatus
from app.core.security import create_access_token, hash_password


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_admin(db, email="admin@disc.test"):
    u = User(full_name="Admin", email=email,
             hashed_password=hash_password("Test1234"),
             role=UserRole.ADMIN, is_active=True)
    db.add(u); db.commit(); db.refresh(u); return u


def make_customer(db, email="cust@disc.test"):
    c = Customer(full_name="Discount Customer", email=email, status=CustomerStatus.ACTIVE)
    db.add(c); db.commit(); db.refresh(c); return c


def auth(u):
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


def make_discount(client, admin, **kwargs):
    defaults = dict(
        discount_name="Test Discount",
        discount_type="percentage",
        discount_value="10",
        start_date=datetime.now(timezone.utc).isoformat(),
        currency="INR",
    )
    defaults.update(kwargs)
    r = client.post("/api/v1/discounts", json=defaults, headers=auth(admin))
    assert r.status_code == 201, r.text
    return r.json()


# ── 1. Create percentage discount ─────────────────────────────────────────────

def test_create_percentage_discount(client, db):
    admin = make_admin(db)
    d = make_discount(client, admin)
    assert d["discount_code"].startswith("DISC-")
    assert d["discount_type"] == "percentage"
    assert d["status"] == "active"


# ── 2. Create fixed discount ──────────────────────────────────────────────────

def test_create_fixed_discount(client, db):
    admin = make_admin(db)
    d = make_discount(client, admin,
        discount_name="Fixed100",
        discount_type="fixed_amount",
        discount_value="100",
    )
    assert d["discount_type"] == "fixed_amount"


# ── 3. Custom discount code ───────────────────────────────────────────────────

def test_custom_discount_code(client, db):
    admin = make_admin(db)
    d = make_discount(client, admin, discount_code="SAVE50", discount_value="50")
    assert d["discount_code"] == "SAVE50"


# ── 4. Reject duplicate code ──────────────────────────────────────────────────

def test_reject_duplicate_code(client, db):
    admin = make_admin(db)
    make_discount(client, admin, discount_code="DUPE01")
    r = client.post("/api/v1/discounts", json={
        "discount_code": "DUPE01",
        "discount_name": "Dupe",
        "discount_type": "percentage",
        "discount_value": "10",
        "start_date": datetime.now(timezone.utc).isoformat(),
    }, headers=auth(admin))
    assert r.status_code == 409


# ── 5. Reject percentage > 100 ───────────────────────────────────────────────

def test_reject_percentage_over_100(client, db):
    admin = make_admin(db)
    r = client.post("/api/v1/discounts", json={
        "discount_name": "TooMuch",
        "discount_type": "percentage",
        "discount_value": "110",
        "start_date": datetime.now(timezone.utc).isoformat(),
    }, headers=auth(admin))
    assert r.status_code == 422


# ── 6. Reject end_date before start_date ─────────────────────────────────────

def test_reject_end_before_start(client, db):
    admin = make_admin(db)
    r = client.post("/api/v1/discounts", json={
        "discount_name": "BadDates",
        "discount_type": "percentage",
        "discount_value": "10",
        "start_date": datetime.now(timezone.utc).isoformat(),
        "end_date":   (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    }, headers=auth(admin))
    assert r.status_code == 422


# ── 7. Validate: percentage discount calculation ──────────────────────────────

def test_validate_percentage_discount(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin, discount_value="20")  # 20%
    r = client.post("/api/v1/discounts/validate", json={
        "discount_code":   d["discount_code"],
        "customer_id":     cust.id,
        "purchase_amount": "1000",
        "currency":        "INR",
    }, headers=auth(admin))
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is True
    assert Decimal(body["discount_amount"]) == Decimal("200")
    assert Decimal(body["final_amount"])    == Decimal("800")


# ── 8. Validate: fixed discount ───────────────────────────────────────────────

def test_validate_fixed_discount(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin, discount_type="fixed_amount", discount_value="150")
    r = client.post("/api/v1/discounts/validate", json={
        "discount_code":   d["discount_code"],
        "customer_id":     cust.id,
        "purchase_amount": "1000",
        "currency":        "INR",
    }, headers=auth(admin))
    body = r.json()
    assert body["valid"] is True
    assert Decimal(body["discount_amount"]) == Decimal("150")


# ── 9. Validate: maximum discount cap ────────────────────────────────────────

def test_validate_max_cap(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin,
        discount_value="50",  # 50%
        maximum_discount_amount="200",
    )
    r = client.post("/api/v1/discounts/validate", json={
        "discount_code":   d["discount_code"],
        "customer_id":     cust.id,
        "purchase_amount": "1000",   # 50% = 500, but capped at 200
        "currency":        "INR",
    }, headers=auth(admin))
    body = r.json()
    assert body["valid"] is True
    assert Decimal(body["discount_amount"]) == Decimal("200")


# ── 10. Validate: minimum purchase requirement ────────────────────────────────

def test_validate_min_purchase_fail(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin, minimum_purchase_amount="500")
    r = client.post("/api/v1/discounts/validate", json={
        "discount_code":   d["discount_code"],
        "customer_id":     cust.id,
        "purchase_amount": "300",   # below 500 minimum
        "currency":        "INR",
    }, headers=auth(admin))
    body = r.json()
    assert body["valid"] is False
    assert "Minimum" in body["reason"]


# ── 11. Validate: expired discount ───────────────────────────────────────────

def test_validate_expired_discount(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin,
        start_date=(datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
        end_date=(datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    )
    r = client.post("/api/v1/discounts/validate", json={
        "discount_code":   d["discount_code"],
        "customer_id":     cust.id,
        "purchase_amount": "1000",
        "currency":        "INR",
    }, headers=auth(admin))
    body = r.json()
    assert body["valid"] is False
    assert "expired" in body["reason"].lower()


# ── 12. Validate: global usage limit ─────────────────────────────────────────

def test_validate_global_usage_limit(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin, usage_limit=0)  # 0 means already exhausted
    # Manually set usage_count to usage_limit by patching via update
    client.put(f"/api/v1/discounts/{d['id']}", json={"usage_limit": 1}, headers=auth(admin))
    # Force usage_count to 1 via a reserve+redeem cycle
    cust2 = make_customer(db, email="cust2@disc.test")
    make_discount(client, admin, discount_code="LIMTEST", usage_limit=1, discount_value="5")
    # Get fresh code
    lr = client.get("/api/v1/discounts?search=LIMTEST", headers=auth(admin))
    disc_id = lr.json()["discounts"][0]["id"]
    disc_code = lr.json()["discounts"][0]["discount_code"]
    # Reserve + redeem to increment usage_count to 1
    res = client.post(f"/api/v1/discounts/{disc_id}/reserve", json={
        "customer_id": cust.id, "purchase_amount": "1000", "currency": "INR",
    }, headers=auth(admin))
    client.post(f"/api/v1/discounts/{disc_id}/redeem/{res.json()['id']}", headers=auth(admin))
    # Now validate again — should fail
    r = client.post("/api/v1/discounts/validate", json={
        "discount_code":   disc_code,
        "customer_id":     cust2.id,
        "purchase_amount": "1000",
        "currency":        "INR",
    }, headers=auth(admin))
    assert r.json()["valid"] is False
    assert "Global usage limit" in r.json()["reason"]


# ── 13. Validate: invalid code ───────────────────────────────────────────────

def test_validate_invalid_code(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    r = client.post("/api/v1/discounts/validate", json={
        "discount_code": "NOTEXIST",
        "customer_id":   cust.id,
        "purchase_amount": "1000",
    }, headers=auth(admin))
    body = r.json()
    assert body["valid"] is False
    assert "Invalid" in body["reason"]


# ── 14. Reserve redemption ────────────────────────────────────────────────────

def test_reserve_redemption(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin)
    r = client.post(f"/api/v1/discounts/{d['id']}/reserve", json={
        "customer_id": cust.id, "purchase_amount": "500", "currency": "INR",
    }, headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["status"] == "reserved"


# ── 15. Redeem (confirm) ──────────────────────────────────────────────────────

def test_redeem_confirmation(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin)
    res_id = client.post(f"/api/v1/discounts/{d['id']}/reserve", json={
        "customer_id": cust.id, "purchase_amount": "500", "currency": "INR",
    }, headers=auth(admin)).json()["id"]
    r = client.post(f"/api/v1/discounts/{d['id']}/redeem/{res_id}", headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["status"] == "redeemed"
    # Check usage_count incremented
    r2 = client.get(f"/api/v1/discounts/{d['id']}", headers=auth(admin))
    assert r2.json()["usage_count"] == 1


# ── 16. Reverse redemption ────────────────────────────────────────────────────

def test_reverse_redemption(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin)
    res_id = client.post(f"/api/v1/discounts/{d['id']}/reserve", json={
        "customer_id": cust.id, "purchase_amount": "500", "currency": "INR",
    }, headers=auth(admin)).json()["id"]
    client.post(f"/api/v1/discounts/{d['id']}/redeem/{res_id}", headers=auth(admin))
    r = client.post(f"/api/v1/discounts/{d['id']}/reverse/{res_id}", headers=auth(admin))
    assert r.json()["status"] == "reversed"
    # usage_count decremented
    r2 = client.get(f"/api/v1/discounts/{d['id']}", headers=auth(admin))
    assert r2.json()["usage_count"] == 0


# ── 17. Redemption history ────────────────────────────────────────────────────

def test_redemption_history(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin)
    client.post(f"/api/v1/discounts/{d['id']}/reserve", json={
        "customer_id": cust.id, "purchase_amount": "500", "currency": "INR",
    }, headers=auth(admin))
    r = client.get(f"/api/v1/discounts/{d['id']}/redemptions", headers=auth(admin))
    assert r.status_code == 200
    assert len(r.json()) >= 1


# ── 18. Update discount ───────────────────────────────────────────────────────

def test_update_discount(client, db):
    admin = make_admin(db)
    d = make_discount(client, admin)
    r = client.put(f"/api/v1/discounts/{d['id']}", json={
        "discount_name": "Updated Name",
    }, headers=auth(admin))
    assert r.json()["discount_name"] == "Updated Name"


# ── 19. Archive discount ──────────────────────────────────────────────────────

def test_archive_discount(client, db):
    admin = make_admin(db)
    d = make_discount(client, admin)
    r = client.delete(f"/api/v1/discounts/{d['id']}", headers=auth(admin))
    assert r.status_code == 200
    r2 = client.get(f"/api/v1/discounts/{d['id']}", headers=auth(admin))
    assert r2.json()["status"] == "archived"


# ── 20. Discount stats ────────────────────────────────────────────────────────

def test_discount_stats(client, db):
    admin = make_admin(db)
    make_discount(client, admin)
    r = client.get("/api/v1/discounts/stats", headers=auth(admin))
    assert r.status_code == 200
    s = r.json()
    assert s["total"] >= 1
    assert "active" in s


# ── 21. Discount not applicable (wrong currency) ──────────────────────────────

def test_validate_currency_mismatch(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    d = make_discount(client, admin,
        discount_type="fixed_amount", discount_value="100", currency="USD")
    r = client.post("/api/v1/discounts/validate", json={
        "discount_code":   d["discount_code"],
        "customer_id":     cust.id,
        "purchase_amount": "1000",
        "currency":        "INR",
    }, headers=auth(admin))
    assert r.json()["valid"] is False
    assert "USD" in r.json()["reason"]


# ── 22. List + search ─────────────────────────────────────────────────────────

def test_list_and_search(client, db):
    admin = make_admin(db)
    make_discount(client, admin, discount_name="UniqueDiscountXYZ")
    r = client.get("/api/v1/discounts?search=UniqueDiscountXYZ", headers=auth(admin))
    assert r.json()["total"] >= 1
