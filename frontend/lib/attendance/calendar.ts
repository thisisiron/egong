import { kstParts } from '@/lib/date'
import type { AttendanceStatus } from './types'

export type DayCell = {
  day: number
  status: AttendanceStatus | null
  isToday: boolean
}

/** 월 캘린더 셀 구성. 날짜 버킷팅·오늘 판정은 KST 고정 (서버 타임존 무관).
 * 같은 날 기록이 여러 개면 마지막 기록이 남음 (기존 /me 동작 유지).
 */
export function buildMonthDays(
  year: number,
  month: number, // 1-12
  attRows: Array<{ status: AttendanceStatus; scheduled_at: string }>,
  now = new Date()
): DayCell[] {
  const statusByDay: Record<number, AttendanceStatus> = {}
  for (const row of attRows) {
    const p = kstParts(new Date(row.scheduled_at))
    if (p.year === year && p.month === month) {
      statusByDay[p.day] = row.status
    }
  }
  const today = kstParts(now)
  const isCurrentMonth = today.year === year && today.month === month
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    status: statusByDay[i + 1] ?? null,
    isToday: isCurrentMonth && today.day === i + 1,
  }))
}
