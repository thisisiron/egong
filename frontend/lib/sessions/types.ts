/** 세션 도메인의 frontend 타입.
 *
 * DB sessions 테이블의 컬럼들 + UI에서 사용하는 derived view.
 * 'server-only' 표시 없음 — 클라이언트 컴포넌트에서도 import 가능한 순수 타입.
 */

export type Session = {
  id: string
  class_id: string
  scheduled_at: string  // ISO timestamp
  title: string
  unit: string | null
  video_url: string | null
  video_notes: string | null
}

/** 세션 + 학원 컨텍스트 (목록 표시용). */
export type SessionWithClass = Session & {
  class_name: string
}

/** 세션 + attendance 카운트 (삭제 confirm 용). */
export type SessionWithAttendanceCount = Session & {
  attendance_count: number
}

/** 선생님이 가르치는 반 옵션 (드롭다운). */
export type TeachingClassOption = {
  id: string
  name: string
}

// Note: SessionCreateInput/SessionUpdateInput/SessionDeleteInput 타입은
// schemas.ts 에서 zod 추론으로 export. 한 곳에서만 정의 (single source of truth).
