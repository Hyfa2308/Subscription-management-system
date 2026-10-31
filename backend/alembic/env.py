"""
REVORA – Alembic migration environment.
Configured to:
  - Read DATABASE_URL from app settings (not hardcoded in alembic.ini).
  - Use Base.metadata for autogenerate support.
  - Work with both SQLite (dev) and PostgreSQL (prod).
"""

from __future__ import annotations

import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Make app importable from backend/ directory ────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import get_settings
from app.database.session import Base

# Import all models so Alembic can detect them for autogenerate
# Add future model imports here as modules are built:
# from app.models import customer, product, subscription  # noqa: F401

settings = get_settings()

# ── Alembic Config ─────────────────────────────────────────────────────────────
config = context.config

# Override sqlalchemy.url from settings (avoids hardcoding in alembic.ini)
config.set_main_option("sqlalchemy.url", settings.effective_database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ── Migration runners ──────────────────────────────────────────────────────────

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection needed)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connects to DB)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
