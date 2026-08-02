"""definer RPC 인가. da060c2(미인증 fail-open + anon EXECUTE) 회귀 방지.

da060c2는 독립된 두 가지를 고쳤다: (1) 각 definer 함수 내부의
`IF auth.uid() IS NULL THEN RAISE EXCEPTION` 가드, (2) anon으로부터의 EXECUTE 회수.
아래 test_anon_*·test_authenticated_역할에는_열려_있다는 (2)만 검증한다 — GRANT를
그대로 둔 채 CREATE OR REPLACE로 (1)의 가드만 지워도 이 파일이 통째로 초록불이었다.
test_인증_안_된_authenticated_호출은_함수_내부_가드에_막힌다가 (1)을 메운다.

DEFINER_FUNCS(존재·anon 회수·authenticated 부여 검증)에는 상담 RPC 4종도 포함한다 —
Supabase가 pg_default_acl로 anon에 직접 EXECUTE를 부여하므로, 마이그레이션이 REVOKE를
빠뜨리면 이 목록에 없는 한 아무 테스트도 잡아내지 못한다. 다만 그 4종은 인자 개수·타입이
notify_*(단일 uuid)와 달라 test_인증_안_된_authenticated_호출은_함수_내부_가드에_막힌다의
`SELECT {func}(%s)` 단일 인자 호출 템플릿을 그대로 못 쓴다 — 그 테스트는 NOTIFY_FUNCS만
쓰고, cancel_consultation 쪽 동일 가드는 test_consultations.py::test_미인증_호출은_거부된다가
이미 검증한다.
"""

import uuid

import psycopg
import pytest

from .conftest import as_unauthenticated

pytestmark = pytest.mark.rls

NOTIFY_FUNCS = [
    "notify_assignment_submitted",
    "notify_assignment_feedback",
    "notify_question_created",
    "notify_question_reply",
]

# 상담 신청·상태 전이 RPC(20260802000002_consultation_rpc.sql). 인자 시그니처가 각기
# 달라 단일 uuid 인자 호출 템플릿에 못 태우므로 존재·GRANT/REVOKE 검증에만 쓴다.
CONSULTATION_FUNCS = [
    "request_consultation",
    "confirm_consultation",
    "reject_consultation",
    "cancel_consultation",
]

DEFINER_FUNCS = NOTIFY_FUNCS + CONSULTATION_FUNCS


def _oids(db, name: str) -> list[int]:
    return [
        r[0]
        for r in db.execute(
            "SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
            "WHERE n.nspname = 'public' AND p.proname = %s",
            (name,),
        ).fetchall()
    ]


@pytest.mark.parametrize("func", DEFINER_FUNCS)
def test_함수가_존재한다(db, func):
    assert _oids(db, func), f"{func}가 없습니다 — 이름이 바뀌었다면 목록을 갱신하세요"


@pytest.mark.parametrize("func", DEFINER_FUNCS)
def test_anon은_EXECUTE_권한이_없다(db, func):
    oids = _oids(db, func)
    assert oids, f"{func}가 없습니다 — 이름이 바뀌었다면 목록을 갱신하세요"
    for oid in oids:
        granted = db.execute(
            "SELECT has_function_privilege('anon', %s, 'EXECUTE')", (oid,)
        ).fetchone()[0]
        assert granted is False, f"anon에 {func} EXECUTE가 열려 있습니다"


@pytest.mark.parametrize("func", DEFINER_FUNCS)
def test_authenticated_역할에는_열려_있다(db, func):
    """대조군 — 전부 막혀 있어서 통과하는 상황을 구분한다."""
    oids = _oids(db, func)
    assert oids, f"{func}가 없습니다 — 이름이 바뀌었다면 목록을 갱신하세요"
    for oid in oids:
        granted = db.execute(
            "SELECT has_function_privilege('authenticated', %s, 'EXECUTE')", (oid,)
        ).fetchone()[0]
        assert granted is True, f"authenticated가 {func}를 못 씁니다 — 기능이 깨집니다"


@pytest.mark.parametrize("func", NOTIFY_FUNCS)
def test_인증_안_된_authenticated_호출은_함수_내부_가드에_막힌다(db, func):
    """GRANT가 아니라 `IF auth.uid() IS NULL THEN RAISE EXCEPTION` 그 자체를 검증한다.

    anon으로 호출하면 EXECUTE 권한이 없어 권한 에러로 막히므로 가드 로직을 전혀 타보지
    못한다(위 test_anon_*이 이미 그 경로를 검증함). 여기서는 EXECUTE는 있지만 JWT가 없는
    authenticated 컨텍스트(as_unauthenticated — request.jwt.claims 미설정이라
    auth.uid() IS NULL)로 직접 호출해, 함수가 실제로 정확히 그 가드 문구('권한이
    없습니다.')로 죽는지 확인한다. id가 존재하지 않아도 각 함수는 auth.uid() 체크를
    다른 어떤 조회보다 먼저 수행하므로(20260726000002/3 마이그레이션), 임의의 uuid로
    충분하다 — 메시지가 다르면('제출을 찾을 수 없습니다' 등) 가드가 아니라 다른 이유로
    실패한 것이므로 통과시키지 않는다.
    """
    arbitrary_id = str(uuid.uuid4())
    with as_unauthenticated(db) as c, pytest.raises(psycopg.Error, match="권한이 없습니다") as exc_info:
        c.execute(f"SELECT {func}(%s)", (arbitrary_id,))
    assert exc_info.value.sqlstate != "42501", (
        f"{func} 호출이 GRANT 부재(insufficient_privilege)로 막혔습니다 — "
        "as_unauthenticated는 EXECUTE 권한은 있는 authenticated여야 하는데, "
        "권한 부여 자체가 빠져 있다면 이 테스트는 가드를 검증하지 못합니다"
    )
