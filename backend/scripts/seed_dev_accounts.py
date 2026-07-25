"""LOCAL DEV ONLY — 5개 역할 계정 + 학원/반/세션/출결 시딩.

각 역할별 계정 1개씩 생성하고(email_confirm=True 라 메일 안 가도 바로 활성),
테스트학원 + 반 1개 + 학생 1명 + 학부모 연결 + 최근 2주치 세션 6개 +
샘플 출결까지 함께 넣어서 모든 화면을 즉시 둘러볼 수 있게 만듭니다.

멱등: 다시 돌려도 안전. 이미 있으면 skip, 기존 비밀번호는 절대 덮어쓰지 않음.
(만약 비밀번호를 잊었다면 Supabase Studio → Auth → user → Send password recovery
또는 직접 reset 하세요.)

사용:
    cd backend
    ./.venv/Scripts/python.exe scripts/seed_dev_accounts.py

환경변수:
    SEED_PASSWORD (기본 '***REMOVED***') — 신규 생성되는 모든 계정에 동일하게 사용
    SUPABASE_URL, SUPABASE_SECRET_KEY — backend/.env 에서 로드
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

# Windows 콘솔 cp949 → 한글 깨짐 방지
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")

from supabase import AsyncClient, acreate_client  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("seed")

SEED_PASSWORD = os.environ.get("SEED_PASSWORD", "***REMOVED***")
ACADEMY_NAME = "테스트학원"
CLASS_NAME = "초등 미술반"

# (email, role, display_name)
ACCOUNTS: list[tuple[str, str, str]] = [
    ("admin@egong.test", "admin", "Egong 운영자"),
    ("owner@egong.test", "owner", "박원장"),
    ("teacher@egong.test", "teacher", "이선생"),
    ("student@egong.test", "student", "김학생"),
    ("parent@egong.test", "parent", "김부모"),
]

SEED_EMAIL_DOMAIN = "@egong.test"


def is_seed_email(email: str) -> bool:
    """--reset-passwords 대상인지 판정. 실제 사용자 계정 보호를 위한 도메인 가드."""
    return email.strip().lower().endswith(SEED_EMAIL_DOMAIN)


async def main(reset_passwords: bool = False) -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        log.error("SUPABASE_URL / SUPABASE_SECRET_KEY missing in backend/.env")
        return 2

    client = await acreate_client(url, key)

    # 1. 학원
    academy_id = await get_or_create_academy(client)
    log.info("academy  : %-20s %s", ACADEMY_NAME, academy_id)

    # 2. auth + users 프로필
    user_ids: dict[str, str] = {}
    for email, role, display_name in ACCOUNTS:
        user_id, created = await ensure_auth_user(client, email, display_name)
        if reset_passwords and not created and is_seed_email(email):
            await client.auth.admin.update_user_by_id(
                user_id, {"password": SEED_PASSWORD}
            )
            log.info("pwd  [RESET] %-7s %s", role, email)
        await ensure_users_row(
            client,
            user_id=user_id,
            email=email,
            role=role,
            display_name=display_name,
            academy_id=None if role == "admin" else academy_id,
        )
        user_ids[role] = user_id
        tag = "NEW" if created else "ok "
        log.info("user [%s] %-7s %s", tag, role, email)

    # 3. 도메인 row
    teacher_id = await ensure_teacher(client, user_ids["teacher"], academy_id)
    student_id = await ensure_student(
        client, user_ids["student"], academy_id, "김학생"
    )
    parent_id = await ensure_parent(
        client, user_ids["parent"], "김부모", "010-1234-5678"
    )
    await ensure_student_parent(client, student_id, parent_id, "mother")
    log.info("teacher  : %s", teacher_id)
    log.info("student  : %s (김학생)", student_id)
    log.info("parent   : %s (김부모 — 김학생 mother)", parent_id)

    # 4. 반 + 배정
    class_id = await ensure_class(client, academy_id, CLASS_NAME, "elementary")
    await ensure_class_teacher(client, class_id, teacher_id)
    await ensure_class_student(client, class_id, student_id)
    log.info("class    : %-20s %s", CLASS_NAME, class_id)

    # 5. 최근 세션 + 출결
    n_sessions, n_attendance = await ensure_sessions_and_attendance(
        client, class_id, student_id, teacher_id
    )
    log.info("sessions : %d 개 (출결 row %d 개)", n_sessions, n_attendance)

    print()
    print("=" * 60)
    print(f"  DEV ACCOUNTS  (비밀번호: {SEED_PASSWORD})")
    print("=" * 60)
    for email, role, _ in ACCOUNTS:
        print(f"  {role:8s} {email}")
    print("=" * 60)
    print()
    print("  로그인: http://localhost:3000/login")
    print(f"  학원명: {ACADEMY_NAME}")
    print(f"  반명  : {CLASS_NAME}")
    print()
    return 0


# ----- 멱등 helper들 -----


async def get_or_create_academy(client: AsyncClient) -> str:
    resp = (
        await client.table("academy").select("id").eq("name", ACADEMY_NAME).execute()
    )
    if resp.data:
        return resp.data[0]["id"]
    resp = (
        await client.table("academy")
        .insert({"name": ACADEMY_NAME, "status": "active"})
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="LOCAL DEV ONLY — 5개 역할 계정 + 학원/반/세션/출결 시딩."
    )
    parser.add_argument(
        "--reset-passwords",
        action="store_true",
        help="@egong.test 계정의 비밀번호를 SEED_PASSWORD로 재설정 "
        "(기본 동작은 기존 비밀번호 유지)",
    )
    args = parser.parse_args()
    sys.exit(asyncio.run(main(reset_passwords=args.reset_passwords)))
