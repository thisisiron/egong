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


# ===== 신청·상태 전이 RPC =====
#
# 한 트랜잭션 안에서 set_config로 역할을 바꿔가며 검증한다. as_user처럼 트랜잭션을
# 나누면 앞 단계에서 만든 행이 롤백되어 보이지 않는다.


@contextmanager
def acting_as(db, user_id):
    """authenticated 롤 + 해당 사용자 클레임으로 시작하는 롤백 트랜잭션."""
    with db.transaction(force_rollback=True):
        db.execute("SET LOCAL role = 'authenticated'")
        db.execute("SELECT set_config('request.jwt.claims', %s, true)", (claims(user_id),))
        yield db


def switch_to(db, user_id):
    """같은 트랜잭션 안에서 다른 사용자로 전환."""
    db.execute("SELECT set_config('request.jwt.claims', %s, true)", (claims(user_id),))


def _request(db, student_id, days=7, reason="[TEST] RPC 신청"):
    return db.execute(
        "SELECT request_consultation(%s, %s, 'afternoon', %s)",
        (student_id, (dt.date.today() + dt.timedelta(days=days)), reason),
    ).fetchone()[0]


def test_학부모는_RPC로_상담을_신청한다(db, uids, parent_ctx):
    """양성 단언 — 이름 스냅샷이 서버에서 채워지는지까지 확인한다."""
    with db.transaction(force_rollback=True):
        # 시드 상담(requested)과 uq_consultation_pending이 충돌하지 않도록 먼저 비운다.
        # role을 낮추기 전에 해야 한다 — authenticated로 내려간 뒤에는 되돌릴 수 없다.
        # force_rollback이라 이 DELETE는 커밋되지 않는다.
        db.execute(
            "DELETE FROM consultations WHERE student_id = %s AND status = 'requested'",
            (parent_ctx["student_id"],),
        )
        db.execute("SET LOCAL role = 'authenticated'")
        switch_to(db, uids["parent"])

        cid = _request(db, parent_ctx["student_id"])
        assert cid is not None
        sname, pname, status = db.execute(
            "SELECT student_name, parent_name, status FROM consultations WHERE id = %s",
            (cid,),
        ).fetchone()
    assert sname == parent_ctx["student_name"]
    assert pname == parent_ctx["parent_name"]
    assert status == "requested"


def test_학부모는_남의_자녀로_신청할_수_없다(db, uids):
    other = db.execute(
        "SELECT id FROM students WHERE user_id = %s", (uids["student_b"],)
    ).fetchone()
    assert other is not None, "시드 student_b가 없습니다"
    with acting_as(db, uids["parent"]) as c:
        with pytest.raises(Exception, match="내 자녀가 아닙니다"):
            _request(c, str(other[0]), reason="[TEST] 남의 자녀")


def test_학부모는_확정_RPC를_직접_호출할_수_없다(db, uids, parent_ctx):
    """PostgREST /rpc 직접 호출 방어 — 정책이 아니라 함수 내부 가드가 막아야 한다."""
    with seeded(db, parent_ctx, user_id=uids["parent"]) as cid:
        future = dt.datetime.now(dt.UTC) + dt.timedelta(days=7)
        with pytest.raises(Exception, match="권한이 없습니다"):
            db.execute("SELECT confirm_consultation(%s, %s, NULL)", (cid, future)).fetchone()


def test_선생님은_상담을_확정한다(db, uids, parent_ctx):
    with seeded(db, parent_ctx, user_id=uids["teacher"]) as cid:
        future = dt.datetime.now(dt.UTC) + dt.timedelta(days=7)
        db.execute(
            "SELECT confirm_consultation(%s, %s, '상담실에서 뵙겠습니다')", (cid, future)
        ).fetchone()
        status, sched, handler = db.execute(
            "SELECT status, scheduled_at, handler_name FROM consultations WHERE id = %s",
            (cid,),
        ).fetchone()
    assert status == "confirmed"
    assert sched is not None
    assert handler == "이선생", "handler_name 스냅샷이 채워지지 않았습니다"


def test_이미_확정된_상담은_다시_확정되지_않는다(db, uids, parent_ctx):
    """낙관적 잠금 — 두 선생님이 동시에 눌러도 한 번만 성사된다."""
    with seeded(db, parent_ctx, user_id=uids["teacher"]) as cid:
        future = dt.datetime.now(dt.UTC) + dt.timedelta(days=7)
        db.execute("SELECT confirm_consultation(%s, %s, NULL)", (cid, future)).fetchone()
        with pytest.raises(Exception, match="이미 처리된"):
            db.execute("SELECT confirm_consultation(%s, %s, NULL)", (cid, future)).fetchone()


def test_과거_시각으로는_확정할_수_없다(db, uids, parent_ctx):
    with seeded(db, parent_ctx, user_id=uids["teacher"]) as cid:
        past = dt.datetime.now(dt.UTC) - dt.timedelta(days=1)
        with pytest.raises(Exception, match="지난 시각"):
            db.execute("SELECT confirm_consultation(%s, %s, NULL)", (cid, past)).fetchone()


def test_반려는_사유가_필요하다(db, uids, parent_ctx):
    with seeded(db, parent_ctx, user_id=uids["teacher"]) as cid:
        with pytest.raises(Exception, match="반려 사유"):
            db.execute("SELECT reject_consultation(%s, '')", (cid,)).fetchone()


