"""material-files 버킷 시드 — 경로가 곧 권한 경계다.

경로 규약: {academy_id}/{class_id | 'all'}/{uuid}.{ext}
storage.objects의 mfiles_member_read 정책이 [1]=학원, [2]=반 세그먼트를 검사한다
(20260726000004_material_files_class_scope.sql). 파일이 실제로 올라가 있지 않으면
그 정책은 실행조차 되지 않으므로, 반 경계 테스트가 0건 대 0건 비교로 헛돈다.
"""

from __future__ import annotations

import uuid

from supabase import AsyncClient

BUCKET = "material-files"
DUMMY_BODY = b"seed material file\n"
# material-files 버킷은 allowed_mime_types가 image/png · image/jpeg · application/pdf 로
# 제한되어 있다(20260726000001_materials.sql). text/plain은 415로 거부되므로 pdf로 위장한다.
# 실제 PDF 유효성은 무의미 — 권한 경계 테스트는 경로 세그먼트만 본다.
DUMMY_CONTENT_TYPE = "application/pdf"
DUMMY_EXT = "pdf"


async def upload_material_file(
    client: AsyncClient,
    academy_id: str,
    class_id: str | None,
    filename: str,
) -> dict:
    """더미 파일 1개를 규약 경로에 올리고 materials.files 항목 dict를 반환한다.

    멱등: 해당 prefix에 이미 객체가 있으면 새로 올리지 않고 첫 객체를 재사용한다.

    `filename`의 확장자는 무시한다 — 실제로 올라가는 객체는 항상 DUMMY_EXT
    (버킷 allowed_mime_types 제약 때문에 pdf로 고정, 아래 DUMMY_CONTENT_TYPE 참고).
    호출자가 아무 확장자로 부르든 표시 이름과 저장 객체의 확장자가 어긋날 수 없도록
    여기서 강제로 맞춘다(caller가 실수로 벌려놓을 수 없게).
    """
    scope = class_id or "all"
    prefix = f"{academy_id}/{scope}"
    display_name = f"{_strip_ext(filename)}.{DUMMY_EXT}"

    existing = await client.storage.from_(BUCKET).list(prefix)
    if existing:
        name = existing[0]["name"]
        return {
            "path": f"{prefix}/{name}",
            "name": display_name,
            "size": len(DUMMY_BODY),
        }

    path = f"{prefix}/{uuid.uuid4()}.{DUMMY_EXT}"
    await client.storage.from_(BUCKET).upload(
        path, DUMMY_BODY, {"content-type": DUMMY_CONTENT_TYPE}
    )
    return {"path": path, "name": display_name, "size": len(DUMMY_BODY)}


def _strip_ext(filename: str) -> str:
    """호출자가 준 파일명에서 확장자를 떼어낸다 (표시 이름 base 용)."""
    base, _, _ext = filename.rpartition(".")
    return base if base else filename


async def delete_material_files_under(
    client: AsyncClient, academy_ids: list[str]
) -> int:
    """주어진 학원 id 접두사 아래 모든 객체를 지운다. Task 4(--reset)가 쓴다."""
    removed = 0
    for academy_id in academy_ids:
        scopes = await client.storage.from_(BUCKET).list(academy_id)
        for scope in scopes:
            scope_name = scope["name"]
            objects = await client.storage.from_(BUCKET).list(
                f"{academy_id}/{scope_name}"
            )
            paths = [f"{academy_id}/{scope_name}/{o['name']}" for o in objects]
            if paths:
                await client.storage.from_(BUCKET).remove(paths)
                removed += len(paths)
    return removed
