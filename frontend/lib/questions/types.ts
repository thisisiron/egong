/** 수업 질문 도메인 타입. 순수 타입 — 클라이언트에서도 import 가능. */

export type ReplyAuthorRole = 'teacher' | 'owner' | 'student'

export type Question = {
  id: string
  academy_id: string
  class_id: string
  student_id: string
  author_name: string
  title: string
  body: string
  file_paths: string[]
  is_public: boolean
  is_resolved: boolean
  created_at: string
}

export type QuestionWithClass = Question & { class_name: string | null }

export type QuestionReply = {
  id: string
  question_id: string
  academy_id: string
  author_id: string | null
  author_role: ReplyAuthorRole
  author_name: string
  body: string
  file_paths: string[]
  created_at: string
}

export const REPLY_ROLE_LABEL: Record<ReplyAuthorRole, string> = {
  teacher: '선생님',
  owner: '원장',
  student: '학생',
}
