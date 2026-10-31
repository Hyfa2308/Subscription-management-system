"""
REVORA – Odoo Integration Adapter Interface.

This module defines the contract (abstract base class) that any Odoo
integration implementation must satisfy.  The concrete XML-RPC adapter lives
in `odoo_xmlrpc.py`.

Design decisions:
  - REVORA treats Odoo as the **authoritative** source for subscriptions,
    invoices, and payments.  We do not mirror financial records locally.
  - All integration credentials stay on the backend (never exposed to the
    frontend or committed to version control).
  - The adapter is feature-flagged via `ODOO_ENABLED` in .env so the app
    runs fully without an Odoo instance during development.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class OdooAdapterInterface(ABC):
    """Abstract interface for Odoo integration adapters."""

    @abstractmethod
    def is_connected(self) -> bool:
        """Return True if a live Odoo session is established."""

    @abstractmethod
    def authenticate(self) -> bool:
        """Authenticate with Odoo. Return True on success."""

    @abstractmethod
    def search_read(
        self,
        model: str,
        domain: List[Any],
        fields: List[str],
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Generic search_read wrapper over the Odoo RPC call."""

    @abstractmethod
    def create(self, model: str, values: Dict[str, Any]) -> int:
        """Create a record in Odoo. Return the new record id."""

    @abstractmethod
    def write(self, model: str, record_ids: List[int], values: Dict[str, Any]) -> bool:
        """Update records in Odoo. Return True on success."""

    @abstractmethod
    def unlink(self, model: str, record_ids: List[int]) -> bool:
        """Delete records in Odoo. Return True on success."""

    @abstractmethod
    def call(self, model: str, method: str, *args: Any, **kwargs: Any) -> Any:
        """
        Low-level RPC call for methods not covered by the helpers above
        (e.g. `action_confirm`, `action_invoice_open`).
        """
