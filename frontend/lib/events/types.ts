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

/** 이벤트 타입 라벨·색. */
export const EVENT_TYPE_META: Record<EventType, { label: string; dot: string; badge: string }> = {
  exam: { label: '시험', dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700' },
  consultation: { label: '상담', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
}
