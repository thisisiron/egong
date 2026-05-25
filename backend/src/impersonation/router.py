from typing import Annotated

from fastapi import APIRouter, Depends, Header

from src.auth.dependencies import CurrentUser, require_admin
from src.impersonation.schemas import ImpersonateRequest, ImpersonateResponse
from src.impersonation.service import generate_owner_magic_link

router = APIRouter(prefix="/admin/impersonate", tags=["admin-impersonate"])


@router.post("", response_model=ImpersonateResponse)
async def impersonate_owner(
    payload: ImpersonateRequest,
    admin: Annotated[CurrentUser, Depends(require_admin)],
    origin: Annotated[str | None, Header()] = None,
):
    """Generate a magic link for the academy's owner. The frontend POST handler
    redirects the admin's browser to the returned magic_link, which then logs them
    into Supabase as the owner with ?impersonated=1 set."""
    # Fallback to localhost origin in dev if no Origin header
    redirect_origin = origin or "http://localhost:3000"
    email, magic_url = await generate_owner_magic_link(
        academy_id=payload.academy_id,
        admin_user_id=admin.user_id,
        redirect_origin=redirect_origin,
    )
    return ImpersonateResponse(owner_email=email, magic_link=magic_url)
