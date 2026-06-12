import { ymd } from '@/lib/date'
import type { AttendanceStatus } from './types'

export type DayCell = {
  day: number
  status: AttendanceStatus | null
  isToday: boolean
}

/** 월 캘린더 셀 구성. 같은 날 기록이 여러 개면 마지막 기록이 남음 (기존 /me 동작 유지). */
export function buildMonthDays(
  year: number,
  month: number, // 1-12
  attRows: Array<{ status: AttendanceStatus; scheduled_at: string }>,
  now = new Date()
): DayCell[] {
  const statusByDay: Record<number, AttendanceStatus> = {}
  for (const row of attRows) {
    const d = new Date(row.scheduled_at)
    if (d.getFullYear() === year && d.getMonth() === month - 1) {
      statusByDay[d.getDate()] = row.status
    }
  }
  const todayYmd = ymd(now)
  const daysInMonth = new Date(year, month, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    status: statusByDay[i + 1] ?? null,
    isToday: ymd(new Date(year, month - 1, i + 1)) === todayYmd,
  }))
}
