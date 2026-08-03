"""class_stats_for_month RPC 인가.

이 RPC는 SECURITY DEFINER라 RLS를 우회한다 — 권한 판정이 함수 본문의 가드
하나뿐이므로, 그 가드가 깨지면 타 학원 반 지표가 그대로 새어나간다.
비인가는 에러가 아니라 빈 결과여야 한다(반 존재 여부도 누설하지 않는다).
"""

import json

import pytest

from .conftest import as_user

pytestmark = pytest.mark.rls

MONTH = "2026-08-01"


def _rows(db, month: str = MONTH) -> list[tuple]:
    return db.execute(
        "SELECT class_id, class_name FROM class_stats_for_month(%s)", (month,)
    ).fetchall()


def test_owner는_자기_학원_전체_반을_본다(db, uids, ids):
    with as_user(db, uids["owner"]) as c:
        rows = _rows(c)
    class_ids = {str(r[0]) for r in rows}
    assert ids["class1"] in class_ids, "원장에게 class1이 안 보입니다"
    assert ids["class2"] in class_ids, "원장에게 class2가 안 보입니다"


def test_owner에게_타_학원_반은_안_보인다(db, uids, ids):
    with as_user(db, uids["owner"]) as c:
        rows = _rows(c)
    class_ids = {str(r[0]) for r in rows}
    assert ids["class_b"] not in class_ids, "타 학원 반이 새어나갑니다"


def test_teacher는_담당_반만_본다(db, uids):
    # 기대 집합은 RLS 컨텍스트 밖(서비스 롤)에서 먼저 구한다 —
    # as_user 안에서 구하면 RLS에 걸러진 목록과 RLS에 걸러진 결과를 비교하게 되어
    # 둘 다 비어 있어도 통과하는 무의미한 단언이 된다.
    taught = {
        str(r[0])
        for r in db.execute(
            "SELECT ct.class_id FROM class_teachers ct "
            "JOIN teachers t ON t.id = ct.teacher_id "
            "WHERE t.user_id = %s",
            (uids["teacher"],),
        ).fetchall()
    }
    assert taught, "시드에 선생님 담당 반이 없습니다 — pnpm run seed:reset 먼저 실행하세요"

    with as_user(db, uids["teacher"]) as c:
        rows = _rows(c)
    class_ids = {str(r[0]) for r in rows}
    assert class_ids == taught, "선생님 결과가 담당 반 집합과 다릅니다"


def test_teacher에게_담당_아닌_반은_안_보인다(db, uids, ids):
    with as_user(db, uids["teacher"]) as c:
        rows = _rows(c)
    class_ids = {str(r[0]) for r in rows}
    not_taught = {
        str(r[0])
        for r in db.execute(
            "SELECT c.id FROM classes c "
            "WHERE c.academy_id = %s "
            "  AND c.id NOT IN ("
            "    SELECT ct.class_id FROM class_teachers ct "
            "    JOIN teachers t ON t.id = ct.teacher_id WHERE t.user_id = %s)",
            (ids["academy_a"], uids["teacher"]),
        ).fetchall()
    }
    assert not_taught, "시드에 선생님이 담당하지 않는 반이 없어 검사 불가 — 시드를 확인하세요"
    assert not (class_ids & not_taught), "담당하지 않는 반이 결과에 섞여 있습니다"


