"""Async Supabase admin client singleton.

Uses the secret key (formerly service_role) — bypasses RLS. Only import
this from backend code that has already verified the caller's role.
"""

from supabase import AsyncClient, acreate_client

from src.core.config import get_settings

_client: AsyncClient | None = None


async def get_admin_client() -> AsyncClient:
    """Return a process-singleton async Supabase client with secret key."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = await acreate_client(
            settings.supabase_url,
            settings.supabase_secret_key,
        )
    return _client


async def close_admin_client() -> None:
    """Drop the cached client (called from lifespan shutdown)."""
    global _client
    _client = None
