"""--reset 안전장치 — DB 없이 검증한다."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from seed.reset import assert_reset_allowed  # noqa: E402


def test_production_환경에서는_거부한다(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(RuntimeError, match="production"):
        assert_reset_allowed()


def test_development_환경에서는_통과한다(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    assert_reset_allowed() is None
