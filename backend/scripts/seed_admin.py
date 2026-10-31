#!/usr/bin/env python3
"""
REVORA – Admin Seed Script
===========================
Creates the first administrator account for development and demonstration.

Usage (from the backend/ directory with venv activated):

    # Option 1: Use environment variables
    ADMIN_SEED_NAME="Admin User" \\
    ADMIN_SEED_EMAIL="admin@brightloop.io" \\
    ADMIN_SEED_PASSWORD="Revora@2024" \\
    python scripts/seed_admin.py

    # Option 2: Set in backend/.env and run
    python scripts/seed_admin.py

Environment variables:
    ADMIN_SEED_NAME      — Full name of the admin account
    ADMIN_SEED_EMAIL     — Email address (must be unique)
    ADMIN_SEED_PASSWORD  — Password (min 8 chars, 1 uppercase, 1 digit)

Security notes:
- Do NOT commit .env files with real credentials.
- This script is for DEVELOPMENT and DEMO purposes only.
- In production, create admin accounts through a secure provisioning process.
- Dev seed accounts are labelled [DEV] in the console output.
"""

from __future__ import annotations

import os
import sys

# Make backend/app importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import get_settings
from app.core.security import hash_password
from app.database.session import SessionLocal, engine, Base
from app.models.user import User, UserRole

settings = get_settings()


def seed_admin() -> None:
    name     = os.getenv("ADMIN_SEED_NAME")     or settings.admin_seed_name
    email    = os.getenv("ADMIN_SEED_EMAIL")    or settings.admin_seed_email
    password = os.getenv("ADMIN_SEED_PASSWORD") or settings.admin_seed_password

    if not all([name, email, password]):
        print(
            "❌  Missing credentials.\n"
            "    Set ADMIN_SEED_NAME, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD "
            "in your environment or backend/.env"
        )
        sys.exit(1)

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email.lower()).first()
        if existing:
            print(f"⚠️   Admin already exists: {existing.email} (role={existing.role})")
            return

        admin = User(
            full_name=name,
            email=email.lower(),
            hashed_password=hash_password(password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

        print(f"✅  [DEV] Admin account created:")
        print(f"     Name  : {admin.full_name}")
        print(f"     Email : {admin.email}")
        print(f"     Role  : {admin.role}")
        print(f"     ID    : {admin.id}")
        print()
        print("⚠️   This is a development account. Change the password before deploying.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
