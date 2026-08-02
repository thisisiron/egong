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
