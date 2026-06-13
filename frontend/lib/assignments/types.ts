/** 과제 도메인 타입. 순수 타입 — 클라이언트에서도 import 가능. */
import type { NotifyRole } from '@/lib/notifications/types'

export type Assignment = {
  id: string
  academy_id: string
  class_id: string
  title: string
  description: string | null
  due_at: string | null
  created_by: string | null
  author_name: string
  created_at: string
}

export type AssignmentWithClass = Assignment & { class_name: string | null }

export type AssignmentSubmission = {
  id: string
  assignment_id: string
  student_id: string
  academy_id: string
  class_id: string
  memo: string | null
  file_paths: string[]
  submitted_at: string
  score: string | null
  feedback: string | null
  feedback_by: string | null
  feedback_by_name: string | null
  feedback_at: string | null
}

export type SubmissionStatus = 'not_submitted' | 'submitted' | 'feedback'

export function submissionStatus(sub: Pick<AssignmentSubmission, 'feedback_at'> | null): SubmissionStatus {
  if (!sub) return 'not_submitted'
  return sub.feedback_at ? 'feedback' : 'submitted'
}

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  not_submitted: '미제출',
  submitted: '제출됨',
  feedback: '피드백 완료',
}

/** 과제 알림 대상은 학생·학부모만 (NotifyRole 재사용). */
export const ASSIGNMENT_NOTIFY_ROLES: { value: Extract<NotifyRole, 'student' | 'parent'>; label: string }[] = [
  { value: 'student', label: '학생' },
  { value: 'parent', label: '학부모' },
]
