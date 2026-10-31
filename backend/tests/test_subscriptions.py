"""
REVORA – Subscription lifecycle tests (18 scenarios).
Engine/fixtures from conftest.py.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal

import pytest

from app.models.user import User, UserRole
from app.models.customer import Customer, CustomerStatus
from app.models.product import Product
from app.models.plan import SubscriptionPlan, BillingFrequency, PlanStatus
from app.core.security import create_access_token, hash_password


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_admin(db, email="admin@sub.com"):
    u = User(full_name="Admin", email=email,
             hashed_password=hash_password("Test1234"),
             role=UserRole.ADMIN, is_active=True)
    db.add(u); db.commit(); db.refresh(u); return u


def make_customer(db, email="cust@sub.com"):
    c = Customer(full_name="Sub Customer", email=email, status=CustomerStatus.ACTIVE)
    db.add(c); db.commit(); db.refresh(c); return c


def make_product(db, name="SaaS Pro"):
    p = Product(product_name=name, base_price=Decimal("1000.00"), currency="INR",
                tax_percentage=Decimal("18.00"), is_active=True,
                product_type="subscription", billing_type="recurring")
    db.add(p); db.commit(); db.refresh(p); return p


def make_plan(db, product_id, **kw):
    defaults = dict(
        plan_name="Pro Monthly", plan_price=Decimal("999.00"),
        currency="INR", tax_percentage=Decimal("18.00"),
        billing_frequency=BillingFrequency.MONTHLY, billing_interval=1,
        trial_period_days=0, setup_fee=Decimal("0"),
        discount_allowed=True, pause_allowed=True, renewal_allowed=True,
        early_closure_allowed=False, status=PlanStatus.ACTIVE,
        product_id=product_id,
    )
    defaults.update(kw)
    p = SubscriptionPlan(**defaults)
    db.add(p); db.commit(); db.refresh(p); return p


def auth(u): return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


def sub_payload(customer_id, plan_id, **kw):
    return {
        "customer_id": customer_id,
        "plan_id":     plan_id,
        "start_date":  datetime.now(timezone.utc).isoformat(),
        "quantity":    "1",
        "auto_renew":  True,
        **kw,
    }


def create_sub(client, admin, customer_id, plan_id, **kw):
    r = client.post("/api/v1/subscriptions",
                    json=sub_payload(customer_id, plan_id, **kw), headers=auth(admin))
    assert r.status_code == 201, r.text
    return r.json()


# ── 1. Create subscription ─────────────────────────────────────────────────────

def test_create_subscription(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    assert d["subscription_number"].startswith("SUB-")
    assert d["status"] == "draft"
    assert d["snap_plan_name"] == "Pro Monthly"
    assert Decimal(d["unit_price"]) == Decimal("999.00")


# ── 2. Price snapshot ─────────────────────────────────────────────────────────

def test_price_snapshot(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    sub_price = Decimal(d["unit_price"])
    # Change plan price
    plan.plan_price = Decimal("9999.00")
    db.commit()
    # Subscription price must remain unchanged
    r = client.get(f"/api/v1/subscriptions/{d['id']}", headers=auth(admin))
    assert Decimal(r.json()["unit_price"]) == sub_price


# ── 3. Tax calculation ─────────────────────────────────────────────────────────

def test_tax_calculation(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    # unit_price=999, qty=1, tax=18%
    # gross=999, tax=999*0.18=179.82, total=1178.82
    assert Decimal(d["tax_amount"]).quantize(Decimal("0.01"))   == Decimal("179.82")
    assert Decimal(d["total_amount"]).quantize(Decimal("0.01")) == Decimal("1178.82")


# ── 4. Reject invalid customer ─────────────────────────────────────────────────

def test_reject_invalid_customer(client, db):
    admin   = make_admin(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    r = client.post("/api/v1/subscriptions", json=sub_payload(9999, plan.id), headers=auth(admin))
    assert r.status_code == 404


# ── 5. Reject inactive plan ────────────────────────────────────────────────────

def test_reject_inactive_plan(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id, status=PlanStatus.INACTIVE)
    r = client.post("/api/v1/subscriptions", json=sub_payload(cust.id, plan.id), headers=auth(admin))
    assert r.status_code == 400


# ── 6. Activate (draft→active) ────────────────────────────────────────────────

def test_activate_subscription(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    r = client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["status"] == "active"


# ── 7. Pause subscription ─────────────────────────────────────────────────────

def test_pause_subscription(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    r = client.post(f"/api/v1/subscriptions/{d['id']}/pause",
                    json={"reason": "Customer requested pause"}, headers=auth(admin))
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "paused"
    assert data["pause_reason"] == "Customer requested pause"


# ── 8. Pause requires reason ──────────────────────────────────────────────────

def test_pause_requires_reason(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    r = client.post(f"/api/v1/subscriptions/{d['id']}/pause",
                    json={"reason": ""}, headers=auth(admin))
    assert r.status_code == 422


# ── 9. Plan does not allow pause ──────────────────────────────────────────────

def test_plan_no_pause(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id, pause_allowed=False)
    d = create_sub(client, admin, cust.id, plan.id)
    client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    r = client.post(f"/api/v1/subscriptions/{d['id']}/pause",
                    json={"reason": "Testing"}, headers=auth(admin))
    assert r.status_code == 400


# ── 10. Resume subscription ───────────────────────────────────────────────────

def test_resume_subscription(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    client.post(f"/api/v1/subscriptions/{d['id']}/pause",
                json={"reason": "test"}, headers=auth(admin))
    r = client.post(f"/api/v1/subscriptions/{d['id']}/resume", headers=auth(admin))
    assert r.json()["status"] == "active"
    assert r.json()["pause_reason"] is None


# ── 11. Renew subscription ────────────────────────────────────────────────────

def test_renew_subscription(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    prev_billing = d["next_billing_date"]
    r = client.post(f"/api/v1/subscriptions/{d['id']}/renew", headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["next_billing_date"] != prev_billing


# ── 12. Plan does not allow renewal ──────────────────────────────────────────

def test_plan_no_renewal(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id, renewal_allowed=False)
    d = create_sub(client, admin, cust.id, plan.id)
    client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    r = client.post(f"/api/v1/subscriptions/{d['id']}/renew", headers=auth(admin))
    assert r.status_code == 400


# ── 13. Close subscription (admin override) ───────────────────────────────────

def test_close_subscription(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id, early_closure_allowed=True)
    d = create_sub(client, admin, cust.id, plan.id)
    client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    r = client.post(f"/api/v1/subscriptions/{d['id']}/close",
                    json={"reason": "Contract ended"}, headers=auth(admin))
    assert r.json()["status"] == "closed"
    assert r.json()["closure_reason"] == "Contract ended"


# ── 14. Cancel subscription ───────────────────────────────────────────────────

def test_cancel_subscription(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    r = client.post(f"/api/v1/subscriptions/{d['id']}/cancel",
                    json={"reason": "Not needed"}, headers=auth(admin))
    assert r.json()["status"] == "cancelled"


# ── 15. Invalid transition ────────────────────────────────────────────────────

def test_invalid_transition(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    client.post(f"/api/v1/subscriptions/{d['id']}/close",
                json={"reason": "test"}, headers=auth(admin))
    # Closed → active should fail
    r = client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    assert r.status_code == 400


# ── 16. Activity log ──────────────────────────────────────────────────────────

def test_activity_log(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    client.post(f"/api/v1/subscriptions/{d['id']}/activate", headers=auth(admin))
    r = client.get(f"/api/v1/subscriptions/{d['id']}", headers=auth(admin))
    activities = r.json()["activities"]
    actions = [a["action"] for a in activities]
    assert "created" in actions
    assert "activated" in actions


# ── 17. List and search ───────────────────────────────────────────────────────

def test_list_and_search(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    d = create_sub(client, admin, cust.id, plan.id)
    number = d["subscription_number"]
    # List
    r = client.get("/api/v1/subscriptions", headers=auth(admin))
    assert r.json()["total"] >= 1
    # Search by number
    r2 = client.get(f"/api/v1/subscriptions?search={number}", headers=auth(admin))
    assert r2.json()["total"] >= 1


# ── 18. Stats ─────────────────────────────────────────────────────────────────

def test_stats(client, db):
    admin   = make_admin(db)
    cust    = make_customer(db)
    product = make_product(db)
    plan    = make_plan(db, product.id)
    create_sub(client, admin, cust.id, plan.id)
    r = client.get("/api/v1/subscriptions/stats", headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["total"] >= 1
    assert r.json()["draft"] >= 1
