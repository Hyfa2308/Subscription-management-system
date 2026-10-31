"""
REVORA – Odoo XML-RPC Adapter (concrete implementation).

Uses Python's built-in `xmlrpc.client` – no extra library required.
This adapter is only instantiated when ODOO_ENABLED=true in .env.

IMPORTANT: This adapter has NOT been tested against a live Odoo instance.
Do not claim integration is complete until end-to-end tests pass.
"""

from __future__ import annotations

import xmlrpc.client
from typing import Any, Dict, List

from app.integrations.odoo_adapter import OdooAdapterInterface
from app.core.config import get_settings

settings = get_settings()


class OdooXmlRpcAdapter(OdooAdapterInterface):
    """Concrete Odoo adapter using the XML-RPC v2 API."""

    def __init__(self) -> None:
        self._uid: int | None = None
        self._common = xmlrpc.client.ServerProxy(f"{settings.odoo_url}/xmlrpc/2/common")
        self._models = xmlrpc.client.ServerProxy(f"{settings.odoo_url}/xmlrpc/2/object")

    # ── Connection ─────────────────────────────────────────────────────────────

    def is_connected(self) -> bool:
        return self._uid is not None

    def authenticate(self) -> bool:
        try:
            uid = self._common.authenticate(
                settings.odoo_db,
                settings.odoo_username,
                settings.odoo_password,
                {},
            )
            if uid:
                self._uid = uid
                return True
            return False
        except Exception:  # noqa: BLE001
            return False

    # ── CRUD helpers ───────────────────────────────────────────────────────────

    def _execute(self, model: str, method: str, *args: Any, **kwargs: Any) -> Any:
        if not self._uid:
            raise RuntimeError("Not authenticated with Odoo. Call authenticate() first.")
        return self._models.execute_kw(
            settings.odoo_db,
            self._uid,
            settings.odoo_password,
            model,
            method,
            list(args),
            kwargs,
        )

    def search_read(
        self,
        model: str,
        domain: List[Any],
        fields: List[str],
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        return self._execute(
            model,
            "search_read",
            [domain],
            fields=fields,
            limit=limit,
            offset=offset,
        )

    def create(self, model: str, values: Dict[str, Any]) -> int:
        return self._execute(model, "create", [values])

    def write(self, model: str, record_ids: List[int], values: Dict[str, Any]) -> bool:
        return self._execute(model, "write", [record_ids, values])

    def unlink(self, model: str, record_ids: List[int]) -> bool:
        return self._execute(model, "unlink", [record_ids])

    def call(self, model: str, method: str, *args: Any, **kwargs: Any) -> Any:
        return self._execute(model, method, *args, **kwargs)


# ── Module-level singleton factory ─────────────────────────────────────────────

_adapter: OdooXmlRpcAdapter | None = None


def get_odoo_adapter() -> OdooXmlRpcAdapter | None:
    """
    FastAPI dependency / utility function.
    Returns an authenticated adapter if ODOO_ENABLED=true, else None.
    """
    global _adapter
    if not settings.odoo_enabled:
        return None
    if _adapter is None:
        _adapter = OdooXmlRpcAdapter()
        _adapter.authenticate()
    return _adapter
