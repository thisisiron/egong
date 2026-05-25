"""CSV bulk import for students/teachers/classes.

Parsers validate structure; bulk_insert_X uses the admin client to upsert
into the academy's scope. Teachers go one row at a time so per-row failures
(duplicate email, weak password) don't abort the whole batch — errors are
collected and returned to the caller. Students and classes are inserted in
a single batch (no per-row external dependency that can fail).
"""

import csv

from src.common.supabase_admin import get_admin_client

VALID_LEVELS = {"elementary", "middle", "high"}


class ParseError(Exception):
    """Raised when the uploaded csv is structurally invalid."""


def _read_rows(
    content,
    required_cols: list[str],
    all_cols: list[str],
    kind: str,
) -> list[dict[str, str]]:
    reader = csv.DictReader(content)
    if reader.fieldnames is None:
        raise ParseError(f"{kind}: empty file")
    missing = [c for c in required_cols if c not in reader.fieldnames]
    if missing:
        raise ParseError(f"{kind}: missing columns: {', '.join(missing)}")
    rows: list[dict[str, str]] = []
    for i, raw in enumerate(reader):
        for req in required_cols:
            if not (raw.get(req) or "").strip():
                raise ParseError(f"{kind}: row {i + 1}: '{req}' is empty")
        cleaned = {
            k: (raw.get(k, "") or "").strip()
            for k in all_cols
            if k in (raw or {})
        }
        rows.append(cleaned)
    return rows


def parse_students_csv(content) -> list[dict[str, str]]:
    return _read_rows(
        content,
        required_cols=["name"],
        all_cols=["name", "school", "grade"],
        kind="students",
    )


def parse_teachers_csv(content) -> list[dict[str, str]]:
    rows = _read_rows(
        content,
        required_cols=["email", "display_name", "temp_password"],
        all_cols=["email", "display_name", "temp_password", "phone"],
        kind="teachers",
    )
    for i, r in enumerate(rows):
        if len(r["temp_password"]) < 8:
            raise ParseError(
                f"teachers: row {i + 1}: temp_password must be 8+ chars"
            )
    return rows


def parse_classes_csv(content) -> list[dict[str, str]]:
    rows = _read_rows(
        content,
        required_cols=["name", "level"],
        all_cols=["name", "level", "description"],
        kind="classes",
    )
    for i, r in enumerate(rows):
        if r["level"] not in VALID_LEVELS:
            raise ParseError(
                f"classes: row {i + 1}: level must be one of {sorted(VALID_LEVELS)}"
            )
    return rows


# === Bulk insert helpers (called by router) ===


async def bulk_insert_students(rows: list[dict[str, str]], academy_id: str) -> int:
    if not rows:
        return 0
    payload = [
        {
            "academy_id": academy_id,
            "name": r["name"],
            "school": r.get("school") or None,
            "grade": r.get("grade") or None,
            "status": "enrolled",
        }
        for r in rows
    ]
    client = await get_admin_client()
    resp = await client.table("students").insert(payload).execute()
    return len(resp.data or [])


async def bulk_insert_teachers(
    rows: list[dict[str, str]], academy_id: str
) -> tuple[int, list[str]]:
    """Returns (inserted_count, errors). Per-row failures don't abort.

    Teachers must be created one-by-one because each row produces an auth
    user + profile + teachers row, and an auth duplicate on row N must not
    void rows 1..N-1.
    """
    client = await get_admin_client()
    inserted = 0
    errors: list[str] = []
    for i, r in enumerate(rows):
        try:
            auth = await client.auth.admin.create_user(
                {
                    "email": r["email"],
                    "password": r["temp_password"],
                    "email_confirm": True,
                    "user_metadata": {"role": "teacher"},
                }
            )
            if not auth.user:
                errors.append(f"row {i + 1}: auth create failed")
                continue
            uid = auth.user.id
            await client.table("users").insert(
                {
                    "id": uid,
                    "academy_id": academy_id,
                    "role": "teacher",
                    "display_name": r["display_name"],
                    "phone": r.get("phone") or None,
                }
            ).execute()
            await client.table("teachers").insert(
                {"user_id": uid, "academy_id": academy_id}
            ).execute()
            inserted += 1
        except Exception as e:
            errors.append(f"row {i + 1}: {e}")
    return inserted, errors


async def bulk_insert_classes(rows: list[dict[str, str]], academy_id: str) -> int:
    if not rows:
        return 0
    payload = [
        {
            "academy_id": academy_id,
            "name": r["name"],
            "level": r["level"],
            "description": r.get("description") or None,
        }
        for r in rows
    ]
    client = await get_admin_client()
    resp = await client.table("classes").insert(payload).execute()
    return len(resp.data or [])
