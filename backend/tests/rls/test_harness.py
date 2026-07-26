"""하네스 자체 검증. 이 파일이 실패하면 다른 RLS 테스트 결과는 전부 무의미하다."""

import pytest

from .conftest import as_user, count

pytestmark = pytest.mark.rls


def test_서비스롤은_모든_학원을_본다(db):
    """대조군 — role 전환 없이는 RLS가 우회된다는 사실을 명시적으로 고정한다."""
    assert count(db, "SELECT count(*) FROM academy") >= 2


def test_authenticated_전환이_실제로_시야를_좁힌다(db, uids):
    """학원 A 원장은 학원을 2개 다 보지 못한다. 여기서 2가 나오면 role 전환이 안 먹은 것."""
    with as_user(db, uids["owner"]) as c:
        visible = count(c, "SELECT count(*) FROM academy")
    assert visible < 2, (
        f"원장이 학원 {visible}개를 봤습니다. SET LOCAL role='authenticated'가 "
        "적용되지 않았을 가능성이 높습니다 — 이 상태로는 모든 RLS 테스트가 거짓 통과합니다."
    )


def test_롤백되어_상태가_새지_않는다(db, uids):
    before = count(db, "SELECT count(*) FROM announcements")
    with as_user(db, uids["owner"]):
        pass
    assert count(db, "SELECT count(*) FROM announcements") == before
