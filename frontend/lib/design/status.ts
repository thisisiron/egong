/**
 * 도메인 상태 → 의미 토큰 매핑. 다섯 도메인이 이 하나를 공유한다.
 * 어느 화면에서든 같은 색이 같은 뜻이 되도록 하는 것이 목적이다 (스펙 §1.2).
 */

import type { AttendanceStatus } from '@/lib/attendance/types'
import type { ApplicationStatus } from '@/lib/applications/types'
import type { ConsultationStatus } from '@/lib/consultations/types'
import type { SubmissionStatus } from '@/lib/assignments/types'

export type Tone = 'success' | 'warning' | 'danger' | 'neutral'

export const ATTENDANCE_TONE: Record<AttendanceStatus, Tone> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  excused: 'neutral', // 인정 결석 — 실패가 아니라 '해당 없음'으로 본다
}

export const SUBMISSION_TONE: Record<SubmissionStatus, Tone> = {
  not_submitted: 'danger',
  submitted: 'warning', // 제출됐지만 아직 피드백 대기
  feedback: 'success',
}

export const CONSULTATION_TONE: Record<ConsultationStatus, Tone> = {
  requested: 'warning',
  confirmed: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

export const APPLICATION_TONE: Record<ApplicationStatus, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}
