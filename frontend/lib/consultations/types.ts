export type ConsultationStatus = 'requested' | 'confirmed' | 'rejected' | 'cancelled'
export type ConsultationSlot = 'morning' | 'afternoon' | 'evening'

export const STATUS_LABEL: Record<ConsultationStatus, string> = {
  requested: '대기 중',
  confirmed: '확정',
  rejected: '반려',
  cancelled: '취소됨',
}

export const SLOT_LABEL: Record<ConsultationSlot, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
}

export const SLOT_OPTIONS: { value: ConsultationSlot; label: string }[] = [
  { value: 'morning', label: '오전 (9~12시)' },
  { value: 'afternoon', label: '오후 (12~18시)' },
  { value: 'evening', label: '저녁 (18~21시)' },
]

export type Consultation = {
  id: string
  academy_id: string
  student_id: string
  parent_id: string
  status: ConsultationStatus
  preferred_date: string // 'YYYY-MM-DD'
  preferred_slot: ConsultationSlot
  reason: string
  // 조인이 아니라 스냅샷 컬럼이다 — teacher는 parents를 읽는 정책이 없고
  // students도 담당 반만 읽으므로 조인으로는 학원 전체 목록을 채울 수 없다.
  student_name: string
  parent_name: string
  scheduled_at: string | null
  handler_name: string | null
  response_note: string | null
  responded_at: string | null
  created_at: string
}

/** 아직 살아있는 요청인가 — 취소 버튼 노출 판정. */
export function isOpen(status: ConsultationStatus): boolean {
  return status === 'requested' || status === 'confirmed'
}

/**
 * 서버 액션의 반환 타입 — Next.js는 프로덕션 빌드에서 서버 액션이 던진 예외의
 * message를 클라이언트로 넘기지 않는다(일반 문구 + digest로 치환). 상담 도메인은
 * 학부모가 행동을 바꿔야 하는 한국어 메시지(중복 신청, 지난 시각 등)에 유독 의존하므로
 * throw 대신 이 타입으로 결과를 반환한다.
 */
export type ActionResult = { ok: true } | { ok: false; message: string }
