/**
 * Academy applications — domain types.
 *
 * 백엔드 Pydantic schemas와 1:1 매핑. zod schema가 런타임 검증, 이 파일은 컴파일타임 타입.
 */

export type BusinessType = 'individual' | 'corporate' | 'tutoring' | 'planned'

export type StudentCount = 'under_50' | '50_to_200' | 'over_200'

export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

/** 폼에서 사용자가 입력하는 모든 필드 (제출 payload). */
export type ApplicationSubmitInput = {
  applicant_name: string
  applicant_email: string
  applicant_phone: string
  academy_name: string
  academy_region: string | null
  academy_student_count: StudentCount | null
  inquiry_message: string | null
  business_type: BusinessType
  business_name: string
  business_owner_name: string
  business_number: string | null
  registration_file_path: string | null
}

/** Admin이 보는 application 전체. */
export type Application = ApplicationSubmitInput & {
  id: string
  status: ApplicationStatus
  created_at: string
}

/** 사업자 유형 카드에 표시할 메타. */
export const BUSINESS_TYPE_OPTIONS: Array<{
  value: BusinessType
  label: string
  description: string
  icon: string
  requiresFile: boolean
}> = [
  {
    value: 'individual',
    label: '개인사업자',
    description: '사업자등록증 상 "상호"가 표기된 경우',
    icon: '🧑‍💼',
    requiresFile: true,
  },
  {
    value: 'corporate',
    label: '법인사업자',
    description: '사업자등록증 상 "법인명"이 표기된 경우',
    icon: '🏢',
    requiresFile: true,
  },
  {
    value: 'tutoring',
    label: '교습소 / 개인과외',
    description: '교습소 신고증명서 또는 개인과외 신고증명서 (없어도 신청 가능)',
    icon: '📋',
    requiresFile: false,
  },
  {
    value: 'planned',
    label: '개원예정',
    description: '학원설립운영등록 예정. 별도 서류 없이 신청 가능.',
    icon: '📅',
    requiresFile: false,
  },
]

export const STUDENT_COUNT_OPTIONS: Array<{ value: StudentCount; label: string }> = [
  { value: 'under_50', label: '50명 미만' },
  { value: '50_to_200', label: '50명 ~ 200명' },
  { value: 'over_200', label: '200명 이상' },
]

/** Backend POST /business/status 응답 (BusinessVerification 도메인). */
export type BusinessStatus = {
  found: boolean
  status_kind: 'active' | 'paused' | 'closed' | 'unknown'
  status_label: string
  tax_type_label: string | null
  end_date: string | null
  raw_b_no: string
}
