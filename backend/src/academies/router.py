"""Admin endpoints for managing academies.

Thin layer — business logic lives in `service.py`. The `require_admin`
dependency rejects requests from non-admin users before reaching here.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from src.academies import service
from src.academies.schemas import AcademyCreate, AcademyOut, AcademyUpdate
from src.auth.dependencies import CurrentUser, require_admin

router = APIRouter(prefix="/admin/academies", tags=["admin-academies"])


@router.get("", response_model=list[AcademyOut])
async def list_academies(
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    return await service.list_academies(admin.user_id)


@router.post(
    "",
    response_model=AcademyOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_academy(
    payload: AcademyCreate,
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    return await service.create_academy_with_owner(admin.user_id, payload)


@router.get("/{academy_id}", response_model=AcademyOut)
async def get_academy(
    academy_id: str,
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    return await service.get_academy(admin.user_id, academy_id)


@router.patch("/{academy_id}", response_model=AcademyOut)
async def update_academy(
    academy_id: str,
    payload: AcademyUpdate,
    admin: Annotated[CurrentUser, Depends(require_admin)],
):
    return await service.update_academy(admin.user_id, academy_id, payload)
