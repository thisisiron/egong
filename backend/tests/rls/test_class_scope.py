"""같은 학원 안 반 경계. 2b17710(mfiles_member_read 크로스클래스 유출) 회귀 방지."""

import pytest

from .conftest import as_user, count

pytestmark = pytest.mark.rls


def test_학생은_자기_반_자료만_본다(db, uids):
    with as_user(db, uids["student"]) as c:
        titles = {
            r[0]
            for r in c.execute("SELECT title FROM materials").fetchall()
        }
    assert "[SEED] 반1 전용 자료" in titles
    assert "[SEED] 학원 전체 자료" in titles
    assert "[SEED] 반2 전용 자료" not in titles


def test_학생은_타반_자료_파일을_못_본다(db, uids, ids):
    """행이 아니라 storage.objects — 파일 경로 세그먼트 검사가 살아있는지."""
    with as_user(db, uids["student"]) as c:
        mine = count(
            c,
            "SELECT count(*) FROM storage.objects "
            "WHERE bucket_id = 'material-files' AND name LIKE %s",
            f"{ids['academy_a']}/{ids['class1']}/%",
        )
        theirs = count(
            c,
            "SELECT count(*) FROM storage.objects "
            "WHERE bucket_id = 'material-files' AND name LIKE %s",
            f"{ids['academy_a']}/{ids['class2']}/%",
        )
        shared = count(
            c,
            "SELECT count(*) FROM storage.objects "
            "WHERE bucket_id = 'material-files' AND name LIKE %s",
            f"{ids['academy_a']}/all/%",
        )
    assert mine == 1, "자기 반 파일이 안 보이면 시드 또는 정책이 깨진 것"
    assert shared == 1, "학원 전체 파일은 보여야 한다"
    assert theirs == 0, "타 반 파일이 보입니다 — 크로스클래스 유출 회귀"


def test_학부모도_자녀_반_파일만_본다(db, uids, ids):
    with as_user(db, uids["parent"]) as c:
        theirs = count(
            c,
            "SELECT count(*) FROM storage.objects "
            "WHERE bucket_id = 'material-files' AND name LIKE %s",
            f"{ids['academy_a']}/{ids['class2']}/%",
        )
    assert theirs == 0


def test_반2_학생은_반1_자료를_못_본다(db, uids):
    with as_user(db, uids["student_b"]) as c:
        titles = {
            r[0]
            for r in c.execute("SELECT title FROM materials").fetchall()
        }
    assert "[SEED] 반2 전용 자료" in titles
    assert "[SEED] 반1 전용 자료" not in titles
