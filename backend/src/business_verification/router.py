"""HTTP routes for business verification.

POST /business/status: 공개 — 누구나 호출 가능. NTS API 프록시.
"""

from fastapi import APIRouter

from . import service
from .schemas import BusinessStatusRequest, BusinessStatusResponse

router = APIRouter(prefix="/business", tags=["business-verification"])


@router.post("/status", response_model=BusinessStatusResponse)
async def check_business_status(
    payload: BusinessStatusRequest,
) -> BusinessStatusResponse:
    """공개 endpoint — 신청 폼에서 사업자번호 검증용. 인증 불필요."""
    return await service.check_status(payload.b_no)
