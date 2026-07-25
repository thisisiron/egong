"""seed_dev_accounts.py --reset-passwords 의 도메인 가드 테스트.

실수로 실제 사용자의 비밀번호를 덮어쓰는 사고를 막는 유일한 방어선이므로
테스트로 고정한다. scripts/ 는 pythonpath(src)에 없어 파일 경로로 직접 로드한다.
"""

import importlib.util
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "seed_dev_accounts.py"


def _load_seed_module():
    spec = importlib.util.spec_from_file_location("seed_dev_accounts", SCRIPT_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


seed = _load_seed_module()


@pytest.mark.parametrize(
    "email",
    [
        "owner@egong.test",
        "admin@egong.test",
        "STUDENT@EGONG.TEST",
        "  teacher@egong.test  ",
    ],
)
def test_seed_emails_are_resettable(email):
    assert seed.is_seed_email(email) is True


@pytest.mark.parametrize(
    "email",
    [
        "owner@ildomath.kr",
        "kuku@egong.com",
        "knkal@naver.com",
        "attacker@egong.test.evil.com",
        "",
    ],
)
def test_real_emails_are_not_resettable(email):
    assert seed.is_seed_email(email) is False
