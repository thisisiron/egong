"""시드 세계 삭제 — 학원 스코프로만. LOCAL DEV ONLY.

전체 truncate를 쓰지 않는 이유: 클라우드 프로젝트에서 되돌릴 수 없다. 학원 스코프 삭제는
'테스트 전용 프로젝트'라는 전제가 깨져도 폭발 반경이 시드 데이터로 묶인다.

삭제는 FK CASCADE에 맡긴다 — auth 유저 삭제가 users→teachers/parents를,
academy 삭제가 classes→sessions→attendance 및 콘텐츠 전부를 끌고 내려간다.
"""

from __future__ import annotations

import logging
import os

from supabase import AsyncClient

from .storage import delete_material_files_under
from .world import ACADEMY_B_NAME, ACADEMY_NAME, is_seed_email

log = logging.getLogger("seed")

SEED_ACADEMY_NAMES = [ACADEMY_NAME, ACADEMY_B_NAME]


def assert_reset_allowed() -> None:
    """운영 환경에서는 어떤 경로로도 실행되지 않는다."""
    env = os.environ.get("ENVIRONMENT", "development").strip().lower()
    if env == "production":
        raise RuntimeError(
            "ENVIRONMENT=production 에서는 --reset을 실행할 수 없습니다."
        )


async def reset_seed_world(client: AsyncClient) -> dict[str, int]:
    assert_reset_allowed()

    # 1. 삭제 대상 학원 id — 이름 화이트리스트로만. 못 찾으면 그 학원은 건너뛴다.
    resp = (
        await client.table("academy")
        .select("id,name")
        .in_("name", SEED_ACADEMY_NAMES)
        .execute()
    )
    academy_ids = [row["id"] for row in resp.data]
    log.info("reset: 대상 학원 %d개 %s", len(academy_ids), academy_ids)

    # 2. storage 먼저 — academy 행이 사라지면 id를 알 수 없다
    n_objects = (
        await delete_material_files_under(client, academy_ids) if academy_ids else 0
    )
    log.info("reset: storage 객체 %d개 삭제", n_objects)

    # 3. 시드 auth 유저 — 도메인 가드를 통과한 것만
    n_users = 0
    page = 1
    seed_user_ids: list[str] = []
    while True:
        users = await client.auth.admin.list_users(page=page, per_page=100)
        if not users:
            break
        for u in users:
            if u.email and is_seed_email(u.email):
                seed_user_ids.append(u.id)
        if len(users) < 100:
            break
        page += 1
    if seed_user_ids:
        # admin_audit_log.admin_user_id는 NOT NULL인데 FK는 ON DELETE SET NULL이라
        # (20260526000004_audit_log.sql) auth 유저 삭제 시 캐스케이드가 NOT NULL 제약과
        # 충돌해 GoTrue가 "Database error deleting user"(500)로 실패한다. 스키마는
        # 건드리지 않고, 삭제 대상 유저(=시드 화이트리스트) 소유 감사 로그만 먼저 지운다 —
        # 여전히 seed_user_ids로 스코프가 묶여 있으므로 화이트리스트 원칙은 유지된다.
        await client.table("admin_audit_log").delete().in_(
            "admin_user_id", seed_user_ids
        ).execute()

    for uid in seed_user_ids:
        await client.auth.admin.delete_user(uid)
        n_users += 1
    log.info("reset: auth 유저 %d개 삭제 (users/teachers/parents 캐스케이드)", n_users)

    # 4. 학원 — 나머지 전부가 캐스케이드로 따라 내려간다
    for academy_id in academy_ids:
        await client.table("academy").delete().eq("id", academy_id).execute()
    log.info("reset: 학원 %d개 삭제 (콘텐츠·반·세션·출결 캐스케이드)", len(academy_ids))

    return {
        "auth_users": n_users,
        "academies": len(academy_ids),
        "storage_objects": n_objects,
    }
