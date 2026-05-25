"""Business logic for admin academy operations.

Per spec §2 FastAPI Pattern Guide: routers stay thin and call into the
service module. The most important method here is `create_academy_with_owner`,
which composes three Supabase writes (academy → auth user → users profile)
plus an audit log entry, with a best-effort rollback if any step fails.
"""

from typing import Any

from fastapi import HTTPException, status

from src.audit import service as audit_log
from src.common.supabase_admin import get_admin_client

from .schemas import AcademyCreate, AcademyOut, AcademyUpdate


def _row_to_out(row: dict[str, Any], owner_email: str | None = None) -> AcademyOut:
    return AcademyOut(
        id=row["id"],
        name=row["name"],
        status=row["status"],
        contract_started_at=row.get("contract_started_at"),
        created_at=row["created_at"],
        owner_email=owner_email,
    )


async def list_academies(admin_user_id: str) -> list[AcademyOut]:
    client = await get_admin_client()
    resp = (
        await client.table("academy")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    items = resp.data or []
    await audit_log.log(admin_user_id, action="list_academies")
    return [_row_to_out(a) for a in items]


async def get_academy(admin_user_id: str, academy_id: str) -> AcademyOut:
    client = await get_admin_client()
    resp = (
        await client.table("academy")
        .select("*")
        .eq("id", academy_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "academy not found")
    await audit_log.log(
        admin_user_id,
        action="view_academy",
        academy_id=academy_id,
    )
    return _row_to_out(resp.data)


async def create_academy_with_owner(
    admin_user_id: str, payload: AcademyCreate
) -> AcademyOut:
    """Compose academy + owner auth user + users profile in one logical op.

    Manual cleanup-on-failure (no transactions over PostgREST):
    - if owner auth creation fails  → delete academy row
    - if users profile insert fails → delete auth user + academy row
    """
    client = await get_admin_client()

    # 1. Create the academy row
    acad = (
        await client.table("academy")
        .insert(
            {
                "name": payload.name,
                "contract_started_at": (
                    payload.contract_started_at.isoformat()
                    if payload.contract_started_at
                    else None
                ),
                "created_by": admin_user_id,
            }
        )
        .execute()
    )
    if not acad.data:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "failed to create academy"
        )
    academy_row = acad.data[0]
    academy_id = academy_row["id"]

    # 2. Create the owner auth user
    try:
        auth_resp = await client.auth.admin.create_user(
            {
                "email": payload.owner_email,
                "password": payload.owner_temp_password,
                "email_confirm": True,
                "user_metadata": {"role": "owner"},
            }
        )
    except Exception as e:
        await client.table("academy").delete().eq("id", academy_id).execute()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to create owner auth user: {e}",
        ) from None

    if not auth_resp.user:
        await client.table("academy").delete().eq("id", academy_id).execute()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "failed to create owner auth user",
        )
    owner_id = auth_resp.user.id

    # 3. Insert the users profile row
    try:
        await client.table("users").insert(
            {
                "id": owner_id,
                "academy_id": academy_id,
                "role": "owner",
                "display_name": payload.owner_display_name,
            }
        ).execute()
    except Exception as e:
        await client.auth.admin.delete_user(owner_id)
        await client.table("academy").delete().eq("id", academy_id).execute()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to create owner profile: {e}",
        ) from None

    # 4. Audit log
    await audit_log.log(
        admin_user_id,
        action="create_academy",
        academy_id=academy_id,
        target_table="academy",
        target_id=academy_id,
        metadata={"owner_email": payload.owner_email},
    )

    return _row_to_out(academy_row, owner_email=payload.owner_email)


async def update_academy(
    admin_user_id: str, academy_id: str, payload: AcademyUpdate
) -> AcademyOut:
    update_data = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not update_data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no fields to update")

    client = await get_admin_client()
    resp = (
        await client.table("academy")
        .update(update_data)
        .eq("id", academy_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "academy not found")

    await audit_log.log(
        admin_user_id,
        action="update_academy",
        academy_id=academy_id,
        target_table="academy",
        target_id=academy_id,
        metadata=update_data,
    )
    return _row_to_out(resp.data[0])
