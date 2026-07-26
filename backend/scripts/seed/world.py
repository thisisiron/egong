"""시드가 만들 세계의 정의 — '무엇을' 만드는지만 담는다. 만드는 방법은 helpers.py."""

from __future__ import annotations

import os

SEED_PASSWORD = os.environ.get("SEED_PASSWORD", "***REMOVED***")

ACADEMY_NAME = "테스트학원"
ACADEMY_B_NAME = "테스트학원2"
CLASS_NAME = "초등 미술반"
CLASS_B_NAME = "중등 수학반"  # 학원 A의 두 번째 반 — 반 경계 검증용
ACADEMY_B_CLASS_NAME = "타학원반"  # 학원 B의 반 — 학원 경계 검증용

SEED_EMAIL_DOMAIN = "@egong.test"

# (email, role, display_name)
ACCOUNTS: list[tuple[str, str, str]] = [
    ("admin@egong.test", "admin", "Egong 운영자"),
    ("owner@egong.test", "owner", "박원장"),
    ("teacher@egong.test", "teacher", "이선생"),
    ("student@egong.test", "student", "김학생"),
    ("parent@egong.test", "parent", "김부모"),
]

# 학원 A의 두 번째 학생 — 반 2에만 속한다
EXTRA_STUDENT_ACCOUNT: tuple[str, str, str] = (
    "student-b@egong.test", "student", "박학생"
)

# 학원 B 계정 — 학원 간 격리 검증용
ACCOUNTS_B: list[tuple[str, str, str]] = [
    ("owner2@egong.test", "owner", "최원장"),
    ("student2@egong.test", "student", "정학생"),
]


def is_seed_email(email: str) -> bool:
    """시드가 소유한 계정인지 판정. 실제 사용자 계정 보호를 위한 도메인 가드."""
    return email.strip().lower().endswith(SEED_EMAIL_DOMAIN)
