"""LOCAL DEV ONLY — 5개 역할 계정 + 학원/반/세션/출결 시딩.

각 역할별 계정 1개씩 생성하고(email_confirm=True 라 메일 안 가도 바로 활성),
테스트학원 + 반 1개 + 학생 1명 + 학부모 연결 + 최근 2주치 세션 6개 +
샘플 출결까지 함께 넣어서 모든 화면을 즉시 둘러볼 수 있게 만듭니다.

멱등: 다시 돌려도 안전. 이미 있으면 skip, 플래그 없이는 기존 비밀번호를 덮어쓰지 않음.
(비밀번호를 재설정하려면 --reset-passwords 플래그를 쓰세요. `@egong.test` 계정에
한해 비밀번호를 SEED_PASSWORD(기본 '***REMOVED***')로 재설정합니다.)

시드 세계를 완전히 새로 만들려면 --reset 플래그를 쓰세요. 시드가 소유한 학원 2개
(테스트학원·테스트학원2)와 `@egong.test` 계정을 전부 지운 뒤 처음부터 다시 시딩합니다.
ENVIRONMENT=production 에서는 안전장치가 실행을 거부합니다.

사용:
    cd backend
    ./.venv/Scripts/python.exe scripts/seed_dev_accounts.py
    ./.venv/Scripts/python.exe scripts/seed_dev_accounts.py --reset-passwords
    ./.venv/Scripts/python.exe scripts/seed_dev_accounts.py --reset

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
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(SCRIPT_DIR))

# Windows 콘솔 cp949 → 한글 깨짐 방지
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")

from seed import (
    ACADEMY_B_CLASS_NAME,
    ACADEMY_B_NAME,
    ACADEMY_NAME,
    ACCOUNTS,
    ACCOUNTS_B,
    ANNOUNCEMENT_TITLE,
    ASSIGNMENT_TITLE,
    CLASS_B_NAME,
    CLASS_NAME,
    EXTRA_STUDENT_ACCOUNT,
    MATERIAL_ALL_TITLE,
    MATERIAL_CLASS1_TITLE,
    MATERIAL_CLASS2_TITLE,
    QUESTION_TITLE,
    SEED_PASSWORD,
    is_seed_email,
)
from seed import (
    helpers as h,
)
from seed import (
    storage as st,
)
from seed.reset import reset_seed_world
from supabase import acreate_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("seed")


async def main(reset: bool = False, reset_passwords: bool = False) -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        log.error("SUPABASE_URL / SUPABASE_SECRET_KEY missing in backend/.env")
        return 2

    client = await acreate_client(url, key)

    if reset:
        stats = await reset_seed_world(client)
        log.info(
            "reset 완료: auth %d · 학원 %d · storage %d",
            stats["auth_users"], stats["academies"], stats["storage_objects"],
        )

    # 1. 학원
    academy_id = await h.get_or_create_academy(client, ACADEMY_NAME)
    log.info("academy  : %-20s %s", ACADEMY_NAME, academy_id)

    # 2. auth + users 프로필
    user_ids: dict[str, str] = {}
    for email, role, display_name in ACCOUNTS:
        user_id, created = await h.ensure_auth_user(client, email, display_name)
        if reset_passwords and not created and is_seed_email(email):
            await client.auth.admin.update_user_by_id(
                user_id, {"password": SEED_PASSWORD}
            )
            log.info("pwd  [RESET] %-7s %s", role, email)
        await h.ensure_users_row(
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
    teacher_id = await h.ensure_teacher(client, user_ids["teacher"], academy_id)
    student_id = await h.ensure_student(
        client, user_ids["student"], academy_id, "김학생"
    )
    parent_id = await h.ensure_parent(
        client, user_ids["parent"], "김부모", "010-1234-5678"
    )
    await h.ensure_student_parent(client, student_id, parent_id, "mother")
    log.info("teacher  : %s", teacher_id)
    log.info("student  : %s (김학생)", student_id)
    log.info("parent   : %s (김부모 — 김학생 mother)", parent_id)

    # 4. 반 + 배정
    class_id = await h.ensure_class(client, academy_id, CLASS_NAME, "elementary")
    await h.ensure_class_teacher(client, class_id, teacher_id)
    await h.ensure_class_student(client, class_id, student_id)
    log.info("class    : %-20s %s", CLASS_NAME, class_id)

    # 5. 최근 세션 + 출결
    n_sessions, n_attendance = await h.ensure_sessions_and_attendance(
        client, class_id, student_id, teacher_id
    )
    log.info("sessions : %d 개 (출결 row %d 개)", n_sessions, n_attendance)

    # 6. 반 2 (같은 학원 A) — 반 경계 검증용
    class_b_id = await h.ensure_class(client, academy_id, CLASS_B_NAME, "middle")
    await h.ensure_class_teacher(client, class_b_id, teacher_id)

    sb_email, sb_role, sb_name = EXTRA_STUDENT_ACCOUNT
    sb_user_id, _ = await h.ensure_auth_user(client, sb_email, sb_name)
    await h.ensure_users_row(
        client, user_id=sb_user_id, email=sb_email, role=sb_role,
        display_name=sb_name, academy_id=academy_id,
    )
    student_b_id = await h.ensure_student(client, sb_user_id, academy_id, sb_name)
    await h.ensure_class_student(client, class_b_id, student_b_id)
    log.info("class B  : %-20s %s", CLASS_B_NAME, class_b_id)

    # 7. 오늘 세션 (반 1) — teacher-day가 출결을 입력할 대상
    today_session_id = await h.ensure_today_session(client, class_id)
    log.info("today    : %s", today_session_id)

    # 8. 학원 B — 학원 경계 검증용
    academy_b_id = await h.get_or_create_academy(client, ACADEMY_B_NAME)
    b_user_ids: dict[str, str] = {}
    for email, role, display_name in ACCOUNTS_B:
        uid, _ = await h.ensure_auth_user(client, email, display_name)
        await h.ensure_users_row(
            client, user_id=uid, email=email, role=role,
            display_name=display_name, academy_id=academy_b_id,
        )
        b_user_ids[role] = uid
    class_ab_id = await h.ensure_class(
        client, academy_b_id, ACADEMY_B_CLASS_NAME, "middle"
    )
    student2_id = await h.ensure_student(
        client, b_user_ids["student"], academy_b_id, "정학생"
    )
    await h.ensure_class_student(client, class_ab_id, student2_id)
    log.info("academy B: %-20s %s", ACADEMY_B_NAME, academy_b_id)

    # 9. 콘텐츠 — 자료 3종(반1·반2·학원전체) + 과제·질문·공지
    f1 = await st.upload_material_file(client, academy_id, class_id, "반1자료.txt")
    f2 = await st.upload_material_file(client, academy_id, class_b_id, "반2자료.txt")
    fa = await st.upload_material_file(client, academy_id, None, "전체자료.txt")

    await h.ensure_material(
        client, academy_id=academy_id, class_id=class_id,
        title=MATERIAL_CLASS1_TITLE, files=[f1],
        created_by=user_ids["teacher"], author_name="이선생",
    )
    await h.ensure_material(
        client, academy_id=academy_id, class_id=class_b_id,
        title=MATERIAL_CLASS2_TITLE, files=[f2],
        created_by=user_ids["teacher"], author_name="이선생",
    )
    await h.ensure_material(
        client, academy_id=academy_id, class_id=None,
        title=MATERIAL_ALL_TITLE, files=[fa],
        created_by=user_ids["owner"], author_name="박원장",
    )
    await h.ensure_assignment(
        client, academy_id=academy_id, class_id=class_id,
        title=ASSIGNMENT_TITLE,
        created_by=user_ids["teacher"], author_name="이선생",
    )
    await h.ensure_question(
        client, academy_id=academy_id, class_id=class_id,
        student_id=student_id, title=QUESTION_TITLE, author_name="김학생",
    )
    await h.ensure_announcement(
        client, academy_id=academy_id, class_id=class_id,
        title=ANNOUNCEMENT_TITLE,
        created_by=user_ids["owner"], author_name="박원장",
    )
    log.info("contents : 자료 3 · 과제 1 · 질문 1 · 공지 1")

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
    parser.add_argument(
        "--reset",
        action="store_true",
        help="시드 소유 학원 2개와 @egong.test 계정을 전부 지우고 새로 만든다",
    )
    args = parser.parse_args()
    sys.exit(
        asyncio.run(main(reset=args.reset, reset_passwords=args.reset_passwords))
    )