def test_teacher는_같은_학원의_새로_만든_미배정_반은_안_본다(db, uids, ids):
    """seed는 teacher@egong.test를 학원 A의 '모든' 반에 배정해 둔다. 그래서
    scope CTE에서 `c.id IN (SELECT app_my_taught_class_ids())` 절이 통째로
    삭제되어 학원 필터만 남는 회귀가 생겨도, 위 test_teacher_* 들은 전부
    (우연히) 통과한다 — 선생님이 안 보면 안 되는 반이 애초에 시드에 없기
    때문이다. 이 테스트만이 그 구멍을 메운다: 트랜잭션 안에서 학원 A에
    반을 하나 새로 만들고 teacher를 배정하지 '않은' 채로,
    - owner에게는 보이고(반이 실제로 존재/가시함을 증명)
    - teacher에게는 안 보이는지(담당 배정 가드가 살아있는지)
    를 직접 확인한다.

    INSERT는 반드시 as_user로 role을 authenticated로 전환하기 '전'에
    실행한다 — as_user는 진입하자마자 SET LOCAL role='authenticated'를
    걸어 RLS를 켜므로, 그 뒤에 INSERT하면 정책에 막히거나(권한 없음) 혹은
    운 좋게 통과하더라도 "누구 시점에서 만들었는지"가 불분명해진다.
    끝나면 트랜잭션 전체가 롤백되어 아무 것도 남지 않는다.
    """
    with db.transaction(force_rollback=True):
        new_class_id = str(
            db.execute(
                "INSERT INTO classes (academy_id, name, level) "
                "VALUES (%s, %s, 'elementary') RETURNING id",
                (ids["academy_a"], "미배정-테스트반"),
            ).fetchone()[0]
        )

        db.execute("SET LOCAL role = 'authenticated'")
        db.execute(
            "SELECT set_config('request.jwt.claims', %s, true)",
            (json.dumps({"sub": uids["owner"], "role": "authenticated"}),),
        )
        owner_class_ids = {str(r[0]) for r in _rows(db)}

        db.execute("SET LOCAL role = 'authenticated'")
        db.execute(
            "SELECT set_config('request.jwt.claims', %s, true)",
            (json.dumps({"sub": uids["teacher"], "role": "authenticated"}),),
        )
        teacher_class_ids = {str(r[0]) for r in _rows(db)}

    assert new_class_id in owner_class_ids, (
        "새로 만든 반이 원장에게도 안 보입니다 — 반 생성 자체를 확인하세요 "
        "(이게 실패하면 아래 teacher 단언은 '반이 없어서 통과'하는 거짓 양성입니다)"
    )
    assert new_class_id not in teacher_class_ids, (
        "담당 배정이 없는 새 반이 선생님 결과에 새어나갑니다 — "
        "scope CTE의 app_my_taught_class_ids() 절을 확인하세요"
    )


def test_student는_빈_결과다(db, uids):
    with as_user(db, uids["student"]) as c:
        assert _rows(c) == [], "학생에게 반 지표가 노출됩니다"


def test_parent는_빈_결과다(db, uids):
    with as_user(db, uids["parent"]) as c:
        assert _rows(c) == [], "학부모에게 반 지표가 노출됩니다"


def test_타_학원_owner는_자기_학원_반만_본다(db, uids, ids):
    with as_user(db, uids["owner2"]) as c:
        rows = _rows(c)
    class_ids = {str(r[0]) for r in rows}
    assert ids["class1"] not in class_ids, "학원 A의 반이 학원 B 원장에게 보입니다"
    assert ids["class2"] not in class_ids, "학원 A의 반이 학원 B 원장에게 보입니다"


def test_anon은_EXECUTE_권한이_없다(db):
    oid = db.execute(
        "SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname = 'public' AND p.proname = 'class_stats_for_month'"
    ).fetchone()
    assert oid, "class_stats_for_month가 없습니다 — 마이그레이션이 적용됐는지 확인하세요"
    granted = db.execute(
        "SELECT has_function_privilege('anon', %s, 'EXECUTE')", (oid[0],)
    ).fetchone()[0]
    assert granted is False, "anon에 class_stats_for_month EXECUTE가 열려 있습니다"


def test_월_파라미터가_정규화된다(db, uids):
    """월 중간 날짜를 넘겨도 1일을 넘긴 것과 같은 결과여야 한다."""
    with as_user(db, uids["owner"]) as c:
        first = _rows(c, "2026-08-01")
        middle = _rows(c, "2026-08-17")
    assert first == middle, "p_month 정규화(date_trunc)가 동작하지 않습니다"
