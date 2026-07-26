"""RLS 테스트 하네스 — Postgres 직결로 사용자 시점을 흉내낸다.

DATABASE_URL(session pooler)로 붙어 SET LOCAL role='authenticated' +
request.jwt.claims 를 걸고 SELECT 한다. 서비스 롤은 RLS를 우회하므로
role 전환이 빠지면 모든 테스트가 무의미하게 통과한다 — test_harness.py가 감시한다.

runbooks/ildomath-onboarding.md §8의 수동 절차를 코드로 옮긴 것.
"""

from __future__ import annotations

import json
import os
from contextlib import contextmanager
from pathlib import Path

import pytest
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")

psycopg = pytest.importorskip("psycopg")

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
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("DATABASE_URL 미설정 — RLS 테스트를 건너뜁니다")
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
            pytest.skip(f"시드 계정 {email} 없음 — seed_dev_accounts.py --reset 먼저")
        out[key] = str(row[0])
    return out


@pytest.fixture(scope="session")
def ids(db) -> dict[str, str]:
    def one(sql: str, *params) -> str:
        row = db.execute(sql, params).fetchone()
        if row is None:
            pytest.skip(f"시드 데이터 없음: {sql} {params}")
        return str(row[0])

    academy_a = one("SELECT id FROM academy WHERE name = %s", "테스트학원")
    academy_b = one("SELECT id FROM academy WHERE name = %s", "테스트학원2")
    return {
        "academy_a": academy_a,
        "academy_b": academy_b,
        "class1": one(
            "SELECT id FROM classes WHERE academy_id = %s AND name = %s",
            academy_a, "초등 미술반",
        ),
        "class2": one(
            "SELECT id FROM classes WHERE academy_id = %s AND name = %s",
            academy_a, "중등 수학반",
        ),
        "class_b": one(
            "SELECT id FROM classes WHERE academy_id = %s AND name = %s",
            academy_b, "타학원반",
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
