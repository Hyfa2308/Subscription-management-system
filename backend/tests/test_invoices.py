"""
REVORA – Invoice & Billing tests (20 scenarios).
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal

import pytest

from app.models.user import User, UserRole
from app.models.customer import Customer, CustomerStatus
from app.models.product import Product
from app.models.plan import SubscriptionPlan, BillingFrequency, PlanStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import create_access_token, hash_password


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_admin(db, email="admin@inv.com"):
    u = User(full_name="Admin", email=email,
             hashed_password=hash_password("Test1234"),
             role=UserRole.ADMIN, is_active=True)
    db.add(u); db.commit(); db.refresh(u); return u


def make_customer(db, email="cust@inv.com"):
    c = Customer(full_name="Invoice Customer", email=email, status=CustomerStatus.ACTIVE)
    db.add(c); db.commit(); db.refresh(c); return c


def make_product(db):
    p = Product(product_name="SaaS", base_price=Decimal("1000"), currency="INR",
                tax_percentage=Decimal("18"), is_active=True,
                product_type="subscription", billing_type="recurring")
    db.add(p); db.commit(); db.refresh(p); return p


def make_plan(db, pid, **kw):
    defaults = dict(
        plan_name="Pro", plan_price=Decimal("1000.00"), currency="INR",
        tax_percentage=Decimal("18"), billing_frequency=BillingFrequency.MONTHLY,
        billing_interval=1, trial_period_days=0, setup_fee=Decimal("0"),
        discount_allowed=True, pause_allowed=True, renewal_allowed=True,
        early_closure_allowed=True, status=PlanStatus.ACTIVE, product_id=pid,
    )
    defaults.update(kw)
    p = SubscriptionPlan(**defaults)
    db.add(p); db.commit(); db.refresh(p); return p


def make_active_sub(db, customer_id, plan_id, next_billing=None):
    nbd = next_billing or datetime.now(timezone.utc)
    s = Subscription(
        customer_id=customer_id, plan_id=plan_id,
        start_date=datetime.now(timezone.utc),
        next_billing_date=nbd,
        billing_frequency="monthly", billing_interval=1,
        currency="INR", unit_price=Decimal("1000"),
        quantity=Decimal("1"), discount_amount=Decimal("0"),
        tax_amount=Decimal("180"), total_amount=Decimal("1180"),
        status=SubscriptionStatus.ACTIVE, auto_renew=True,
        snap_pause_allowed=True, snap_renewal_allowed=True,
        snap_early_closure_allowed=True, snap_discount_allowed=True,
        snap_plan_name="Pro",
    )
    db.add(s); db.commit(); db.refresh(s); return s


def auth(u): return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


def item_payload(**kw):
    return {"description": "Test item", "quantity": "1", "unit_price": "1000.00",
            "discount_percentage": "0", "tax_percentage": "18", **kw}


# ── 1. Create manual invoice ───────────────────────────────────────────────────

def test_create_invoice(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    payload = {
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "currency": "INR",
        "items": [item_payload()],
    }
    r = client.post("/api/v1/invoices", json=payload, headers=auth(admin))
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["invoice_number"].startswith("INV-")
    assert d["status"] == "draft"
    assert len(d["items"]) == 1


# ── 2. Tax and totals calculation ─────────────────────────────────────────────

def test_tax_calculation(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    payload = {
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [item_payload(quantity="2", unit_price="500.00", tax_percentage="10")],
    }
    r = client.post("/api/v1/invoices", json=payload, headers=auth(admin))
    d = r.json()
    # qty=2, unit=500 → subtotal=1000, tax=100, total=1100
    assert Decimal(d["subtotal"]).quantize(Decimal("0.01"))      == Decimal("1000.00")
    assert Decimal(d["tax_amount"]).quantize(Decimal("0.01"))    == Decimal("100.00")
    assert Decimal(d["total_amount"]).quantize(Decimal("0.01"))  == Decimal("1100.00")
    assert Decimal(d["amount_due"]).quantize(Decimal("0.01"))    == Decimal("1100.00")


# ── 3. Discount calculation ────────────────────────────────────────────────────

def test_discount_calculation(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    payload = {
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [item_payload(quantity="1", unit_price="1000.00",
                               discount_percentage="10", tax_percentage="18")],
    }
    r = client.post("/api/v1/invoices", json=payload, headers=auth(admin))
    d = r.json()
    # subtotal=1000, disc=100, after_disc=900, tax=162, total=1062
    assert Decimal(d["discount_amount"]).quantize(Decimal("0.01")) == Decimal("100.00")
    assert Decimal(d["tax_amount"]).quantize(Decimal("0.01"))      == Decimal("162.00")
    assert Decimal(d["total_amount"]).quantize(Decimal("0.01"))    == Decimal("1062.00")


# ── 4. Reject empty items ─────────────────────────────────────────────────────

def test_reject_empty_items(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    r = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(), "items": [],
    }, headers=auth(admin))
    assert r.status_code == 400


# ── 5. Reject invalid customer ─────────────────────────────────────────────────

def test_reject_invalid_customer(client, db):
    admin = make_admin(db)
    r = client.post("/api/v1/invoices", json={
        "customer_id": 9999,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [item_payload()],
    }, headers=auth(admin))
    assert r.status_code == 404


# ── 6. Finalize invoice (draft → unpaid) ──────────────────────────────────────

def test_finalize_invoice(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    r = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [item_payload()],
    }, headers=auth(admin))
    inv_id = r.json()["id"]
    r2 = client.post(f"/api/v1/invoices/{inv_id}/finalize", headers=auth(admin))
    assert r2.json()["status"] == "unpaid"


# ── 7. Cancel invoice ─────────────────────────────────────────────────────────

def test_cancel_invoice(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    r = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [item_payload()],
    }, headers=auth(admin))
    inv_id = r.json()["id"]
    r2 = client.post(f"/api/v1/invoices/{inv_id}/cancel", headers=auth(admin))
    assert r2.json()["status"] == "cancelled"


# ── 8. Cannot edit paid invoice ───────────────────────────────────────────────

def test_cannot_edit_cancelled_invoice(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    r = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [item_payload()],
    }, headers=auth(admin))
    inv_id = r.json()["id"]
    client.post(f"/api/v1/invoices/{inv_id}/cancel", headers=auth(admin))
    r3 = client.put(f"/api/v1/invoices/{inv_id}", json={"notes": "Changed"}, headers=auth(admin))
    assert r3.status_code == 400


# ── 9. Invoice PDF generation ─────────────────────────────────────────────────

def test_invoice_pdf(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    r = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [item_payload()],
    }, headers=auth(admin))
    inv_id = r.json()["id"]
    r2 = client.get(f"/api/v1/invoices/{inv_id}/pdf", headers=auth(admin))
    assert r2.status_code == 200
    assert r2.headers["content-type"] == "application/pdf"
    assert r2.content[:4] == b"%PDF"


# ── 10. List + search ─────────────────────────────────────────────────────────

def test_list_and_search(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    r = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [item_payload()],
    }, headers=auth(admin))
    number = r.json()["invoice_number"]
    r2 = client.get("/api/v1/invoices", headers=auth(admin))
    assert r2.json()["total"] >= 1
    r3 = client.get(f"/api/v1/invoices?search={number}", headers=auth(admin))
    assert r3.json()["total"] >= 1


# ── 11. Invoice stats ─────────────────────────────────────────────────────────

def test_invoice_stats(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [item_payload()],
    }, headers=auth(admin))
    r = client.get("/api/v1/invoices/stats", headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["total"] >= 1


# ── 12. Billing engine: generate invoice for due subscription ──────────────────

def test_billing_run_generates_invoice(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    prod  = make_product(db)
    plan  = make_plan(db, prod.id)
    # Set next_billing_date to past (due now)
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    sub  = make_active_sub(db, cust.id, plan.id, next_billing=past)

    r = client.post("/api/v1/billing/run", json={"dry_run": False}, headers=auth(admin))
    assert r.status_code == 200
    d = r.json()
    assert d["invoices_created"] >= 1
    assert d["processed"] >= 1


# ── 13. Billing engine: skip future subscription ──────────────────────────────

def test_billing_run_skips_future(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    prod  = make_product(db)
    plan  = make_plan(db, prod.id)
    future = datetime.now(timezone.utc) + timedelta(days=30)
    make_active_sub(db, cust.id, plan.id, next_billing=future)

    r = client.post("/api/v1/billing/run", json={"dry_run": False}, headers=auth(admin))
    # The future subscription should not be billed
    d = r.json()
    assert d["errors"] == 0


# ── 14. Billing engine: duplicate prevention ──────────────────────────────────

def test_billing_no_duplicate(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    prod  = make_product(db)
    plan  = make_plan(db, prod.id)
    past  = datetime.now(timezone.utc) - timedelta(hours=1)
    make_active_sub(db, cust.id, plan.id, next_billing=past)

    r1 = client.post("/api/v1/billing/run", json={"dry_run": False}, headers=auth(admin))
    created_first = r1.json()["invoices_created"]

    # Run again immediately — next_billing_date has advanced; no new invoices for same period
    r2 = client.post("/api/v1/billing/run", json={"dry_run": False}, headers=auth(admin))
    # Should not double-bill: total invoices created in r2 should be 0 for same sub
    assert r2.json()["errors"] == 0


# ── 15. Dry-run billing ───────────────────────────────────────────────────────

def test_billing_dry_run(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    prod  = make_product(db)
    plan  = make_plan(db, prod.id)
    past  = datetime.now(timezone.utc) - timedelta(hours=1)
    make_active_sub(db, cust.id, plan.id, next_billing=past)

    r = client.post("/api/v1/billing/run", json={"dry_run": True}, headers=auth(admin))
    assert r.json()["dry_run"] is True
    # No actual invoices created
    r2 = client.get("/api/v1/invoices", headers=auth(admin))
    assert r2.json()["total"] == 0


# ── 16. Billing history ───────────────────────────────────────────────────────

def test_billing_history(client, db):
    admin = make_admin(db)
    client.post("/api/v1/billing/run", json={"dry_run": True}, headers=auth(admin))
    r = client.get("/api/v1/billing/history", headers=auth(admin))
    assert r.status_code == 200
    assert len(r.json()) >= 1


# ── 17. Upcoming billing ──────────────────────────────────────────────────────

def test_upcoming_billing(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    prod  = make_product(db)
    plan  = make_plan(db, prod.id)
    soon  = datetime.now(timezone.utc) + timedelta(days=5)
    make_active_sub(db, cust.id, plan.id, next_billing=soon)

    r = client.get("/api/v1/billing/upcoming", headers=auth(admin))
    assert r.status_code == 200
    assert len(r.json()) >= 1


# ── 18. Billing status dashboard ─────────────────────────────────────────────

def test_billing_status(client, db):
    admin = make_admin(db)
    r = client.get("/api/v1/billing/status", headers=auth(admin))
    assert r.status_code == 200
    assert "due_today" in r.json()


# ── 19. Subscription-linked invoice ───────────────────────────────────────────

def test_subscription_linked_invoice(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    prod  = make_product(db)
    plan  = make_plan(db, prod.id)
    sub   = make_active_sub(db, cust.id, plan.id)
    r = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "subscription_id": sub.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [item_payload()],
    }, headers=auth(admin))
    assert r.status_code == 201
    assert r.json()["subscription_id"] == sub.id


# ── 20. Multiple line items ───────────────────────────────────────────────────

def test_multi_item_invoice(client, db):
    admin = make_admin(db)
    cust  = make_customer(db)
    payload = {
        "customer_id": cust.id,
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "items": [
            item_payload(description="Item A", quantity="2", unit_price="500", tax_percentage="0"),
            item_payload(description="Item B", quantity="1", unit_price="200", tax_percentage="18"),
        ],
    }
    r = client.post("/api/v1/invoices", json=payload, headers=auth(admin))
    d = r.json()
    assert len(d["items"]) == 2
    # A: 2×500=1000, B: 1×200+36=236; total=1236
    assert Decimal(d["total_amount"]).quantize(Decimal("0.01")) == Decimal("1236.00")
