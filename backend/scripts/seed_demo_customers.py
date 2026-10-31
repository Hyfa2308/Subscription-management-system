#!/usr/bin/env python3
"""
REVORA – Seed Demo Customers & Intelligence Script.
Populates realistic customer records in revora_dev.db with labelled demo telemetry
to showcase healthy, needs-attention, at-risk, and insufficient-data customer profiles.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app.models  # noqa: F401
from app.database.session import SessionLocal, engine, Base
from app.models.customer import Customer, CustomerActivity, CustomerStatus
from app.models.customer_intelligence import CustomerTelemetry
from app.services.customer_intelligence_service import CustomerIntelligenceService


def seed_demo_customers():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        now = datetime.now(timezone.utc)

        customers_data = [
            {
                "full_name": "Apex Enterprise Solutions",
                "email": "procurement@apexenterprise.com",
                "phone": "+1-555-0199",
                "company_name": "Apex Enterprise Inc",
                "days_ago": 410,
                "status": CustomerStatus.ACTIVE,
                "telemetry": {
                    "active_subscriptions": 3,
                    "paused_subscriptions": 0,
                    "closed_subscriptions": 0,
                    "renewal_count": 4,
                    "upcoming_expirations": 0,
                    "days_to_expiration": 140,
                    "avg_duration_days": 365.0,
                    "has_auto_renew": True,
                    "total_payments": 24,
                    "successful_payments": 24,
                    "failed_payments": 0,
                    "delayed_payments": 0,
                    "outstanding_invoices_amount": 0.0,
                    "overdue_invoices_count": 0,
                    "avg_payment_delay_days": 0.5,
                    "days_since_last_payment": 6,
                    "monthly_recurring_revenue": 1450.0,
                    "total_historical_revenue": 17400.0,
                    "avg_subscription_value": 483.33,
                    "revenue_trend": "growing",
                },
            },
            {
                "full_name": "Zenith Media Dynamics",
                "email": "finance@zenithmedia.io",
                "phone": "+1-555-0245",
                "company_name": "Zenith Media Group",
                "days_ago": 120,
                "status": CustomerStatus.ACTIVE,
                "telemetry": {
                    "active_subscriptions": 1,
                    "paused_subscriptions": 1,
                    "closed_subscriptions": 1,
                    "renewal_count": 1,
                    "upcoming_expirations": 1,
                    "days_to_expiration": 5,
                    "avg_duration_days": 90.0,
                    "has_auto_renew": False,
                    "total_payments": 8,
                    "successful_payments": 5,
                    "failed_payments": 3,
                    "delayed_payments": 4,
                    "outstanding_invoices_amount": 750.0,
                    "overdue_invoices_count": 2,
                    "avg_payment_delay_days": 16.4,
                    "days_since_last_payment": 48,
                    "monthly_recurring_revenue": 250.0,
                    "total_historical_revenue": 1850.0,
                    "avg_subscription_value": 250.0,
                    "revenue_trend": "declining",
                },
            },
            {
                "full_name": "CloudPeak Analytics",
                "email": "billing@cloudpeak.net",
                "phone": "+1-555-0371",
                "company_name": "CloudPeak Inc",
                "days_ago": 195,
                "status": CustomerStatus.ACTIVE,
                "telemetry": {
                    "active_subscriptions": 1,
                    "paused_subscriptions": 1,
                    "closed_subscriptions": 0,
                    "renewal_count": 2,
                    "upcoming_expirations": 0,
                    "days_to_expiration": 40,
                    "avg_duration_days": 180.0,
                    "has_auto_renew": True,
                    "total_payments": 12,
                    "successful_payments": 11,
                    "failed_payments": 1,
                    "delayed_payments": 2,
                    "outstanding_invoices_amount": 180.0,
                    "overdue_invoices_count": 1,
                    "avg_payment_delay_days": 5.8,
                    "days_since_last_payment": 18,
                    "monthly_recurring_revenue": 360.0,
                    "total_historical_revenue": 4320.0,
                    "avg_subscription_value": 360.0,
                    "revenue_trend": "stable",
                },
            },
            {
                "full_name": "Nexus Robotics Global",
                "email": "operations@nexusrobotics.org",
                "phone": "+1-555-0482",
                "company_name": "Nexus Robotics",
                "days_ago": 280,
                "status": CustomerStatus.ACTIVE,
                "telemetry": {
                    "active_subscriptions": 2,
                    "paused_subscriptions": 0,
                    "closed_subscriptions": 0,
                    "renewal_count": 3,
                    "upcoming_expirations": 0,
                    "days_to_expiration": 95,
                    "avg_duration_days": 240.0,
                    "has_auto_renew": True,
                    "total_payments": 18,
                    "successful_payments": 18,
                    "failed_payments": 0,
                    "delayed_payments": 1,
                    "outstanding_invoices_amount": 0.0,
                    "overdue_invoices_count": 0,
                    "avg_payment_delay_days": 1.0,
                    "days_since_last_payment": 10,
                    "monthly_recurring_revenue": 890.0,
                    "total_historical_revenue": 8900.0,
                    "avg_subscription_value": 445.0,
                    "revenue_trend": "growing",
                },
            },
            {
                "full_name": "Beacon Dynamics (New Customer)",
                "email": "hello@beacondynamics.co",
                "phone": "+1-555-0555",
                "company_name": "Beacon Dynamics LLC",
                "days_ago": 4,
                "status": CustomerStatus.ACTIVE,
                "telemetry": None,  # No telemetry -> Demonstrates honest Insufficient Data state!
            },
        ]

        service = CustomerIntelligenceService(db)

        for c_data in customers_data:
            existing = db.query(Customer).filter(Customer.email == c_data["email"].lower()).first()
            if existing:
                continue

            customer = Customer(
                full_name=c_data["full_name"],
                email=c_data["email"].lower(),
                phone=c_data["phone"],
                company_name=c_data["company_name"],
                status=c_data["status"],
                registration_date=now - timedelta(days=c_data["days_ago"]),
            )
            db.add(customer)
            db.flush()

            # Activity log
            db.add(CustomerActivity(
                customer_id=customer.id,
                event_type="customer.created",
                description=f"Customer registered into REVORA system.",
                actor_name="System",
            ))

            tel_data = c_data["telemetry"]
            if tel_data:
                tel = CustomerTelemetry(
                    customer_id=customer.id,
                    data_source="demo_telemetry",
                    is_demo_data=True,
                    **tel_data,
                )
                db.add(tel)

            db.commit()

            # Auto calculate intelligence
            service.recalculate_customer(customer.id)
            print(f"Created demo customer: {customer.full_name} ({customer.customer_code})")

        print("Customer Intelligence seed completed successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_customers()
