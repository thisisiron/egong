"""하네스 자체 검증. 이 파일이 실패하면 다른 RLS 테스트 결과는 전부 무의미하다."""

import pytest

from .conftest import as_user, count

pytestmark = pytest.mark.rls


def test_서비스롤은_모든_학원을_본다(db):
    """대조군 — role 전환 없이는 RLS가 우회된다는 사실을 명시적으로 고정한다."""
    assert count(db, "SELECT count(*) FROM academy") >= 2


def test_authenticated_전환이_실제로_시야를_좁힌다(db, uids, ids):
    """학원 A 원장은 정확히 자기 학원 하나만 봐야 한다.

    2개 이상이면 role 전환이 안 먹은 것(RLS 우회). 0개면 GRANT 누락·정책
    과잉 제한 같은 다른 버그다 — 둘 다 이 assert 하나로 잡는다(부등식이면
    0개 케이스를 놓친다).
    """
    with as_user(db, uids["owner"]) as c:
        visible = {
            str(row[0]) for row in c.execute("SELECT id FROM academy").fetchall()
        }
    assert visible == {ids["academy_a"]}, (
        f"원장이 학원 {len(visible)}개를 봤습니다({visible}). "
        "SET LOCAL role='authenticated'가 적용되지 않았거나(너무 많이 보임) "
        "GRANT·정책이 과도하게 제한적일(너무 적게 보임) 가능성이 높습니다 — "
        "이 상태로는 RLS 테스트가 거짓 통과하거나 거짓 실패합니다."
    )


def test_롤백되어_상태가_새지_않는다(db, uids):
    """as_user 트랜잭션 안의 변경이 종료 후 사라지는지 — RLS 정책과 무관한 신호로 확인한다.

    도메인 테이블에 쓰면 authenticated 롤의 쓰기 정책에 따라 permission
    error가 나거나(정책이 막으면) 아예 통과 여부가 RLS 쓰기 규칙 얘기가
    되어버린다. 대신 세션 커스텀 GUC를 쓴다: Postgres는 트랜잭션 블록
    안에서 실행된 SET(LOCAL이 아닌 일반 SET)의 효과를, 그 트랜잭션이
    롤백되면 함께 되돌린다는 것을 문서로 보장한다. 그래서 이 프로브는
    강제 롤백이 실제로 일어나는지에 대해 사실만 알려주고, 어떤 테이블
    권한에도 의존하지 않으며, 실패하더라도 세션 변수 하나 외에는 아무
    흔적도 남기지 않는다.
    """
    db.execute("SELECT set_config('rls_probe.marker', 'baseline', false)")
    with as_user(db, uids["owner"]) as c:
        c.execute("SELECT set_config('rls_probe.marker', 'mutated', false)")
        during = c.execute("SELECT current_setting('rls_probe.marker')").fetchone()[0]
        assert during == "mutated", "트랜잭션 안에서조차 값이 바뀌지 않았다 — 프로브 자체가 고장남"
    after = db.execute("SELECT current_setting('rls_probe.marker')").fetchone()[0]
    assert after == "baseline", (
        f"트랜잭션 종료 후에도 GUC가 '{after}'로 남아있습니다(기대값 'baseline'). "
        "force_rollback이 실제로 롤백을 수행하지 않았거나 as_user가 트랜잭션을 "
        "열지 않았을 가능성이 높습니다."
    )
