"""Business logic for owner provisioning operations.

Each create method composes:
  1. auth user creation (admin API, bypasses email confirmation)
  2. public.users profile row insert
  3. domain table insert (teachers / parents) — or update for student auth

Manual cleanup on partial failure: if a later step fails, delete the auth
user that was already created. There are no DB transactions across PostgREST.
"""

from typing import Any

from fastapi import HTTPException, status

from src.common.supabase_admin import get_admin_client

from .schemas import (
    ParentCreate,
    ParentOut,
    StudentAuthCreate,
    StudentAuthOut,
    TeacherCreate,
    TeacherOut,
)


async def create_teacher(academy_id: str, payload: TeacherCreate) -> TeacherOut:
    client = await get_admin_client()

    # 1. auth user
    try:
        auth_resp = await client.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.temp_password,
                "email_confirm": True,
                "user_metadata": {"role": "teacher"},
            }
        )
    except Exception as e:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to create teacher auth user: {e}",
        ) from None
    if not auth_resp.user:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "failed to create teacher auth user"
        )
    user_id = auth_resp.user.id

    # 2. users profile
    try:
        await client.table("users").insert(
            {
                "id": user_id,
                "academy_id": academy_id,
                "role": "teacher",
                "display_name": payload.display_name,
                "phone": payload.phone,
                "email": payload.email,
            }
        ).execute()
    except Exception as e:
        await client.auth.admin.delete_user(user_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to insert teacher profile: {e}",
        ) from None

    # 3. teachers row
    try:
        teacher_resp = (
            await client.table("teachers")
            .insert({"user_id": user_id, "academy_id": academy_id})
            .execute()
        )
    except Exception as e:
        await client.auth.admin.delete_user(user_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to insert teachers row: {e}",
        ) from None
    if not teacher_resp.data:
        await client.auth.admin.delete_user(user_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "failed to insert teachers row"
        )
    teacher_id = teacher_resp.data[0]["id"]

    return TeacherOut(
        id=teacher_id,
        user_id=user_id,
        display_name=payload.display_name,
        email=payload.email,
    )


async def create_parent(academy_id: str, payload: ParentCreate) -> ParentOut:
    """Provision a parent auth user + users profile + parents row.

    `academy_id` is stored on the users profile so the owner can filter
    /owner/parents to their academy's parents. (Parents themselves aren't
    bound to one academy in the schema, but the users row is.)
    """
    client = await get_admin_client()

    try:
        auth_resp = await client.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.temp_password,
                "email_confirm": True,
                "user_metadata": {"role": "parent"},
            }
        )
    except Exception as e:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to create parent auth user: {e}",
        ) from None
    if not auth_resp.user:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "failed to create parent auth user"
        )
    user_id = auth_resp.user.id

    try:
        await client.table("users").insert(
            {
                "id": user_id,
                "academy_id": academy_id,
                "role": "parent",
                "display_name": payload.name,
                "phone": payload.phone,
                "email": payload.email,
            }
        ).execute()
    except Exception as e:
        await client.auth.admin.delete_user(user_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to insert parent profile: {e}",
        ) from None

    try:
        parent_resp = (
            await client.table("parents")
            .insert(
                {
                    "user_id": user_id,
                    "name": payload.name,
                    "phone": payload.phone,
                }
            )
            .execute()
        )
    except Exception as e:
        await client.auth.admin.delete_user(user_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to insert parents row: {e}",
        ) from None
    if not parent_resp.data:
        await client.auth.admin.delete_user(user_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "failed to insert parents row"
        )
    parent_id = parent_resp.data[0]["id"]

    return ParentOut(
        id=parent_id,
        user_id=user_id,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
    )


async def find_parent_id_by_email(email: str) -> str | None:
    """Look up a parent's row id by their auth email.

    We can't filter auth.users from the public API by email directly, so we
    paginate `list_users()` (supabase-py admin) and match in Python. A real
    deployment with thousands of users would use a dedicated index/RPC.
    """
    client = await get_admin_client()
    needle = email.strip().lower()

    page = 1
    per_page = 100
    auth_user: Any = None
    while True:
        users = await client.auth.admin.list_users(page=page, per_page=per_page)
        if not users:
            break
        for u in users:
            if u.email and u.email.lower() == needle:
                auth_user = u
                break
        if auth_user is not None or len(users) < per_page:
            break
        page += 1

    if auth_user is None:
        return None

    resp = (
        await client.table("parents")
        .select("id")
        .eq("user_id", auth_user.id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        return None
    return resp.data["id"]


async def attach_student_auth(
    academy_id: str, student_id: str, payload: StudentAuthCreate
) -> StudentAuthOut:
    """Create an auth user for an existing students row that has no user_id."""
    client = await get_admin_client()

    s = (
        await client.table("students")
        .select("academy_id,user_id")
        .eq("id", student_id)
        .single()
        .execute()
    )
    if not s.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "student not found")
    if s.data["academy_id"] != academy_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not your student")
    if s.data.get("user_id"):
        raise HTTPException(status.HTTP_409_CONFLICT, "auth already attached")

    try:
        auth_resp = await client.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.temp_password,
                "email_confirm": True,
                "user_metadata": {"role": "student"},
            }
        )
    except Exception as e:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to create student auth user: {e}",
        ) from None
    if not auth_resp.user:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "failed to create student auth user"
        )
    user_id = auth_resp.user.id

    try:
        await client.table("users").insert(
            {
                "id": user_id,
                "academy_id": academy_id,
                "role": "student",
                "display_name": payload.email.split("@")[0],
                "email": payload.email,
            }
        ).execute()
    except Exception as e:
        await client.auth.admin.delete_user(user_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to insert student profile: {e}",
        ) from None

    try:
        await client.table("students").update({"user_id": user_id}).eq(
            "id", student_id
        ).execute()
    except Exception as e:
        await client.auth.admin.delete_user(user_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"failed to link student to user: {e}",
        ) from None

    return StudentAuthOut(user_id=user_id)
