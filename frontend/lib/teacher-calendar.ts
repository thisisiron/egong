/**
 * 선생님 캘린더 헬퍼.
 *
 * - 회차 입력 상태 계산
 * - 월/주/연 range 계산
 * - 셀 prop 변환 (DB 행 → UI에 필요한 최소 prop)
 *
 * 모두 순수 함수. DB·React 의존 없음.
 * 날짜 계산은 전부 KST(UTC+9) 고정 — 서버 타임존(UTC 등)과 무관하게 동작.
 */

import { kstParts } from '@/lib/date'
import type { SessionType } from '@/lib/sessions/types'

export type SessionStatus = 'completed' | 'in_progress' | 'empty' | 'upcoming'

export type CalendarView = 'week' | 'month' | 'year'

export type SessionSummary = {
  id: string
  scheduled_at: string  // ISO
  title: string
  class_id: string
  class_name: string
  video_url: string | null
  filled_count: number  // attendance row 수
  class_size: number    // 그 반의 활성 학생 수
  type: SessionType
  cancelled: boolean
}

export type SessionCellInfo = {
  session: SessionSummary
  status: SessionStatus
  hasVideo: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** KST 벽시계 (y, m, d) 00:00 → UTC ISO 인스턴트. m·d 오버플로우는 Date.UTC가 정규화. */
function kstMidnightIso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d) - KST_OFFSET_MS).toISOString()
}

/**
 * 회차 입력 상태 결정.
 * - 미래 회차 (scheduled_at > now) → upcoming
 * - filled_count === 0 → empty
 * - filled_count < class_size → in_progress
 * - filled_count === class_size → completed
 *
 * class_size 가 0인 (배정된 학생 없는) 회차는 completed로 처리 — 더 입력할 게 없음.
 */
export function computeSessionStatus(
  s: SessionSummary,
  now: Date = new Date(),
): SessionStatus {
  const scheduled = new Date(s.scheduled_at)
  if (scheduled.getTime() > now.getTime()) return 'upcoming'
  if (s.class_size === 0) return 'completed'
  if (s.filled_count === 0) return 'empty'
  if (s.filled_count < s.class_size) return 'in_progress'
  return 'completed'
}

export function toCellInfo(s: SessionSummary, now: Date = new Date()): SessionCellInfo {
  return {
    session: s,
    status: computeSessionStatus(s, now),
    hasVideo: Boolean(s.video_url),
  }
}

/** "YYYY-MM" → 그 달의 KST [1일 0시, 다음 달 1일 0시) range (UTC ISO strings) */
export function monthRange(ym: string): { from: string; to: string; label: string } {
  const [y, m] = ym.split('-').map(Number)
  return {
    from: kstMidnightIso(y, m, 1),
    to: kstMidnightIso(y, m + 1, 1),
    label: `${y}년 ${m}월`,
  }
}

/** 어떤 인스턴트가 속한 KST 주의 [월요일 0시, 다음 월요일 0시) range (UTC ISO strings) */
export function weekRange(date: Date): { from: string; to: string; label: string } {
  const { year, month, day } = kstParts(date)
  // KST 벽시계 날짜를 UTC 자정으로 표현해 요일·주 시작 계산 (타임존 무관)
  const wallMidnight = Date.UTC(year, month - 1, day)
  const dow = new Date(wallMidnight).getUTCDay()  // 0=Sun..6=Sat
  const daysFromMonday = (dow + 6) % 7
  const monday = new Date(wallMidnight - daysFromMonday * DAY_MS)
  const sunday = new Date(monday.getTime() + 6 * DAY_MS)
  return {
    from: new Date(monday.getTime() - KST_OFFSET_MS).toISOString(),
    to: new Date(monday.getTime() + 7 * DAY_MS - KST_OFFSET_MS).toISOString(),
    label: `${monday.getUTCMonth() + 1}/${monday.getUTCDate()} ~ ${sunday.getUTCMonth() + 1}/${sunday.getUTCDate()}`,
  }
}

/** 한 해 KST [1/1 0시, 다음 해 1/1 0시) range (UTC ISO strings) */
export function yearRange(year: number): { from: string; to: string; label: string } {
  return {
    from: kstMidnightIso(year, 1, 1),
    to: kstMidnightIso(year + 1, 1, 1),
    label: `${year}년`,
  }
}

/** 현재 URL searchParams 에서 view + 날짜 정보 파싱. 누락은 기본값으로. */
export function parseCalendarParams(sp: {
  view?: string
  ym?: string
  y?: string
  day?: string
}): {
  view: CalendarView
  ym: string         // 항상 채워짐 (default = 오늘 달)
  year: number       // 항상 채워짐
  day: string | null // 선택된 날 (popup)
} {
  const view: CalendarView =
    sp.view === 'month' || sp.view === 'year' || sp.view === 'week' ? sp.view : 'week'
  const today = kstParts(new Date())
  const ym =
    sp.ym && /^\d{4}-\d{2}$/.test(sp.ym)
      ? sp.ym
      : `${today.year}-${String(today.month).padStart(2, '0')}`
  const year = sp.y && /^\d{4}$/.test(sp.y) ? Number(sp.y) : today.year
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null
  return { view, ym, year, day }
}

/** 현재 뷰 기준 적절한 range 반환. week 뷰는 day param 이 있으면 그 주, 없으면 오늘 주. */
export function rangeForView(
  view: CalendarView,
  ym: string,
  year: number,
  day: string | null = null,
): { from: string; to: string; label: string } {
  if (view === 'month') return monthRange(ym)
  if (view === 'year') return yearRange(year)
  // week — day 가 있으면 그 날(KST) 기준, 없으면 오늘
  const base =
    day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00+09:00`) : new Date()
  return weekRange(base)
}

/** 다음/이전 month/year/week 계산 (URL state 이동용) */
export function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
