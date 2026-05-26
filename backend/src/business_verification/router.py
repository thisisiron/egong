"""HTTP routes for business verification.

POST /business/status: 공개 — 누구나 호출 가능. NTS API 프록시.
"""

from fastapi import APIRouter

from . import service
from .schemas import (
    BusinessStatusRequest,
    BusinessStatusResponse,
    BusinessValidateRequest,
    BusinessValidateResponse,
)

router = APIRouter(prefix="/business", tags=["business-verification"])


@router.post("/status", response_model=BusinessStatusResponse)
async def check_business_status(
    payload: BusinessStatusRequest,
) -> BusinessStatusResponse:
    """공개 endpoint — 신청 폼에서 사업자번호 검증용. 인증 불필요."""
    return await service.check_status(payload.b_no)


@router.post("/validate", response_model=BusinessValidateResponse)
async def validate_business(
    payload: BusinessValidateRequest,
) -> BusinessValidateResponse:
    """공개 endpoint — NTS 진위확인 (b_no + p_nm + start_dt 3개 일치 검증)."""
    return await service.validate(payload.b_no, payload.p_nm, payload.start_dt)
