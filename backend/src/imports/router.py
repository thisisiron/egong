"""Owner-only csv bulk import endpoints.

Each route parses the uploaded csv synchronously (fail fast on structural
errors → 400) and then delegates to bulk_insert_X in service.py to perform
the actual writes.
"""

from io import StringIO
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from src.auth.dependencies import CurrentUser, require_owner_or_teacher
from src.imports.schemas import ImportResult
from src.imports.service import (
    ParseError,
    bulk_insert_classes,
    bulk_insert_students,
    bulk_insert_teachers,
    parse_classes_csv,
    parse_students_csv,
    parse_teachers_csv,
)

router = APIRouter(prefix="/owner/import", tags=["owner-imports"])


async def _read_csv(file: UploadFile) -> StringIO:
    raw = await file.read()
    # utf-8-sig handles Excel-saved csvs that prepend a BOM.
    text = raw.decode("utf-8-sig", errors="replace")
    return StringIO(text)


def _academy_id(owner: CurrentUser) -> str:
    if not owner.academy_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "owner has no academy_id")
    return owner.academy_id


@router.post("/students", response_model=ImportResult)
async def import_students(
    file: Annotated[UploadFile, File()],
    owner: Annotated[CurrentUser, Depends(require_owner_or_teacher)],
):
    try:
        rows = parse_students_csv(await _read_csv(file))
    except ParseError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from None
    inserted = await bulk_insert_students(rows, _academy_id(owner))
    return ImportResult(kind="students", inserted=inserted)


@router.post("/teachers", response_model=ImportResult)
async def import_teachers(
    file: Annotated[UploadFile, File()],
    owner: Annotated[CurrentUser, Depends(require_owner_or_teacher)],
):
    try:
        rows = parse_teachers_csv(await _read_csv(file))
    except ParseError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from None
    inserted, errors = await bulk_insert_teachers(rows, _academy_id(owner))
    return ImportResult(kind="teachers", inserted=inserted, errors=errors)


@router.post("/classes", response_model=ImportResult)
async def import_classes(
    file: Annotated[UploadFile, File()],
    owner: Annotated[CurrentUser, Depends(require_owner_or_teacher)],
):
    try:
        rows = parse_classes_csv(await _read_csv(file))
    except ParseError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from None
    inserted = await bulk_insert_classes(rows, _academy_id(owner))
    return ImportResult(kind="classes", inserted=inserted)
