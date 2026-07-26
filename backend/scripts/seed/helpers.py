"""시드 멱등 helper — '어떻게' 만드는지. 이미 있으면 재사용, 없으면 생성."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from supabase import AsyncClient

from .world import SEED_PASSWORD


async def get_or_create_academy(client: AsyncClient, name: str) -> str:
    resp = await client.table("academy").select("id").eq("name", name).execute()
    if resp.data:
        return resp.data[0]["id"]
    resp = (
        await client.table("academy")
        .insert({"name": name, "status": "active"})
        .execute()
    )
    return resp.data[0]["id"]


async def ensure_auth_user(
    client: AsyncClient, email: str, display_name: str
) -> tuple[str, bool]:
    """Returns (user_id, created_now)."""
    existing = await _find_auth_user_id_by_email(client, email)
    if existing:
        return existing, False
    resp = await client.auth.admin.create_user(
        {
            "email": email,
            "password": SEED_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"display_name": display_name},
        }
    )
    if not resp.user:
        raise RuntimeError(f"create_user returned no user for {email}")
    return resp.user.id, True


async def _find_auth_user_id_by_email(client: AsyncClient, email: str) -> str | None:
    needle = email.strip().lower()
    page = 1
    per_page = 100
    while True:
        users = await client.auth.admin.list_users(page=page, per_page=per_page)
        if not users:
            return None
        for u in users:
            if u.email and u.email.lower() == needle:
                return u.id
        if len(users) < per_page:
            return None
        page += 1


async def ensure_users_row(
    client: AsyncClient,
    *,
    user_id: str,
    email: str,
    role: str,
    display_name: str,
    academy_id: str | None,
) -> None:
    resp = (
        await client.table("users").select("id").eq("id", user_id).execute()
    )
    if resp.data:
        return
    await client.table("users").insert(
        {
            "id": user_id,
            "email": email,
            "role": role,
            "display_name": display_name,
            "academy_id": academy_id,
        }
    ).execute()


async def ensure_teacher(
    client: AsyncClient, user_id: str, academy_id: str
) -> str:
    resp = (
        await client.table("teachers").select("id").eq("user_id", user_id).execute()
    )
    if resp.data:
        return resp.data[0]["id"]
    resp = (
        await client.table("teachers")
        .insert({"user_id": user_id, "academy_id": academy_id})
        .execute()
    )
    return resp.data[0]["id"]


async def ensure_student(
    client: AsyncClient, user_id: str, academy_id: str, name: str
) -> str:
    resp = (
        await client.table("students").select("id").eq("user_id", user_id).execute()
    )
    if resp.data:
        return resp.data[0]["id"]
    resp = (
        await client.table("students")
        .insert(
            {
                "user_id": user_id,
                "academy_id": academy_id,
                "name": name,
                "grade": "3학년",
                "status": "enrolled",
            }
        )
        .execute()
    )
    return resp.data[0]["id"]


async def ensure_parent(
    client: AsyncClient, user_id: str, name: str, phone: str
) -> str:
    resp = (
        await client.table("parents").select("id").eq("user_id", user_id).execute()
    )
    if resp.data:
        return resp.data[0]["id"]
    resp = (
        await client.table("parents")
        .insert({"user_id": user_id, "name": name, "phone": phone})
        .execute()
    )
    return resp.data[0]["id"]


async def ensure_student_parent(
    client: AsyncClient, student_id: str, parent_id: str, relationship: str
) -> None:
    resp = (
        await client.table("student_parent")
        .select("student_id")
        .eq("student_id", student_id)
        .eq("parent_id", parent_id)
        .execute()
    )
    if resp.data:
        return
    await client.table("student_parent").insert(
        {
            "student_id": student_id,
            "parent_id": parent_id,
            "relationship": relationship,
        }
    ).execute()


async def ensure_class(
    client: AsyncClient, academy_id: str, name: str, level: str
) -> str:
    resp = (
        await client.table("classes")
        .select("id")
        .eq("academy_id", academy_id)
        .eq("name", name)
        .execute()
    )
    if resp.data:
        return resp.data[0]["id"]
    resp = (
        await client.table("classes")
        .insert({"academy_id": academy_id, "name": name, "level": level})
        .execute()
    )
    return resp.data[0]["id"]


async def ensure_class_teacher(
    client: AsyncClient, class_id: str, teacher_id: str
) -> None:
    resp = (
        await client.table("class_teachers")
        .select("class_id")
        .eq("class_id", class_id)
        .eq("teacher_id", teacher_id)
        .execute()
    )
    if resp.data:
        return
    await client.table("class_teachers").insert(
        {"class_id": class_id, "teacher_id": teacher_id}
    ).execute()


async def ensure_class_student(
    client: AsyncClient, class_id: str, student_id: str
) -> None:
    # active 배정 (left_at IS NULL) 이 이미 있으면 skip
    resp = (
        await client.table("class_students")
        .select("id")
        .eq("class_id", class_id)
        .eq("student_id", student_id)
        .is_("left_at", "null")
        .execute()
    )
    if resp.data:
        return
    joined_at = (datetime.now(timezone.utc) - timedelta(days=14)).date().isoformat()
    await client.table("class_students").insert(
        {
            "class_id": class_id,
            "student_id": student_id,
            "joined_at": joined_at,
        }
    ).execute()


async def ensure_sessions_and_attendance(
    client: AsyncClient,
    class_id: str,
    student_id: str,
    teacher_id: str,
) -> tuple[int, int]:
    """최근 2주 월/수/금 14:00 UTC 세션 6개 + 학생 출결 6 row.

    멱등: '[DEV SEED]' 제목 세션이 이 반에 이미 있으면 전부 skip.
    """
    resp = (
        await client.table("sessions")
        .select("id")
        .eq("class_id", class_id)
        .like("title", "[DEV SEED]%")
        .execute()
    )
    if resp.data:
        return len(resp.data), 0

    today = datetime.now(timezone.utc)
    # 어제부터 14일 전까지 거꾸로 보면서 월(0)·수(2)·금(4)만 추리고, 최근 6개만.
    candidates: list[datetime] = []
    for days_ago in range(1, 15):
        d = today - timedelta(days=days_ago)
        if d.weekday() in (0, 2, 4):
            scheduled = d.replace(hour=14, minute=0, second=0, microsecond=0)
            candidates.append(scheduled)
    candidates.sort()  # 오래된 → 최신 순
    sessions_to_create = candidates[-6:]

    # 출결 패턴 — 캘린더에 색깔이 다양하게 보이도록 섞기
    pattern = ["present", "late", "present", "absent", "present", "present"]

    n_attendance = 0
    for i, scheduled in enumerate(sessions_to_create):
        s_resp = (
            await client.table("sessions")
            .insert(
                {
                    "class_id": class_id,
                    "scheduled_at": scheduled.isoformat(),
                    "title": f"[DEV SEED] {i + 1}회차",
                    "unit": f"단원 {i + 1}",
                }
            )
            .execute()
        )
        session_id = s_resp.data[0]["id"]

        status = pattern[i % len(pattern)]
        await client.table("attendance").insert(
            {
                "session_id": session_id,
                "student_id": student_id,
                "status": status,
                "marked_by": teacher_id,
            }
        ).execute()
        n_attendance += 1

    return len(sessions_to_create), n_attendance