def test_학부모는_확정된_상담을_취소할_수_있다(db, uids, parent_ctx):
    """확정 후 취소는 허용한다 — 막으면 전화로 돌아가 기능의 의미가 없어진다."""
    with seeded(db, parent_ctx, user_id=uids["teacher"]) as cid:
        future = dt.datetime.now(dt.UTC) + dt.timedelta(days=7)
        db.execute("SELECT confirm_consultation(%s, %s, NULL)", (cid, future)).fetchone()

        switch_to(db, uids["parent"])
        db.execute("SELECT cancel_consultation(%s, '사정이 생겨 취소합니다')", (cid,)).fetchone()
        status = db.execute(
            "SELECT status FROM consultations WHERE id = %s", (cid,)
        ).fetchone()[0]
    assert status == "cancelled"


def test_미인증_호출은_거부된다(db):
    """auth.uid() IS NULL 가드가 살아있는지 — 없으면 NULL 비교로 fail-open."""
    from .conftest import as_unauthenticated

    with as_unauthenticated(db) as c:
        with pytest.raises(Exception, match="권한이 없습니다"):
            c.execute(
                "SELECT cancel_consultation('00000000-0000-0000-0000-000000000000', NULL)"
            ).fetchone()


# ===== 리뷰 후속 — 반려·취소 알림, 크로스 테넌트 가드 =====
#
# uids["parent"]는 parent_ctx가 조회 기준으로 삼은 학부모 계정의 user_id와 동일하다
# (parent_ctx 픽스처가 "parents p WHERE p.user_id = uids['parent']"로 조회하므로).
# notifications는 self-read 정책만 있어(user_id = auth.uid()), 학부모 앞으로 간
# 알림을 확인하려면 switch_to로 학부모 시점으로 바꾼 뒤 조회해야 한다.


def test_반려_성공시_상태와_알림이_기록된다(db, uids, parent_ctx):
    """반려 성공 경로 — handler_name 스냅샷 + 학부모 알림까지 확인한다.

    기존 test_반려는_사유가_필요하다는 UPDATE 이전에 예외로 빠지므로 이 경로가
    한 번도 실행되지 않았다.
    """
    with seeded(db, parent_ctx, user_id=uids["teacher"]) as cid:
        db.execute(
            "SELECT reject_consultation(%s, '이번 주는 일정이 어렵습니다')", (cid,)
        ).fetchone()
        status, handler, note = db.execute(
            "SELECT status, handler_name, response_note FROM consultations WHERE id = %s",
            (cid,),
        ).fetchone()

        switch_to(db, uids["parent"])
        n = db.execute(
            "SELECT count(*) FROM notifications "
            "WHERE user_id = %s AND source_id = %s AND type = 'consultation' "
            "AND link = '/me/consultations'",
            (uids["parent"], cid),
        ).fetchone()[0]
    assert status == "rejected"
    assert handler == "이선생"
    assert note == "이번 주는 일정이 어렵습니다"
    assert n == 1, "반려 알림이 학부모에게 생성되지 않았습니다"


def test_스태프가_취소하면_학부모에게_알림이_간다(db, uids, parent_ctx):
    """cancel_consultation의 학원 분기 — 학부모가 취소했을 때 스태프에게 가는
    기존 케이스와 알림 방향이 반대라는 점이 요지다."""
    with seeded(db, parent_ctx, user_id=uids["teacher"]) as cid:
        db.execute(
            "SELECT cancel_consultation(%s, '강사 사정으로 취소합니다')", (cid,)
        ).fetchone()
        status = db.execute(
            "SELECT status FROM consultations WHERE id = %s", (cid,)
        ).fetchone()[0]

        switch_to(db, uids["parent"])
        n = db.execute(
            "SELECT count(*) FROM notifications "
            "WHERE user_id = %s AND source_id = %s AND type = 'consultation' "
            "AND link = '/me/consultations'",
            (uids["parent"], cid),
        ).fetchone()[0]
    assert status == "cancelled"
    assert n == 1, "학원이 취소했는데 학부모 알림이 생성되지 않았습니다"


def test_확정되면_학부모에게_알림이_간다(db, uids, parent_ctx):
    """알림이 이 태스크의 절반이라는 브리프 근거를 실제로 검증한다."""
    with seeded(db, parent_ctx, user_id=uids["teacher"]) as cid:
        future = dt.datetime.now(dt.UTC) + dt.timedelta(days=7)
        db.execute("SELECT confirm_consultation(%s, %s, NULL)", (cid, future)).fetchone()

        switch_to(db, uids["parent"])
        n = db.execute(
            "SELECT count(*) FROM notifications "
            "WHERE user_id = %s AND source_id = %s AND type = 'consultation' "
            "AND link = '/me/consultations'",
            (uids["parent"], cid),
        ).fetchone()[0]
    assert n == 1, "확정 알림이 학부모에게 생성되지 않았습니다"


def test_타학원_원장은_상담을_확정할_수_없다(db, uids, parent_ctx):
    """크로스 테넌트 가드 — SECURITY DEFINER가 RLS를 우회하므로 함수 내부의
    u.academy_id = v_academy_id 비교만이 유일한 방어선이다."""
    with seeded(db, parent_ctx, user_id=uids["owner2"]) as cid:
        future = dt.datetime.now(dt.UTC) + dt.timedelta(days=7)
        with pytest.raises(Exception, match="권한이 없습니다"):
            db.execute("SELECT confirm_consultation(%s, %s, NULL)", (cid, future)).fetchone()


def test_타학원_원장은_상담을_취소할_수_없다(db, uids, parent_ctx):
    """cancel_consultation은 학부모 분기(v_is_parent)가 따로 있어 가드 구조가
    confirm/reject와 다르므로 별도로 검증한다."""
    with seeded(db, parent_ctx, user_id=uids["owner2"]) as cid:
        with pytest.raises(Exception, match="권한이 없습니다"):
            db.execute("SELECT cancel_consultation(%s, NULL)", (cid,)).fetchone()
