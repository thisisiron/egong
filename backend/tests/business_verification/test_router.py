"""Unit tests for business verification router.

NTS API 호출은 httpx mock으로 차단 — 외부 의존성 없이 테스트.
"""

import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_status_rejects_short_b_no(client):
    response = await client.post("/api/v1/business/status", json={"b_no": "12345"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_status_rejects_no_b_no(client):
    response = await client.post("/api/v1/business/status", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_status_active_business(client):
    """NTS API mock — 계속사업자."""
    nts_response = {
        "match_cnt": 1,
        "request_cnt": 1,
        "status_code": "OK",
        "data": [
            {
                "b_no": "1234567890",
                "b_stt": "계속사업자",
                "b_stt_cd": "01",
                "tax_type": "부가가치세 일반과세자",
                "tax_type_cd": "01",
                "end_dt": "",
            }
        ],
    }

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json = lambda: nts_response

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.business_verification.service.httpx.AsyncClient", return_value=mock_client):
        response = await client.post(
            "/api/v1/business/status", json={"b_no": "123-45-67890"}
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["found"] is True
    assert body["status_kind"] == "active"
    assert body["status_label"] == "계속사업자"
    assert body["tax_type_label"] == "부가가치세 일반과세자"
    assert body["raw_b_no"] == "1234567890"


@pytest.mark.asyncio
async def test_status_closed_business_with_end_date(client):
    """폐업자."""
    nts_response = {
        "match_cnt": 1,
        "data": [
            {
                "b_no": "9999999999",
                "b_stt": "폐업자",
                "b_stt_cd": "03",
                "tax_type": "부가가치세 일반과세자",
                "tax_type_cd": "01",
                "end_dt": "20200115",
            }
        ],
    }

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json = lambda: nts_response

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.business_verification.service.httpx.AsyncClient", return_value=mock_client):
        response = await client.post("/api/v1/business/status", json={"b_no": "9999999999"})

    body = response.json()
    assert body["status_kind"] == "closed"
    assert body["status_label"] == "폐업자"
    assert body["end_date"] == "2020-01-15"


@pytest.mark.asyncio
async def test_status_unknown_business(client):
    """NTS가 빈 data 반환 — 미등록 번호."""
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json = lambda: {"match_cnt": 0, "data": []}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.business_verification.service.httpx.AsyncClient", return_value=mock_client):
        response = await client.post("/api/v1/business/status", json={"b_no": "0000000000"})

    body = response.json()
    assert body["found"] is False
    assert body["status_kind"] == "unknown"
