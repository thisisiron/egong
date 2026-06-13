/** 공지사항 도메인 frontend 타입. 순수 타입 — 클라이언트 컴포넌트에서도 import 가능. */

export type Announcement = {
  id: string
  academy_id: string
  class_id: string | null // null = 학원 전체
  type: string
  title: string
  body: string
  created_by: string | null
  author_name: string
  created_at: string
  updated_at: string
}

/** 목록 표시용 — 반 이름 조인 결과 (null = 학원 전체). */
export type AnnouncementWithClass = Announcement & {
  class_name: string | null
}

/** 작성 폼의 반 선택 옵션. */
export type ScopeOption = { id: string; name: string }
