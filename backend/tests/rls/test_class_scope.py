"""같은 학원 안 반 경계. 2b17710(mfiles_member_read 크로스클래스 유출) 회귀 방지."""

import pytest
from seed.world import MATERIAL_ALL_TITLE, MATERIAL_CLASS1_TITLE, MATERIAL_CLASS2_TITLE

from .conftest import as_user, material_file_count

pytestmark = pytest.mark.rls


def test_학생은_자기_반_자료만_본다(db, uids):
    with as_user(db, uids["student"]) as c:
        titles = {
            r[0]
            for r in c.execute("SELECT title FROM materials").fetchall()
        }
    assert MATERIAL_CLASS1_TITLE in titles
    assert MATERIAL_ALL_TITLE in titles
    assert MATERIAL_CLASS2_TITLE not in titles


def test_학생은_타반_자료_파일을_못_본다(db, uids, ids):
    """행이 아니라 storage.objects — 파일 경로 세그먼트 검사가 살아있는지."""
    with as_user(db, uids["student"]) as c:
        mine = material_file_count(c, ids["academy_a"], ids["class1"])
        theirs = material_file_count(c, ids["academy_a"], ids["class2"])
        shared = material_file_count(c, ids["academy_a"], "all")
    # mine은 정확히 1이 아니라 >=1: teacher-day.spec.ts가 매 실행마다 같은
    # {academy_a}/{class1}/ 접두사에 파일을 하나 더 업로드한다(MaterialForm.tsx의
    # pathPrefix). --reset 없이 test:scenario를 반복 돌리면 시드 1개 + e2e 업로드 n개가
    # 쌓여 카운트가 늘어나는 게 정상 동작이다 — 여기서 == 1로 되돌리지 말 것.
    assert mine >= 1, "자기 반 파일이 안 보이면 시드 또는 정책이 깨진 것"
    assert shared == 1, "학원 전체 파일은 보여야 한다"
    assert theirs == 0, "타 반 파일이 보입니다 — 크로스클래스 유출 회귀"


def test_학부모도_자녀_반_파일만_본다(db, uids, ids):
    with as_user(db, uids["parent"]) as c:
        mine = material_file_count(c, ids["academy_a"], ids["class1"])
        shared = material_file_count(c, ids["academy_a"], "all")
        theirs = material_file_count(c, ids["academy_a"], ids["class2"])
    # mine >= 1인 이유는 위 test_학생은_타반_자료_파일을_못_본다 참고 — teacher-day.spec.ts가
    # 같은 접두사에 반복 업로드하므로 정확히 1로 고정할 수 없다.
    assert mine >= 1, "자녀 반(class1) 파일이 안 보이면 시드 또는 정책이 깨진 것"
    assert shared == 1, "학원 전체 파일은 보여야 한다"
    assert theirs == 0, "타 반 파일이 보입니다 — 크로스클래스 유출 회귀"


def test_반2_학생은_반1_자료를_못_본다(db, uids):
    with as_user(db, uids["student_b"]) as c:
        titles = {
            r[0]
            for r in c.execute("SELECT title FROM materials").fetchall()
        }
    assert MATERIAL_CLASS2_TITLE in titles
    assert MATERIAL_CLASS1_TITLE not in titles
