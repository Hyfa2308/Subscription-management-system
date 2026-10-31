"""
REVORA – Dashboard API tests (16 scenarios).
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal

import pytest

from app.models.user import User, UserRole
from app.models.customer import Customer, CustomerStatus
from app.models.plan import SubscriptionPlan, BillingFrequency, PlanStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus
from app.models.quotation import Quotation, QuotationStatus
from app.core.security import create_access_token, hash_password


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_admin(db, email="dash_admin@test.com"):
    u = User(full_name="Dash Admin", email=email,
             hashed_password=hash_password("Test1234"),
             role=UserRole.ADMIN, is_active=True)
    db.add(u); db.commit(); db.refresh(u); return u


def make_staff(db, email="dash_staff@test.com"):
    u = User(full_name="Dash Staff", email=email,
             hashed_password=hash_password("Test1234"),
             role=UserRole.STAFF, is_active=True)
    db.add(u); db.commit(); db.refresh(u); return u


def make_customer_user(db, email="dash_cust@test.com"):
    u = User(full_name="Dash Customer", email=email,
             hashed_password=hash_password("Test1234"),
             role=UserRole.CUSTOMER, is_active=True)
    db.add(u); db.commit(); db.refresh(u); return u


def auth(u):
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


from app.models.product import Product, ProductType, BillingType


def seed_data(db):
    """Seed minimal test data and return IDs for assertions."""
    # Customer
    c = Customer(full_name="Dash Test Corp", email="dashtestcorp@test.com",
                 status=CustomerStatus.ACTIVE)
    db.add(c); db.flush()

    # Product (required by Plan)
    prod = Product(
        product_name="Dashboard Product",
        product_type=ProductType.SUBSCRIPTION,
        billing_type=BillingType.RECURRING,
        is_active=True,
    )
    db.add(prod); db.flush()

    # Plan
    p = SubscriptionPlan(
        plan_name="Basic Plan", plan_code="DASH-BASIC",
        product_id=prod.id,
        billing_frequency=BillingFrequency.MONTHLY,
        plan_price=Decimal("1000"), currency="INR",
        status=PlanStatus.ACTIVE,
    )
    db.add(p); db.flush()

    # Subscription
    s = Subscription(
        customer_id=c.id, plan_id=p.id,
        status=SubscriptionStatus.ACTIVE,
        billing_frequency="monthly",
        unit_price=Decimal("1000"),
        quantity=1,
        discount_amount=Decimal("0"),
        tax_amount=Decimal("0"),
        total_amount=Decimal("1000"),
        currency="INR",
        snap_plan_name="Basic Plan",
        snap_product_name="Dashboard Product",
        start_date=datetime.now(timezone.utc),
        next_billing_date=datetime.now(timezone.utc) + timedelta(days=15),
    )
    db.add(s); db.flush()

    # Invoice – paid
    inv_paid = Invoice(
        customer_id=c.id,
        subscription_id=s.id,
        invoice_date=datetime.now(timezone.utc),
        due_date=datetime.now(timezone.utc) + timedelta(days=15),
        currency="INR",
        subtotal=Decimal("1000"),
        discount_amount=Decimal("0"),
        tax_amount=Decimal("0"),
        total_amount=Decimal("1000"),
        amount_paid=Decimal("1000"),
        amount_due=Decimal("0"),
        status=InvoiceStatus.PAID,
    )
    db.add(inv_paid); db.flush()

    # Invoice – overdue
    inv_overdue = Invoice(
        customer_id=c.id,
        invoice_date=datetime.now(timezone.utc) - timedelta(days=60),
        due_date=datetime.now(timezone.utc) - timedelta(days=30),
        currency="INR",
        subtotal=Decimal("2000"),
        discount_amount=Decimal("0"),
        tax_amount=Decimal("0"),
        total_amount=Decimal("2000"),
        amount_paid=Decimal("0"),
        amount_due=Decimal("2000"),
        status=InvoiceStatus.OVERDUE,
    )
    db.add(inv_overdue); db.flush()

    # Quotation
    q = Quotation(
        customer_id=c.id,
        quotation_date=datetime.now(timezone.utc),
        status=QuotationStatus.ACCEPTED,
        currency="INR",
        subtotal=Decimal("1000"),
        discount_amount=Decimal("0"),
        tax_amount=Decimal("0"),
        total_amount=Decimal("1000"),
    )
    db.add(q); db.flush()
    db.commit()

    return c, s, inv_paid, inv_overdue, q


# ── 1. Overview – basic shape ─────────────────────────────────────────────────

def test_overview_shape(client, db):
    admin = make_admin(db)
    r = client.get("/api/v1/dashboard/overview", headers=auth(admin))
    assert r.status_code == 200
    body = r.json()
    for key in ("customers", "subscriptions", "revenue", "invoices", "payments", "quotations"):
        assert key in body


# ── 2. Customer metrics ───────────────────────────────────────────────────────

def test_customer_metrics(client, db):
    admin = make_admin(db, "cm_admin@test.com")
    seed_data(db)
    r = client.get("/api/v1/dashboard/overview", headers=auth(admin))
    body = r.json()
    cm = body["customers"]
    assert cm["total"] >= 1
    assert "active" in cm
    assert "new_customers" in cm
    assert "growth_rate_pct" in cm


# ── 3. Subscription metrics ───────────────────────────────────────────────────

def test_subscription_metrics(client, db):
    admin = make_admin(db, "sm_admin@test.com")
    seed_data(db)
    r = client.get("/api/v1/dashboard/overview", headers=auth(admin))
    sm = r.json()["subscriptions"]
    assert sm["total"] >= 1
    assert sm["active"] >= 1
    assert "expiring_soon" in sm


# ── 4. Revenue metrics (MRR) ──────────────────────────────────────────────────

def test_revenue_metrics_mrr(client, db):
    admin = make_admin(db, "rm_admin@test.com")
    seed_data(db)
    r = client.get("/api/v1/dashboard/overview", headers=auth(admin))
    rv = r.json()["revenue"]
    # MRR from 1 active monthly subscription at 1000
    assert Decimal(rv["mrr"]) >= Decimal("1000")
    assert Decimal(rv["arr"]) >= Decimal("12000")


# ── 5. Revenue collected ──────────────────────────────────────────────────────

def test_revenue_collected(client, db):
    admin = make_admin(db, "rc_admin@test.com")
    seed_data(db)
    r = client.get("/api/v1/dashboard/overview", headers=auth(admin))
    rv = r.json()["revenue"]
    # 1 paid invoice of 1000
    assert Decimal(rv["collected"]) >= Decimal("1000")


# ── 6. Invoice metrics ────────────────────────────────────────────────────────

def test_invoice_metrics(client, db):
    admin = make_admin(db, "im_admin@test.com")
    seed_data(db)
    r = client.get("/api/v1/dashboard/overview", headers=auth(admin))
    iv = r.json()["invoices"]
    assert iv["total"] >= 2
    assert iv["paid"]    >= 1
    assert iv["overdue"] >= 1
    assert Decimal(iv["outstanding_amount"]) >= Decimal("2000")


# ── 7. Payment metrics stub ───────────────────────────────────────────────────

def test_payment_metrics_stub(client, db):
    admin = make_admin(db, "pm_admin@test.com")
    r = client.get("/api/v1/dashboard/overview", headers=auth(admin))
    pv = r.json()["payments"]
    assert pv["available"] is False


# ── 8. Quotation metrics & conversion rate ────────────────────────────────────

def test_quotation_metrics(client, db):
    admin = make_admin(db, "qm_admin@test.com")
    seed_data(db)
    r = client.get("/api/v1/dashboard/overview", headers=auth(admin))
    qv = r.json()["quotations"]
    assert qv["total"] >= 1
    assert qv["accepted"] >= 1
    assert isinstance(qv["conversion_rate_pct"], float)


# ── 9. Revenue trend ──────────────────────────────────────────────────────────

def test_revenue_trend(client, db):
    admin = make_admin(db, "rt_admin@test.com")
    r = client.get("/api/v1/dashboard/revenue-trend?months=3", headers=auth(admin))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 3
    assert "period" in data[0]
    assert "collected" in data[0]
    assert "outstanding" in data[0]


# ── 10. Subscription trend ────────────────────────────────────────────────────

def test_subscription_trend(client, db):
    admin = make_admin(db, "st_admin@test.com")
    seed_data(db)
    r = client.get("/api/v1/dashboard/subscription-trend?months=3", headers=auth(admin))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 3
    assert "new" in data[0]


# ── 11. Customer trend ────────────────────────────────────────────────────────

def test_customer_trend(client, db):
    admin = make_admin(db, "ct_admin@test.com")
    seed_data(db)
    r = client.get("/api/v1/dashboard/customer-trend?months=4", headers=auth(admin))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 4


# ── 12. Recent activities ─────────────────────────────────────────────────────

def test_recent_activities_empty(client, db):
    admin = make_admin(db, "ra_admin@test.com")
    r = client.get("/api/v1/dashboard/recent-activities", headers=auth(admin))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ── 13. Upcoming renewals ─────────────────────────────────────────────────────

def test_upcoming_renewals(client, db):
    admin = make_admin(db, "ur_admin@test.com")
    seed_data(db)
    r = client.get("/api/v1/dashboard/upcoming-renewals?days=30", headers=auth(admin))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # Our seeded sub has next_billing_date within 30 days
    assert any(x["days_until_due"] is not None for x in data)


# ── 14. Alerts generated ─────────────────────────────────────────────────────

def test_alerts(client, db):
    admin = make_admin(db, "al_admin@test.com")
    seed_data(db)
    r = client.get("/api/v1/dashboard/alerts", headers=auth(admin))
    assert r.status_code == 200
    alerts = r.json()
    assert isinstance(alerts, list)
    # Seeded overdue invoice should generate at least 1 alert
    assert any(a["type"] == "overdue_invoices" for a in alerts)


# ── 15. Staff can access dashboard ────────────────────────────────────────────

def test_staff_access(client, db):
    staff = make_staff(db)
    r = client.get("/api/v1/dashboard/overview", headers=auth(staff))
    assert r.status_code == 200


# ── 16. Customer role is blocked ──────────────────────────────────────────────

def test_customer_blocked(client, db):
    cust = make_customer_user(db)
    r = client.get("/api/v1/dashboard/overview", headers=auth(cust))
    assert r.status_code == 403
