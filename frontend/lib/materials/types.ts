/** 자료 도메인 타입. 순수 타입 — 클라이언트 컴포넌트에서도 import 가능. */
import type { NotifyRole } from '@/lib/notifications/types'

/** 업로드된 파일 1개 — 원본 파일명 보존 (files jsonb 요소). */
export type MaterialFile = { path: string; name: string }

/** 다운로드용 signed URL이 붙은 파일. */
export type SignedMaterialFile = MaterialFile & { url: string | null }

export type Material = {
  id: string
  academy_id: string
  class_id: string | null // null = 학원 전체
  title: string
  description: string | null
  files: MaterialFile[]
  created_by: string | null
  author_name: string
  created_at: string
}

/** 목록 표시용 — 반 이름 조인 결과 (null = 학원 전체). */
export type MaterialWithClass = Material & { class_name: string | null }

/** 작성 폼의 반 선택 옵션. */
export type ScopeOption = { id: string; name: string }

/** 자료 알림 대상 — 공지와 동일하게 4역할. */
export type MaterialNotifyRole = NotifyRole
