"""Unit tests for business verification router.

NTS API 호출은 httpx mock으로 차단 — 외부 의존성 없이 테스트.
"""

import httpx
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


@pytest.mark.asyncio
async def test_status_paused_business(client):
    """휴업자 (b_stt_cd=02)."""
    nts_response = {
        "match_cnt": 1,
        "data": [
            {
                "b_no": "1111111111",
                "b_stt": "휴업자",
                "b_stt_cd": "02",
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
        response = await client.post("/api/v1/business/status", json={"b_no": "1111111111"})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status_kind"] == "paused"
    assert body["status_label"] == "휴업자"


@pytest.mark.asyncio
async def test_status_unmapped_status_code(client):
    """b_stt_cd가 BUSINESS_STATUS_CODES에 없는 경우 — unknown으로 fallback."""
    nts_response = {
        "match_cnt": 1,
        "data": [
            {
                "b_no": "2222222222",
                "b_stt": "확인불가",
                "b_stt_cd": "99",
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
        response = await client.post("/api/v1/business/status", json={"b_no": "2222222222"})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["found"] is True
    assert body["status_kind"] == "unknown"
    assert body["status_label"] == "확인불가"


@pytest.mark.asyncio
async def test_status_nts_returns_non_200(client):
    """NTS API가 500 반환 — 502로 변환."""
    mock_resp = AsyncMock()
    mock_resp.status_code = 500
    mock_resp.text = "internal"

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.business_verification.service.httpx.AsyncClient", return_value=mock_client):
        response = await client.post("/api/v1/business/status", json={"b_no": "1234567890"})

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_status_nts_network_error(client):
    """httpx 네트워크 오류 — 502로 변환."""
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=httpx.ConnectError("boom"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.business_verification.service.httpx.AsyncClient", return_value=mock_client):
        response = await client.post("/api/v1/business/status", json={"b_no": "1234567890"})

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_validate_match_with_status(client):
    """일치 케이스 — status 동봉."""
    nts_response = {
        "request_cnt": 1,
        "valid_cnt": 1,
        "status_code": "OK",
        "data": [
            {
                "b_no": "1209862762",
                "valid": "01",
                "status": {
                    "b_no": "1209862762",
                    "b_stt": "계속사업자",
                    "b_stt_cd": "01",
                    "tax_type": "부가가치세 면세사업자",
                    "tax_type_cd": "04",
                    "end_dt": "",
                },
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

    with patch(
        "src.business_verification.service.httpx.AsyncClient",
        return_value=mock_client,
    ):
        response = await client.post(
            "/api/v1/business/validate",
            json={"b_no": "120-98-62762", "p_nm": "김민지", "start_dt": "2023-10-13"},
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["valid_kind"] == "match"
    assert body["valid_label"] == "진위확인 일치"
    assert body["status_kind"] == "active"
    assert body["status_label"] == "계속사업자"
    assert body["tax_type_label"] == "부가가치세 면세사업자"
    assert body["raw_b_no"] == "1209862762"


@pytest.mark.asyncio
async def test_validate_mismatch(client):
    """불일치 케이스 — status 빠짐."""
    nts_response = {
        "request_cnt": 1,
        "status_code": "OK",
        "data": [
            {
                "b_no": "1209862762",
                "valid": "02",
                "valid_msg": "확인할 수 없습니다.",
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

    with patch(
        "src.business_verification.service.httpx.AsyncClient",
        return_value=mock_client,
    ):
        response = await client.post(
            "/api/v1/business/validate",
            json={"b_no": "1209862762", "p_nm": "홍길동", "start_dt": "20231013"},
        )

    body = response.json()
    assert body["valid_kind"] == "mismatch"
    assert body["valid_label"] == "진위확인 불일치"
    assert body["valid_msg"] == "확인할 수 없습니다."
    assert body.get("status_kind") is None
    assert body.get("status_label") is None


@pytest.mark.asyncio
async def test_validate_rejects_short_start_dt(client):
    response = await client.post(
        "/api/v1/business/validate",
        json={"b_no": "1209862762", "p_nm": "김민지", "start_dt": "2023"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_validate_rejects_empty_p_nm(client):
    response = await client.post(
        "/api/v1/business/validate",
        json={"b_no": "1209862762", "p_nm": "", "start_dt": "20231013"},
    )
    # Pydantic min_length=1 reject (422)
    assert response.status_code == 422
