import { kstParts, monthRange } from '@/lib/date'
import { cn } from '@/lib/utils'

type Props = {
  /** 수업이 있는 일(1~31) — listSessionDaysForMonth() 결과 */
  days: number[]
  now?: Date
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function MonthCalendarCard({ days, now = new Date() }: Props) {
  const { year, month, day: today } = kstParts(now)
  const label = monthRange(now).label
  // KST 달력 연·월 기준이므로 UTC 자정 Date의 getUTC* 사용 (로컬 타임존 무관)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const sessionDays = new Set(days)

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">이번 달 수업</h2>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="mt-3 grid grid-cols-7 text-center text-xs text-slate-400">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center text-sm">
        {cells.map((d, i) => (
          <div key={i} className="flex h-9 flex-col items-center justify-center">
            {d !== null && (
              <>
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full',
                    d === today ? 'bg-indigo-600 font-medium text-white' : 'text-slate-700'
                  )}
                >
                  {d}
                </span>
                <span
                  className={cn(
                    'mt-0.5 h-1 w-1 rounded-full',
                    sessionDays.has(d) ? 'bg-indigo-400' : 'bg-transparent'
                  )}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
