import Link from 'next/link'
import type { SessionCellInfo } from '@/lib/teacher-calendar'
import { kstParts, ymdKST } from '@/lib/date'

type Props = {
  ym: string  // 'YYYY-MM'
  cells: SessionCellInfo[]
  selectedDay: string | null
}

const DAY_COLOR: Record<SessionCellInfo['status'], string> = {
  completed: 'bg-green-100 text-green-800',
  in_progress: 'bg-amber-100 text-amber-800',
  empty: 'bg-red-100 text-red-800',
  upcoming: 'bg-indigo-50 text-indigo-800 border border-indigo-300 border-dashed',
}

const ICON: Record<SessionCellInfo['status'], string> = {
  completed: '',
  in_progress: '⚠',
  empty: '❗',
  upcoming: '',
}

export function CalendarMonth({ ym, cells, selectedDay }: Props) {
  const [y, m] = ym.split('-').map(Number)
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const todayYmd = ymdKST(new Date())

  // 날짜별로 cells 묶음 (KST 기준)
  const byDay = new Map<number, SessionCellInfo[]>()
  for (const c of cells) {
    const p = kstParts(new Date(c.session.scheduled_at))
    if (p.year !== y || p.month !== m) continue
    const arr = byDay.get(p.day) ?? []
    arr.push(c)
    byDay.set(p.day, arr)
  }

  const cellsArr: ({ day: number } | null)[] = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d += 1) cellsArr.push({ day: d })

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="text-center text-slate-400 py-1">
            {d}
          </div>
        ))}
        {cellsArr.map((c, i) => {
          if (!c) return <div key={i} />
          const dayYmd = `${ym}-${String(c.day).padStart(2, '0')}`
          const dayCells = byDay.get(c.day) ?? []
          const isToday = dayYmd === todayYmd
          const isSelected = dayYmd === selectedDay

          if (dayCells.length === 0) {
            return (
              <div
                key={i}
                className={`text-center py-2 text-slate-300 rounded ${isToday ? 'ring-2 ring-indigo-300' : ''}`}
              >
                {c.day}
              </div>
            )
          }
          // 회차 있는 날: 가장 우선순위 높은 상태로 표시 (empty > in_progress > upcoming > completed)
          const priorityStatus =
            dayCells.find((dc) => dc.status === 'empty')?.status
            ?? dayCells.find((dc) => dc.status === 'in_progress')?.status
            ?? dayCells.find((dc) => dc.status === 'upcoming')?.status
            ?? 'completed'
          const hasAnyVideo = dayCells.some((dc) => dc.hasVideo)

          return (
            <Link
              key={i}
              href={`/teacher?view=month&ym=${ym}&day=${dayYmd}`}
              className={`text-center py-2 rounded font-semibold transition hover:opacity-80 ${DAY_COLOR[priorityStatus]} ${isToday ? 'ring-2 ring-indigo-500' : ''} ${isSelected ? 'outline outline-2 outline-indigo-600' : ''}`}
            >
              {c.day}
              {ICON[priorityStatus] && <span className="ml-0.5">{ICON[priorityStatus]}</span>}
              {hasAnyVideo && <span className="ml-0.5">🎬</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
