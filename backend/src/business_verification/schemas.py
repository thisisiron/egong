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


ValidKind = Literal["match", "mismatch", "unknown"]


class BusinessValidateRequest(BaseModel):
    """Frontend → backend. 진위확인 요청.

    NTS 필수 3개 항목: b_no(10자리), p_nm(대표자성명), start_dt(YYYYMMDD).
    하이픈은 frontend가 제거하지만 backend도 안전을 위해 재정규화함.
    """

    b_no: str = Field(min_length=10, max_length=12, description="10자리 숫자, 하이픈 허용")
    p_nm: str = Field(min_length=1, max_length=50, description="대표자성명")
    start_dt: str = Field(min_length=8, max_length=10, description="개업일자 YYYYMMDD 또는 YYYY-MM-DD")


class BusinessValidateResponse(BaseModel):
    """Backend → frontend. 진위확인 결과 + (일치 시) status 정보.

    NTS validate 응답은 진위확인 결과(valid)와 status 정보를 함께 반환하므로
    하나의 응답 모델에 통합. valid_kind에 따라 status_* 필드의 유무가 달라짐.
    """

    valid_kind: ValidKind                  # match / mismatch / unknown
    valid_label: str                       # "진위확인 일치" 등
    valid_msg: str | None = None           # NTS 원본 메시지 (불일치 시 "확인할 수 없습니다." 등)

    # 일치(match) 시에만 채움 — status 정보 동봉
    status_kind: StatusKind | None = None
    status_label: str | None = None
    tax_type_label: str | None = None
    end_date: str | None = None

    raw_b_no: str                          # 정규화된 사업자번호
