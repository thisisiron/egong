/** 일정 이벤트(시험/상담) 도메인 타입. 'server-only' 없음 — 클라이언트도 import 가능한 순수 타입. */

export type EventType = 'exam' | 'consultation'

export type ScheduleEvent = {
  id: string
  academy_id: string
  class_id: string | null  // NULL = 학원 전체
  type: EventType
  title: string
  event_date: string       // 'YYYY-MM-DD' (KST date)
  memo: string | null
  author_name: string
}

/** 이벤트 + 반 이름 (표시용). class_id NULL이면 class_name도 null. */
export type ScheduleEventWithClass = ScheduleEvent & {
  class_name: string | null
}

/** 이벤트 타입 라벨·점 색. 배지는 무채색이고 색은 달력 점에만 쓴다(분류이지 상태가 아니므로). */
export const EVENT_TYPE_META: Record<EventType, { label: string; dot: string }> = {
  exam: { label: '시험', dot: 'bg-category-exam' },
  consultation: { label: '상담', dot: 'bg-category-consultation' },
}
