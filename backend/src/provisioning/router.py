"""Owner-only provisioning endpoints: teachers, parents, student auth attach,
and a reverse parent lookup used by the owner UI when linking a parent to
a student by email.

Thin layer — all real work lives in `service.py`.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.dependencies import CurrentUser, require_owner
from src.provisioning import service
from src.provisioning.schemas import (
    ParentCreate,
    ParentLookupOut,
    ParentOut,
    StudentAuthCreate,
    StudentAuthOut,
    TeacherCreate,
    TeacherOut,
)

router = APIRouter(prefix="/owner", tags=["owner-provisioning"])


def _academy_id(owner: CurrentUser) -> str:
    if not owner.academy_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "owner has no academy_id")
    return owner.academy_id


@router.post(
    "/teachers",
    response_model=TeacherOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_teacher(
    payload: TeacherCreate,
    owner: Annotated[CurrentUser, Depends(require_owner)],
):
    return await service.create_teacher(_academy_id(owner), payload)


@router.post(
    "/parents",
    response_model=ParentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_parent(
    payload: ParentCreate,
    owner: Annotated[CurrentUser, Depends(require_owner)],
):
    return await service.create_parent(_academy_id(owner), payload)


@router.get("/parents/by-email", response_model=ParentLookupOut)
async def lookup_parent(
    email: str,
    owner: Annotated[CurrentUser, Depends(require_owner)],
):
    # require_owner is enough; we don't restrict by academy because parents
    # in this schema aren't bound to a single academy — student_parent INSERT
    # will be rejected by RLS if the owner tries to link to a student they
    # don't own.
    _ = _academy_id(owner)
    parent_id = await service.find_parent_id_by_email(email)
    if not parent_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "parent not found")
    return ParentLookupOut(id=parent_id)


@router.post(
    "/students/{student_id}/auth",
    response_model=StudentAuthOut,
    status_code=status.HTTP_201_CREATED,
)
async def attach_student_auth(
    student_id: str,
    payload: StudentAuthCreate,
    owner: Annotated[CurrentUser, Depends(require_owner)],
):
    return await service.attach_student_auth(_academy_id(owner), student_id, payload)
