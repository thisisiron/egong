/** 알림 도메인 frontend 타입. 순수 타입 — 클라이언트 컴포넌트에서도 import 가능. */

export type Notification = {
  id: string
  user_id: string
  academy_id: string
  type: string
  title: string
  link: string
  source_id: string | null
  read_at: string | null
  created_at: string
}

/** 공지 작성 시 알림을 받을 역할 그룹. */
export type NotifyRole = 'student' | 'parent' | 'teacher' | 'owner'

/** 폼 체크 칩 노출 순서 + 라벨. */
export const NOTIFY_ROLES: { value: NotifyRole; label: string }[] = [
  { value: 'student', label: '학생' },
  { value: 'parent', label: '학부모' },
  { value: 'teacher', label: '선생' },
  { value: 'owner', label: '원장' },
]
