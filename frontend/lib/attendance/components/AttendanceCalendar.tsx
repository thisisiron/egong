import type { DayCell } from '../calendar'

const COLORS: Record<NonNullable<DayCell['status']>, string> = {
  present: 'bg-green-100 text-green-800',
  late: 'bg-amber-100 text-amber-800',
  absent: 'bg-red-100 text-red-700',
  // 레거시 excused는 결석과 동일하게 표시 (사전연락 구분 제거).
  excused: 'bg-red-100 text-red-700',
}

export function AttendanceCalendar({
  year,
  month,
  days,
}: {
  year: number
  month: number
  days: DayCell[]
}) {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const cells: (DayCell | null)[] = Array(firstDow).fill(null).concat(days)

  return (
    <div>
      <div className="text-sm font-semibold mb-2">
        📅 {year}년 {month}월 출결
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="text-center text-slate-400 py-1">
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={i} />
          const cls = c.status ? COLORS[c.status] : 'text-slate-300'
          const today = c.isToday ? 'ring-2 ring-amber-500' : ''
          return (
            <div
              key={i}
              className={`text-center py-2 rounded font-medium ${cls} ${today}`}
            >
              {c.day}
            </div>
          )
        })}
      </div>
      <div className="flex gap-3 mt-2 text-xs text-slate-600">
        <Legend color="bg-green-100" label="출석" />
        <Legend color="bg-amber-100" label="지각" />
        <Legend color="bg-red-100" label="결석" />
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block w-3 h-3 ${color} border`} />
      {label}
    </span>
  )
}
