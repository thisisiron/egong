"""Pydantic schemas for business verification (NTS 사업자등록 status 조회)."""

from typing import Literal

from pydantic import BaseModel, Field

# 우리 frontend ↔ backend 계약 (NTS 외부 API와 별개)

StatusKind = Literal["active", "paused", "closed", "unknown"]


class BusinessStatusRequest(BaseModel):
    """Frontend → backend. 사업자번호 1건."""

    b_no: str = Field(min_length=10, max_length=12, description="10자리 숫자, 하이픈 허용")


class BusinessStatusResponse(BaseModel):
    """Backend → frontend. status 조회 결과."""

    found: bool                            # NTS에 해당 사업자번호가 등록되어 있는지
    status_kind: StatusKind                # active / paused / closed / unknown
    status_label: str                      # "계속사업자" 등 (사용자 표시)
    tax_type_label: str | None = None      # "부가가치세 일반과세자" 등
    end_date: str | None = None            # 폐업일자 (YYYY-MM-DD, 폐업자만)
    raw_b_no: str                          # 정규화된 사업자번호 (하이픈 제거된)
