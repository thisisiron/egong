"""RLS 테스트 하네스 — Postgres 직결로 사용자 시점을 흉내낸다.

DATABASE_URL(session pooler)로 붙어 SET LOCAL role='authenticated' +
request.jwt.claims 를 걸고 SELECT 한다. 서비스 롤은 RLS를 우회하므로
role 전환이 빠지면 모든 테스트가 무의미하게 통과한다 — test_harness.py가 감시한다.

runbooks/ildomath-onboarding.md §8의 수동 절차를 코드로 옮긴 것.
"""

from __future__ import annotations

import json
import os
import sys
from contextlib import contextmanager
from pathlib import Path

import pytest
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")

# psycopg는 pyproject.toml의 dev extra에 하드 의존성으로 박혀 있다(psycopg[binary]>=3.3.0).
# addopts="-m 'not rls'" 때문에 이 conftest는 `-m rls`를 명시했을 때만 로드되므로,
# import 실패는 "RLS 스위트를 건너뛸 이유"가 아니라 "개발 환경이 깨졌다"는 신호다 —
# 조용히 skip하면 권한 회귀 스위트 전체가 통과한 것처럼 보인다.
import psycopg

# scripts/seed가 시드 리터럴의 소스 오브 트루스다(world.py 자체 주석이 드리프트 금지를 경고).
# tests/seed/test_reset_guards.py와 동일한 패턴으로 backend/scripts를 sys.path에 얹어
# 재입력 대신 import한다.
sys.path.insert(0, str(BACKEND_DIR / "scripts"))
from seed.world import (
    ACADEMY_B_CLASS_NAME,
    ACADEMY_B_NAME,
    ACADEMY_NAME,
    CLASS_B_NAME,
    CLASS_NAME,
)

SEED_EMAILS = {
    "owner": "owner@egong.test",
    "teacher": "teacher@egong.test",
    "student": "student@egong.test",
    "parent": "parent@egong.test",
    "student_b": "student-b@egong.test",
    "owner2": "owner2@egong.test",
    "student2": "student2@egong.test",
}


@pytest.fixture(scope="session")
def db():
    # addopts="-m 'not rls'"가 기본 실행에서 이 conftest를 통째로 배제하므로, 이 fixture는
    # 누군가 명시적으로 `-m rls`를 지정했을 때만 실행된다 — 그 상황에서 DATABASE_URL이
    # 없다고 skip하면 "권한 회귀 스위트가 통과했다"는 거짓 신호를 낸다. fail로 멈춘다.
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.fail(
            "DATABASE_URL 미설정 — 루트 .env에 DATABASE_URL(세션 풀러 URL)을 설정하고 "
            "pnpm env:sync를 다시 실행하세요 "
            "(RLS 테스트는 -m rls로 명시 실행했을 때만 로드되므로 skip이 아니라 fail)"
        )
    with psycopg.connect(url, autocommit=True) as conn:
        yield conn


@pytest.fixture(scope="session")
def uids(db) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, email in SEED_EMAILS.items():
        row = db.execute(
            "SELECT id FROM users WHERE email = %s", (email,)
        ).fetchone()
        if row is None:
            pytest.fail(
                f"시드 계정 {email} 없음 — "
                "저장소 루트에서 `pnpm seed:reset` 먼저 실행하세요"
            )
        out[key] = str(row[0])
    return out


@pytest.fixture(scope="session")
def ids(db) -> dict[str, str]:
    def one(sql: str, *params) -> str:
        row = db.execute(sql, params).fetchone()
        if row is None:
            pytest.fail(
                f"시드 데이터 없음: {sql} {params} — "
                "저장소 루트에서 `pnpm seed:reset` 먼저 실행하세요"
            )
        return str(row[0])

    academy_a = one("SELECT id FROM academy WHERE name = %s", ACADEMY_NAME)
    academy_b = one("SELECT id FROM academy WHERE name = %s", ACADEMY_B_NAME)
    return {
        "academy_a": academy_a,
        "academy_b": academy_b,
        "class1": one(
            "SELECT id FROM classes WHERE academy_id = %s AND name = %s",
            academy_a, CLASS_NAME,
        ),
        "class2": one(
            "SELECT id FROM classes WHERE academy_id = %s AND name = %s",
            academy_a, CLASS_B_NAME,
        ),
        "class_b": one(
            "SELECT id FROM classes WHERE academy_id = %s AND name = %s",
            academy_b, ACADEMY_B_CLASS_NAME,
        ),
    }


@contextmanager
def as_user(db, user_id: str):
    """user_id 시점으로 RLS를 적용받는 트랜잭션. 끝나면 항상 롤백한다.

    SET LOCAL role='authenticated' 이 핵심 — 이게 없으면 서비스 롤로 조회되어
    RLS가 통째로 우회된다.
    """
    with db.transaction(force_rollback=True):
        db.execute("SET LOCAL role = 'authenticated'")
        db.execute(
            "SELECT set_config('request.jwt.claims', %s, true)",
            (json.dumps({"sub": user_id, "role": "authenticated"}),),
        )
        yield db


@contextmanager
def as_unauthenticated(db):
    """authenticated 롤로 전환하되 request.jwt.claims는 세팅하지 않는다 — auth.uid()가
    NULL인 상태를 흉내낸다.

    anon과는 다르다: anon은 notify_* EXECUTE 권한 자체가 없어(GRANT 회수) 호출이 권한
    에러로 막히므로, 함수 '내부'의 `IF auth.uid() IS NULL THEN RAISE EXCEPTION` 가드를
    전혀 실행해보지 못한다. 이 헬퍼는 EXECUTE는 있지만 인증 컨텍스트(JWT)가 없는 상태를
    만들어, 그 가드 자체가 살아있는지 직접 검증할 수 있게 한다.
    """
    with db.transaction(force_rollback=True):
        db.execute("SET LOCAL role = 'authenticated'")
        yield db


def count(db, sql: str, *params) -> int:
    return db.execute(sql, params).fetchone()[0]


def material_file_count(db, academy_id: str, segment: str) -> int:
    """material-files 버킷에서 {academy_id}/{segment}/ 접두사 아래 오브젝트 수.

    segment는 class_id 또는 리터럴 'all'. mfiles_member_read의
    path-segment 검사(academy·class)를 그대로 흉내내는 조회.
    """
    return count(
        db,
        "SELECT count(*) FROM storage.objects "
        "WHERE bucket_id = 'material-files' AND name LIKE %s",
        f"{academy_id}/{segment}/%",
    )
