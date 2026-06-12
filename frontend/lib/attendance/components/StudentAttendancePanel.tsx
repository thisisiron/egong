import Link from 'next/link'
import { AttendanceCalendar } from './AttendanceCalendar'
import { AttendanceStats } from './AttendanceStats'
import type { DayCell } from '../calendar'

type Props = {
  year: number
  month: number // 1-12
  rate: number | null
  counts: { present: number; late: number; absent: number }
  days: DayCell[]
}

function ym(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`
}

/** 학생 출결 패널 — 월 네비게이션(?month=)은 쿼리만 바꾸므로 현재 경로 유지. */
export function StudentAttendancePanel({ year, month, rate, counts, days }: Props) {
  const prev = month === 1 ? ym(year - 1, 12) : ym(year, month - 1)
  const next = month === 12 ? ym(year + 1, 1) : ym(year, month + 1)
  const label = `${year}년 ${month}월`

  return (
    <section className="bg-white border border-amber-100 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">출결</h2>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`?month=${prev}`}
            scroll={false}
            className="px-2 py-1 rounded hover:bg-amber-50 text-slate-500"
            aria-label="이전 달"
          >
            ←
          </Link>
          <span className="font-medium">{label}</span>
          <Link
            href={`?month=${next}`}
            scroll={false}
            className="px-2 py-1 rounded hover:bg-amber-50 text-slate-500"
            aria-label="다음 달"
          >
            →
          </Link>
        </div>
      </div>
      <AttendanceStats
        rate={rate}
        present={counts.present}
        late={counts.late}
        absent={counts.absent}
        label={label}
      />
      <AttendanceCalendar year={year} month={month} days={days} />
    </section>
  )
}
