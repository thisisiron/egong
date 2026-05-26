"""국세청 사업자등록정보 API constants.

응답의 b_stt_cd 코드 → 한국어 라벨 매핑.
NTS API ref: api.odcloud.kr/api/nts-businessman/v1/status
"""

NTS_STATUS_API_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status"

# b_stt_cd → ("status_kind", "label")
# 01 = 계속사업자, 02 = 휴업자, 03 = 폐업자
BUSINESS_STATUS_CODES: dict[str, tuple[str, str]] = {
    "01": ("active", "계속사업자"),
    "02": ("paused", "휴업자"),
    "03": ("closed", "폐업자"),
}

# tax_type_cd → label (간단 매핑, 자주 쓰는 것만)
TAX_TYPE_LABELS: dict[str, str] = {
    "01": "부가가치세 일반과세자",
    "02": "부가가치세 간이과세자",
    "03": "부가가치세 과세특례자",
    "04": "부가가치세 면세사업자",
    "05": "수익사업을 영위하지 않는 비영리법인이거나 고유번호가 부여된 단체·국가기관 등",
    "06": "고유번호가 부여된 단체",
    "07": "부가가치세 간이과세자(직전 4800만원 이상)",
}

# 사업자번호 형식 검증 — 10자리 숫자
BUSINESS_NUMBER_DIGITS = 10
