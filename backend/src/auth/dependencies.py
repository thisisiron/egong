"""FastAPI dependencies for resolving the current user and enforcing roles.

`get_current_user` reads the Authorization: Bearer <jwt> header, asks
Supabase Auth to verify the JWT, then looks up the user's profile row
(role + academy_id) from the public.users table.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from src.common.supabase_admin import get_admin_client


class CurrentUser:
    """Lightweight value object carrying the verified user identity."""

    def __init__(self, user_id: str, role: str, academy_id: str | None):
        self.user_id = user_id
        self.role = role
        self.academy_id = academy_id


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    token = authorization.split(" ", 1)[1]

    client = await get_admin_client()
    try:
        resp = await client.auth.get_user(token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token") from None

    user = resp.user
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")

    profile_resp = (
        await client.table("users")
        .select("role,academy_id")
        .eq("id", user.id)
        .single()
        .execute()
    )
    if not profile_resp.data:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "no profile")

    return CurrentUser(
        user_id=user.id,
        role=profile_resp.data["role"],
        academy_id=profile_resp.data.get("academy_id"),
    )


async def require_admin(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin only")
    return user


async def require_owner(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if user.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "owner only")
    return user
