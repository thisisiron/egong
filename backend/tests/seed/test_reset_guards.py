"""--reset 안전장치 — DB 없이 검증한다."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from seed.reset import assert_reset_allowed


def test_production_환경에서는_거부한다(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(RuntimeError, match="production"):
        assert_reset_allowed()


def test_development_환경에서는_통과한다(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    # 반환값 없음(None) — 예외를 던지지 않고 조용히 리턴하는 게 "허용됨"의 의미다.
    # 호출 자체가 이 테스트의 검증: 예외가 나면 여기서 실패한다.
    assert_reset_allowed()
