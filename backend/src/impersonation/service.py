"""Admin impersonation — issues a magic link for the academy's owner.

audit_log records every impersonation. The owner is identified by the first
`users` row with role='owner' in the academy.
"""

from fastapi import HTTPException, status

from src.audit import service as audit_log
from src.common.supabase_admin import get_admin_client


async def generate_owner_magic_link(
    academy_id: str,
    admin_user_id: str,
    redirect_origin: str,
) -> tuple[str, str]:
    """Returns (owner_email, magic_link). Raises 404 if owner not found."""
    client = await get_admin_client()

    owner_resp = await (
        client.table("users")
        .select("id")
        .eq("academy_id", academy_id)
        .eq("role", "owner")
        .limit(1)
        .execute()
    )
    if not owner_resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "owner not found")
    owner_id = owner_resp.data[0]["id"]

    auth_user = await client.auth.admin.get_user_by_id(owner_id)
    if not auth_user.user or not auth_user.user.email:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "owner auth missing")
    email = auth_user.user.email

    link_resp = await client.auth.admin.generate_link(
        {
            "type": "magiclink",
            "email": email,
            "options": {"redirect_to": f"{redirect_origin}/owner?impersonated=1"},
        }
    )
    magic_url = (
        link_resp.properties.action_link if link_resp.properties else None
    )
    if not magic_url:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "failed to generate magic link"
        )

    await audit_log.log(
        admin_user_id,
        action="impersonate_owner",
        academy_id=academy_id,
        target_table="users",
        target_id=owner_id,
        metadata={"owner_email": email},
    )

    return email, magic_url
