"""상담 신청 권한 경계 — 학부모 쓰기 경로가 처음 열리는 테이블이라 특히 촘촘히.

이 테이블은 어떤 역할에도 INSERT/UPDATE 정책을 주지 않는다(admin 제외). 모든 쓰기가
definer RPC 경유이므로, 여기서는 "직접 쓰기가 막히는가"와 "SELECT 범위"를 검증하고
RPC 동작은 test_consultation_rpc 쪽(Task 2)에서 다룬다.
"""

import datetime as dt
import json
from contextlib import contextmanager

import pytest

pytestmark = pytest.mark.rls


def claims(user_id: str) -> str:
    """as_user와 같은 형식의 JWT 클레임 — 한 트랜잭션 안에서 역할을 바꿀 때 쓴다."""
    return json.dumps({"sub": user_id, "role": "authenticated"})


@pytest.fixture
def parent_ctx(db, uids):
    """시드 학부모(김부모)의 parent_id·자녀 student_id·academy_id."""
    row = db.execute(
        "SELECT p.id, p.name, s.id, s.name, s.academy_id "
        "FROM parents p "
        "JOIN student_parent sp ON sp.parent_id = p.id "
        "JOIN students s ON s.id = sp.student_id "
        "WHERE p.user_id = %s",
        (uids["parent"],),
    ).fetchone()
    assert row is not None, "시드 학부모-자녀 연결이 없습니다 — pnpm seed:reset 먼저"
    return {
        "parent_id": str(row[0]),
        "parent_name": row[1],
        "student_id": str(row[2]),
        "student_name": row[3],
        "academy_id": str(row[4]),
    }


@contextmanager
def seeded(db, ctx, *, user_id, status="requested", reason="[TEST] 상담"):
    """service-role로 상담 1건을 심고 나서 authenticated로 전환한다.

    as_user는 트랜잭션을 열자마자 role을 바꾸므로, RLS 우회 삽입이 필요한 이 케이스는
    직접 트랜잭션을 연다. force_rollback이라 커밋되지 않는다 — 시드가 오염되지 않는다.
    """
    with db.transaction(force_rollback=True):
        preferred = (dt.date.today() + dt.timedelta(days=7)).isoformat()
        cid = db.execute(
            "INSERT INTO consultations (academy_id, student_id, parent_id, status, "
            "preferred_date, preferred_slot, reason, student_name, parent_name) "
            "VALUES (%s, %s, %s, %s, %s, 'afternoon', %s, %s, %s) RETURNING id",
            (
                ctx["academy_id"], ctx["student_id"], ctx["parent_id"], status,
                preferred, reason, ctx["student_name"], ctx["parent_name"],
            ),
        ).fetchone()[0]
        db.execute("SET LOCAL role = 'authenticated'")
        db.execute("SELECT set_config('request.jwt.claims', %s, true)", (claims(user_id),))
        yield cid


def test_학부모는_자기_상담을_본다(db, uids, parent_ctx):
    """양성 단언 — SELECT 정책이 전부를 막아버리는 회귀를 잡는다."""
    with seeded(db, parent_ctx, user_id=uids["parent"]) as cid:
        n = db.execute(
            "SELECT count(*) FROM consultations WHERE id = %s", (cid,)
        ).fetchone()[0]
    assert n == 1, "본인 상담이 안 보이면 consultations_parent_select가 깨진 것"


def test_학부모는_상담을_직접_INSERT할_수_없다(db, uids, parent_ctx):
    """쓰기 정책이 없으므로 실패해야 한다 — 이름 스냅샷 위조 차단."""
    with seeded(db, parent_ctx, user_id=uids["parent"]):
        preferred = (dt.date.today() + dt.timedelta(days=8)).isoformat()
        with pytest.raises(Exception):
            db.execute(
                "INSERT INTO consultations (academy_id, student_id, parent_id, status, "
                "preferred_date, preferred_slot, reason, student_name, parent_name) "
                "VALUES (%s, %s, %s, 'requested', %s, 'afternoon', '직접 삽입', "
                "'위조된이름', '위조된이름')",
                (
                    parent_ctx["academy_id"], parent_ctx["student_id"],
                    parent_ctx["parent_id"], preferred,
                ),
            )


def test_학부모는_상담을_직접_수정할_수_없다(db, uids, parent_ctx):
    """UPDATE 정책이 없으므로 영향 행 0이어야 한다 — 상태 조작 차단."""
    with seeded(db, parent_ctx, user_id=uids["parent"]) as cid:
        n = db.execute(
            "UPDATE consultations SET status = 'confirmed' WHERE id = %s", (cid,)
        ).rowcount
    assert n == 0, "학부모가 상담 상태를 직접 바꿀 수 있습니다 — 정책 회귀"


def test_선생님은_학원_상담을_이름과_함께_본다(db, uids, parent_ctx):
    """teacher는 담당 반이 아니라 학원 전체를 본다. 이름은 조인이 아니라 스냅샷이라
    teacher가 students/parents를 못 읽어도 표시된다 — 이 스냅샷이 존재 이유다."""
    with seeded(db, parent_ctx, user_id=uids["teacher"]) as cid:
        row = db.execute(
            "SELECT student_name, parent_name FROM consultations WHERE id = %s", (cid,)
        ).fetchone()
    assert row is not None, "선생님에게 학원 상담이 안 보입니다"
    assert row[0] == parent_ctx["student_name"]
    assert row[1] == parent_ctx["parent_name"]


def test_타학원_원장은_상담을_못_본다(db, uids, parent_ctx):
    with seeded(db, parent_ctx, user_id=uids["owner2"]) as cid:
        n = db.execute(
            "SELECT count(*) FROM consultations WHERE id = %s", (cid,)
        ).fetchone()[0]
    assert n == 0, "타 학원 원장에게 상담이 보입니다 — 학원 경계 유출"


def test_대기중_상담은_학생당_한_건만(db, uids, parent_ctx):
    """service-role(RLS 우회)로도 막혀야 한다 — DB 제약이 진짜 방어선.

    시드 상담(김학생)과 충돌하지 않도록 다른 학생(student_b)으로 검증한다.
    consultations.parent_id는 student_parent 연결과 무관한 독립 FK라 시드 학부모를
    그대로 재사용해도 된다 — 여기서 보는 건 unique 인덱스뿐이다.
    """
    other = db.execute(
        "SELECT id, name, academy_id FROM students WHERE user_id = %s",
        (uids["student_b"],),
    ).fetchone()
    assert other is not None, "시드 student_b가 없습니다 — pnpm seed:reset 먼저"

    with db.transaction(force_rollback=True):
        preferred = (dt.date.today() + dt.timedelta(days=7)).isoformat()
        args = (
            str(other[2]), str(other[0]), parent_ctx["parent_id"],
            preferred, other[1], parent_ctx["parent_name"],
        )
        sql = (
            "INSERT INTO consultations (academy_id, student_id, parent_id, status, "
            "preferred_date, preferred_slot, reason, student_name, parent_name) "
            "VALUES (%s, %s, %s, 'requested', %s, 'afternoon', '중복 검증', %s, %s)"
        )
        db.execute(sql, args)
        with pytest.raises(Exception):
            db.execute(sql, args)
