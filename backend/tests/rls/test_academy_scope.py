"""학원 간 격리. 멀티테넌트의 1차 방어선."""

import pytest

from .conftest import as_user, count

pytestmark = pytest.mark.rls


def test_원장은_타학원_반을_못_본다(db, uids, ids):
    with as_user(db, uids["owner"]) as c:
        mine = count(
            c, "SELECT count(*) FROM classes WHERE academy_id = %s", ids["academy_a"]
        )
        n = count(
            c, "SELECT count(*) FROM classes WHERE academy_id = %s", ids["academy_b"]
        )
    assert mine >= 1, "원장이 자기 학원 반도 못 보면 정책이 전면 차단된 것"
    assert n == 0


def test_원장은_타학원_학생을_못_본다(db, uids, ids):
    with as_user(db, uids["owner"]) as c:
        mine = count(
            c, "SELECT count(*) FROM students WHERE academy_id = %s", ids["academy_a"]
        )
        n = count(
            c, "SELECT count(*) FROM students WHERE academy_id = %s", ids["academy_b"]
        )
    assert mine >= 1, "원장이 자기 학원 학생도 못 보면 정책이 전면 차단된 것"
    assert n == 0


def test_학부모는_타학원_학생을_못_본다(db, uids, ids):
    with as_user(db, uids["parent"]) as c:
        mine = count(
            c, "SELECT count(*) FROM students WHERE academy_id = %s", ids["academy_a"]
        )
        theirs = count(
            c, "SELECT count(*) FROM students WHERE academy_id = %s", ids["academy_b"]
        )
    assert mine >= 1, "자녀가 안 보이면 시드 또는 정책이 깨진 것"
    assert theirs == 0


def test_타학원_학생은_이쪽_콘텐츠를_못_본다(db, uids, ids):
    with as_user(db, uids["student2"]) as c:
        mine = count(
            c, "SELECT count(*) FROM classes WHERE academy_id = %s", ids["academy_b"]
        )
        assert mine >= 1, "학생2가 자기 반도 못 보면 세션/정책이 전면 차단된 것"
        for table in ("announcements", "assignments", "questions", "materials"):
            n = count(
                c,
                f"SELECT count(*) FROM {table} WHERE academy_id = %s",
                ids["academy_a"],
            )
            assert n == 0, f"{table}에서 타학원 데이터 {n}건이 보입니다"


def test_타학원_학생은_이쪽_출결을_못_본다(db, uids, ids):
    with as_user(db, uids["student2"]) as c:
        mine = count(
            c, "SELECT count(*) FROM classes WHERE academy_id = %s", ids["academy_b"]
        )
        n = count(
            c,
            "SELECT count(*) FROM attendance a "
            "JOIN sessions s ON s.id = a.session_id "
            "JOIN classes cl ON cl.id = s.class_id "
            "WHERE cl.academy_id = %s",
            ids["academy_a"],
        )
    assert mine >= 1, "학생2가 자기 반도 못 보면 세션/정책이 전면 차단된 것"
    assert n == 0
