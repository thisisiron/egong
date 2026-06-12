import type { TodaySessionSummary } from './types'

/** 오늘 출석률 — 명단 대비 (출석+지각). 수업 없으면 pct null.
 * 순수 함수 — getTodaySessionsSummary() 결과를 받아 집계만 한다.
 */
export function todayAttendanceRate(items: TodaySessionSummary[] | null): {
  pct: number | null
  detail: string
} {
  if (!items) return { pct: null, detail: '불러오지 못했습니다' }
  if (items.length === 0) return { pct: null, detail: '오늘 수업 없음' }
  const roster = items.reduce((n, s) => n + s.roster_count, 0)
  if (roster === 0) return { pct: null, detail: '명단 없음' }
  const attended = items.reduce((n, s) => n + s.present + s.late, 0)
  return {
    pct: Math.round((attended / roster) * 100),
    detail: `출석 ${attended} / 명단 ${roster}`,
  }
}
