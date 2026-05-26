"""HTTP routes for academy applications.

- POST /applications: public, no auth (anon submit)
- GET /admin/applications: admin only — list
- GET /admin/applications/{id}: admin only — detail
- GET /admin/applications/{id}/file-url: admin only — signed download URL
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from src.auth.dependencies import CurrentUser, require_admin

from . import service
from .schemas import (
    ApplicationOut,
    ApplicationSubmit,
    ApplicationSubmitResult,
    SignedDownloadUrl,
)

router = APIRouter(tags=["applications"])


@router.post("/applications", response_model=ApplicationSubmitResult)
async def submit_application(payload: ApplicationSubmit) -> ApplicationSubmitResult:
    """Public — anyone can submit. RLS at DB layer is the real boundary."""
    await service.submit(payload)
    return ApplicationSubmitResult(ok=True)


@router.get("/admin/applications", response_model=list[ApplicationOut])
async def list_applications(
    _admin: Annotated[CurrentUser, Depends(require_admin)],
) -> list[ApplicationOut]:
    return await service.list_all()


@router.get("/admin/applications/{application_id}", response_model=ApplicationOut)
async def get_application(
    application_id: str,
    _admin: Annotated[CurrentUser, Depends(require_admin)],
) -> ApplicationOut:
    return await service.get_by_id(application_id)


@router.get(
    "/admin/applications/{application_id}/file-url",
    response_model=SignedDownloadUrl | None,
)
async def get_application_file_url(
    application_id: str,
    _admin: Annotated[CurrentUser, Depends(require_admin)],
) -> SignedDownloadUrl | None:
    return await service.signed_download_url(application_id)
