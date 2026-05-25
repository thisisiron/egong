"""Admin audit log writes.

Append-only — every admin mutation (and key reads) should call log().
INSERT bypasses RLS because we use the secret-key client.
"""

import logging
from typing import Any

from src.common.supabase_admin import get_admin_client

logger = logging.getLogger(__name__)


async def log(
    admin_user_id: str,
    action: str,
    academy_id: str | None = None,
    target_table: str | None = None,
    target_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Insert one row into admin_audit_log. Never raises on failure
    of audit write itself — caller already performed the side-effect."""
    try:
        client = await get_admin_client()
        await client.table("admin_audit_log").insert(
            {
                "admin_user_id": admin_user_id,
                "academy_id": academy_id,
                "action": action,
                "target_table": target_table,
                "target_id": target_id,
                "metadata": metadata or {},
            }
        ).execute()
    except Exception:
        logger.exception(
            "audit log write failed (admin=%s action=%s academy=%s)",
            admin_user_id, action, academy_id,
        )
