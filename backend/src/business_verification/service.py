"""국세청 사업자등록 status 조회 서비스.

httpx로 NTS API (api.odcloud.kr) 호출. API 키는 settings에서 읽음.
응답을 우리 도메인 모델로 변환 (BUSINESS_STATUS_CODES 매핑).
"""

import logging

import httpx
from fastapi import HTTPException, status

from src.core.config import get_settings

from .constants import (
    BUSINESS_NUMBER_DIGITS,
    BUSINESS_STATUS_CODES,
    NTS_STATUS_API_URL,
    NTS_VALIDATE_API_URL,
    TAX_TYPE_LABELS,
    VALID_CODES,
)
from .schemas import BusinessStatusResponse, BusinessValidateResponse

logger = logging.getLogger(__name__)


def _normalize_b_no(raw: str) -> str:
    """Strip non-digits. Returns the 10-digit string or raises 422."""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) != BUSINESS_NUMBER_DIGITS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"사업자번호는 {BUSINESS_NUMBER_DIGITS}자리 숫자여야 합니다",
        )
    return digits


async def check_status(raw_b_no: str) -> BusinessStatusResponse:
    """Call NTS status endpoint and translate the response."""
    b_no = _normalize_b_no(raw_b_no)
    settings = get_settings()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                NTS_STATUS_API_URL,
                params={"serviceKey": settings.nts_api_key},
                json={"b_no": [b_no]},
                headers={"Content-Type": "application/json"},
            )
    except httpx.HTTPError:
        logger.exception("NTS status API call failed for b_no=%s", b_no)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "국세청 API 호출에 실패했습니다. 잠시 후 다시 시도해주세요.",
        ) from None

    if resp.status_code != 200:
        logger.error("NTS API non-200: %s %s", resp.status_code, resp.text[:300])
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "국세청 API 응답이 비정상입니다.",
        )

    return _parse_response(resp.json(), b_no)


def _parse_response(body: dict, b_no: str) -> BusinessStatusResponse:
    """NTS 응답 JSON 변환.

    Sample success:
      {
        "match_cnt": 1,
        "request_cnt": 1,
        "status_code": "OK",
        "data": [{
          "b_no": "1234567890",
          "b_stt": "계속사업자",
          "b_stt_cd": "01",
          "tax_type": "부가가치세 일반과세자",
          "tax_type_cd": "01",
          "end_dt": "",
          ...
        }]
      }
    """
    data_list = body.get("data") or []
    if not data_list:
        return BusinessStatusResponse(
            found=False,
            status_kind="unknown",
            status_label="조회 결과 없음",
            raw_b_no=b_no,
        )

    row = data_list[0]
    code = (row.get("b_stt_cd") or "").strip()
    mapped = BUSINESS_STATUS_CODES.get(code)

    if not mapped:
        # 코드 미매핑 — 알 수 없음으로 안전 fallback
        return BusinessStatusResponse(
            found=True,
            status_kind="unknown",
            status_label=row.get("b_stt") or "확인 불가",
            tax_type_label=row.get("tax_type"),
            end_date=_norm_end_date(row.get("end_dt")),
            raw_b_no=b_no,
        )

    kind, label = mapped
    tax_type_cd = (row.get("tax_type_cd") or "").strip()
    return BusinessStatusResponse(
        found=True,
        status_kind=kind,
        status_label=label,
        tax_type_label=TAX_TYPE_LABELS.get(tax_type_cd) or row.get("tax_type"),
        end_date=_norm_end_date(row.get("end_dt")),
        raw_b_no=b_no,
    )


def _norm_end_date(raw: str | None) -> str | None:
    """NTS returns end_dt as 'YYYYMMDD' or empty. Convert to 'YYYY-MM-DD' or None."""
    if not raw:
        return None
    s = raw.strip()
    if len(s) != 8 or not s.isdigit():
        return None
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"


def _normalize_start_dt(raw: str) -> str:
    """YYYY-MM-DD → YYYYMMDD. 이미 8자리면 그대로. 형식 불일치는 422."""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) != 8:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "개업일자는 YYYYMMDD 형식의 8자리 숫자여야 합니다",
        )
    return digits


async def validate(
    raw_b_no: str, p_nm: str, start_dt: str
) -> BusinessValidateResponse:
    """Call NTS validate endpoint and translate the response."""
    b_no = _normalize_b_no(raw_b_no)
    start = _normalize_start_dt(start_dt)
    name = p_nm.strip()
    if not name:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "대표자성명을 입력해주세요"
        )

    settings = get_settings()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                NTS_VALIDATE_API_URL,
                params={"serviceKey": settings.nts_api_key},
                json={
                    "businesses": [
                        {
                            "b_no": b_no,
                            "p_nm": name,
                            "start_dt": start,
                            # NTS는 사용하지 않는 항목도 ""로 보내야 안정적 매칭
                            "p_nm2": "",
                            "b_nm": "",
                            "corp_no": "",
                            "b_sector": "",
                            "b_type": "",
                            "b_adr": "",
                        }
                    ]
                },
                headers={"Content-Type": "application/json"},
            )
    except httpx.HTTPError:
        logger.exception("NTS validate API call failed for b_no=%s", b_no)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "국세청 API 호출에 실패했습니다. 잠시 후 다시 시도해주세요.",
        ) from None

    if resp.status_code != 200:
        logger.error(
            "NTS validate non-200: %s %s", resp.status_code, resp.text[:300]
        )
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "국세청 API 응답이 비정상입니다."
        )

    return _parse_validate_response(resp.json(), b_no)


def _parse_validate_response(body: dict, b_no: str) -> BusinessValidateResponse:
    """NTS validate 응답 변환.

    Sample (일치):
      { "data": [{ "b_no": "...", "valid": "01",
                   "status": { "b_stt_cd": "01", "b_stt": "계속사업자", ... } }] }
    Sample (불일치):
      { "data": [{ "b_no": "...", "valid": "02",
                   "valid_msg": "확인할 수 없습니다." }] }
    """
    data_list = body.get("data") or []
    if not data_list:
        return BusinessValidateResponse(
            valid_kind="unknown",
            valid_label="조회 결과 없음",
            raw_b_no=b_no,
        )

    row = data_list[0]
    code = (row.get("valid") or "").strip()
    mapped = VALID_CODES.get(code)
    valid_msg = row.get("valid_msg")

    if not mapped:
        return BusinessValidateResponse(
            valid_kind="unknown",
            valid_label="확인 불가",
            valid_msg=valid_msg,
            raw_b_no=b_no,
        )

    kind, label = mapped
    out = BusinessValidateResponse(
        valid_kind=kind,
        valid_label=label,
        valid_msg=valid_msg,
        raw_b_no=b_no,
    )

    # 일치(match)일 때만 NTS가 status 동봉 — 우리도 같이 채움
    if kind == "match":
        status_block = row.get("status") or {}
        status_code = (status_block.get("b_stt_cd") or "").strip()
        status_mapped = BUSINESS_STATUS_CODES.get(status_code)
        if status_mapped:
            s_kind, s_label = status_mapped
            out.status_kind = s_kind
            out.status_label = s_label
        else:
            out.status_kind = "unknown"
            out.status_label = status_block.get("b_stt") or "확인 불가"

        tax_cd = (status_block.get("tax_type_cd") or "").strip()
        out.tax_type_label = TAX_TYPE_LABELS.get(tax_cd) or status_block.get("tax_type")
        out.end_date = _norm_end_date(status_block.get("end_dt"))

    return out
