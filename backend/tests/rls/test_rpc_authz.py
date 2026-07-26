"""notify_* RPC 인가. da060c2(미인증 fail-open + anon EXECUTE) 회귀 방지."""

import pytest

pytestmark = pytest.mark.rls

NOTIFY_FUNCS = [
    "notify_assignment_submitted",
    "notify_assignment_feedback",
    "notify_question_created",
    "notify_question_reply",
]


def _oids(db, name: str) -> list[int]:
    return [
        r[0]
        for r in db.execute(
            "SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
            "WHERE n.nspname = 'public' AND p.proname = %s",
            (name,),
        ).fetchall()
    ]


@pytest.mark.parametrize("func", NOTIFY_FUNCS)
def test_함수가_존재한다(db, func):
    assert _oids(db, func), f"{func}가 없습니다 — 이름이 바뀌었다면 목록을 갱신하세요"


@pytest.mark.parametrize("func", NOTIFY_FUNCS)
def test_anon은_EXECUTE_권한이_없다(db, func):
    for oid in _oids(db, func):
        granted = db.execute(
            "SELECT has_function_privilege('anon', %s, 'EXECUTE')", (oid,)
        ).fetchone()[0]
        assert granted is False, f"anon에 {func} EXECUTE가 열려 있습니다"


@pytest.mark.parametrize("func", NOTIFY_FUNCS)
def test_authenticated_역할에는_열려_있다(db, func):
    """대조군 — 전부 막혀 있어서 통과하는 상황을 구분한다."""
    for oid in _oids(db, func):
        granted = db.execute(
            "SELECT has_function_privilege('authenticated', %s, 'EXECUTE')", (oid,)
        ).fetchone()[0]
        assert granted is True, f"authenticated가 {func}를 못 씁니다 — 기능이 깨집니다"
