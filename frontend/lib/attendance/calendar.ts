import { kstParts } from '@/lib/date'
import type { AttendanceStatus } from './types'
import type { EventType } from '@/lib/events/types'

export type DayCell = {
  day: number
  status: AttendanceStatus | null
  isToday: boolean
  /** 그날 있는 이벤트 종류들 (읽기 전용 마커용). 중복 제거·순서 안정. */
  eventTypes: EventType[]
}

/** 월 캘린더 셀 구성. 날짜 버킷팅·오늘 판정은 KST 고정 (서버 타임존 무관).
 * 같은 날 기록이 여러 개면 마지막 기록이 남음 (기존 /me 동작 유지).
 * events는 event_date('YYYY-MM-DD', KST date)로 받아 점 마커로 얹는다.
 */
export function buildMonthDays(
  year: number,
  month: number, // 1-12
  attRows: Array<{ status: AttendanceStatus; scheduled_at: string }>,
  now = new Date(),
  events: Array<{ type: EventType; event_date: string }> = []
): DayCell[] {
  const statusByDay: Record<number, AttendanceStatus> = {}
  for (const row of attRows) {
    const p = kstParts(new Date(row.scheduled_at))
    if (p.year === year && p.month === month) {
      statusByDay[p.day] = row.status
    }
  }

  // event_date는 이미 'YYYY-MM-DD' KST date — 파싱 대신 문자열 분해(타임존 무관).
  const eventsByDay: Record<number, EventType[]> = {}
  for (const ev of events) {
    const [y, m, d] = ev.event_date.split('-').map(Number)
    if (y === year && m === month) {
      const list = (eventsByDay[d] ??= [])
      if (!list.includes(ev.type)) list.push(ev.type)
    }
  }

  const today = kstParts(now)
  const isCurrentMonth = today.year === year && today.month === month
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    status: statusByDay[i + 1] ?? null,
    isToday: isCurrentMonth && today.day === i + 1,
    eventTypes: eventsByDay[i + 1] ?? [],
  }))
}
