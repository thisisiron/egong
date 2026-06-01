"""Business logic for admin academy operations.

Per spec §2 FastAPI Pattern Guide: routers stay thin and call into the
service module. The most important method here is `create_academy_with_owner`,
which composes three Supabase writes (academy → auth user → users profile)
plus an audit log entry, with a best-effort rollback if any step fails.
"""

import logging
from typing import Any

from fastapi import HTTPException
from fastapi import status as _status

from src.audit import service as audit_log
from src.common.supabase_admin import get_admin_client

from .schemas import AcademyCreate, AcademyOut, AcademyUpdate

logger = logging.getLogger(__name__)


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
        raise HTTPException(_status.HTTP_404_NOT_FOUND, "academy not found")
    await audit_log.log(
        admin_user_id,
        action="view_academy",
        academy_id=academy_id,
    )
    return _row_to_out(resp.data)


# --- Granular academy + owner 빌딩 블록 (academies 도메인이 소유) ---
#
# academy 테이블과 원장 users-profile 행은 academies 도메인 소유다.
# 다른 도메인(예: applications.approve)은 이 함수들을 import 해서 재사용하고,
# 절대 academy/users 테이블에 직접 손대지 말 것 (CLAUDE.md 도메인 의존 규칙).


async def create_academy(
    admin_user_id: str,
    name: str,
    *,
    status: str | None = None,
    contract_started_at: str | None = None,
) -> dict:
    """Insert an academy row (academies-domain owns this table). Returns the row dict.
    status/contract_started_at optional — pass only what the caller needs.
    Raises HTTPException 500 if insert returns no data."""
    client = await get_admin_client()
    payload: dict = {"name": name, "created_by": admin_user_id}
    if status is not None:
        payload["status"] = status
    if contract_started_at is not None:
        payload["contract_started_at"] = contract_started_at
    resp = await client.table("academy").insert(payload).execute()
    if not resp.data:
        raise HTTPException(
            _status.HTTP_500_INTERNAL_SERVER_ERROR, "failed to create academy"
        )
    return resp.data[0]


async def delete_academy(academy_id: str) -> None:
    """Best-effort delete of an academy row (rollback). Never raises — logs only."""
    client = await get_admin_client()
    try:
        await client.table("academy").delete().eq("id", academy_id).execute()
    except Exception:
        logger.exception("rollback: delete academy failed (id=%s)", academy_id)


async def create_owner_profile(
    user_id: str, academy_id: str, display_name: str, email: str
) -> None:
    """Insert the owner's users-profile row linked to the academy (academies-domain
    composes academy + owner). Raises HTTPException 500 on failure."""
    client = await get_admin_client()
    try:
        await client.table("users").insert(
            {
                "id": user_id,
                "academy_id": academy_id,
                "role": "owner",
                "display_name": display_name,
                "email": email,
            }
        ).execute()
    except Exception as e:
        raise HTTPException(
            _status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to create owner profile: {e}",
        ) from None


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
    academy_row = await create_academy(
        admin_user_id,
        payload.name,
        contract_started_at=(
            payload.contract_started_at.isoformat()
            if payload.contract_started_at
            else None
        ),
    )
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
        await delete_academy(academy_id)
        raise HTTPException(
            _status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to create owner auth user: {e}",
        ) from None

    if not auth_resp.user:
        await delete_academy(academy_id)
        raise HTTPException(
            _status.HTTP_500_INTERNAL_SERVER_ERROR,
            "failed to create owner auth user",
        )
    owner_id = auth_resp.user.id

    # 3. Insert the users profile row
    try:
        await create_owner_profile(
            owner_id, academy_id, payload.owner_display_name, payload.owner_email
        )
    except HTTPException:
        await client.auth.admin.delete_user(owner_id)
        await delete_academy(academy_id)
        raise

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
        raise HTTPException(_status.HTTP_400_BAD_REQUEST, "no fields to update")

    client = await get_admin_client()
    resp = (
        await client.table("academy")
        .update(update_data)
        .eq("id", academy_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(_status.HTTP_404_NOT_FOUND, "academy not found")

    await audit_log.log(
        admin_user_id,
        action="update_academy",
        academy_id=academy_id,
        target_table="academy",
        target_id=academy_id,
        metadata=update_data,
    )
    return _row_to_out(resp.data[0])
