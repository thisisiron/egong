import Link from 'next/link'
import type { SessionCellInfo } from '@/lib/teacher-calendar'
import { kstParts, ymdKST } from '@/lib/date'
import { EVENT_TYPE_META, type ScheduleEventWithClass } from '@/lib/events/types'

type Props = {
  ym: string  // 'YYYY-MM'
  cells: SessionCellInfo[]
  selectedDay: string | null
  basePath: string
  events?: ScheduleEventWithClass[]
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

export function CalendarMonth({ ym, cells, selectedDay, basePath, events = [] }: Props) {
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

  // 날짜별 이벤트 묶음 (event_date 'YYYY-MM-DD' 의 day 부분)
  const eventsByDay = new Map<number, ScheduleEventWithClass[]>()
  for (const e of events) {
    if (!e.event_date.startsWith(`${ym}-`)) continue
    const d = Number(e.event_date.slice(8, 10))
    const arr = eventsByDay.get(d) ?? []
    arr.push(e)
    eventsByDay.set(d, arr)
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
          const dayEvents = eventsByDay.get(c.day) ?? []
          const isToday = dayYmd === todayYmd
          const isSelected = dayYmd === selectedDay

          // event dots (최대 3개 표시)
          const eventDots = dayEvents.length > 0 && (
            <span className="mt-0.5 flex justify-center gap-0.5">
              {dayEvents.slice(0, 3).map((e) => (
                <span key={e.id} className={`inline-block w-1.5 h-1.5 rounded-full ${EVENT_TYPE_META[e.type].dot}`} />
              ))}
            </span>
          )

          if (dayCells.length === 0) {
            if (dayEvents.length === 0) {
              return (
                <div
                  key={i}
                  className={`text-center py-2 text-slate-300 rounded ${isToday ? 'ring-2 ring-indigo-300' : ''}`}
                >
                  {c.day}
                </div>
              )
            }
            // 회차는 없지만 이벤트만 있는 날 → 링크 + 이벤트 점
            return (
              <Link
                key={i}
                href={`${basePath}?view=month&ym=${ym}&day=${dayYmd}`}
                className={`text-center py-2 rounded text-slate-500 transition hover:bg-gray-50 ${isToday ? 'ring-2 ring-indigo-500' : ''} ${isSelected ? 'outline outline-2 outline-indigo-600' : ''}`}
              >
                {c.day}
                {eventDots}
              </Link>
            )
          }
          // 회차 있는 날: 가장 우선순위 높은 상태로 표시 (empty > in_progress > upcoming > completed)
          // 휴강 제외한 회차들로 상태 우선순위 계산. 전부 휴강이면 회색.
          const activeCells = dayCells.filter((dc) => !dc.session.cancelled)
          const allCancelled = activeCells.length === 0
          const priorityStatus =
            activeCells.find((dc) => dc.status === 'empty')?.status
            ?? activeCells.find((dc) => dc.status === 'in_progress')?.status
            ?? activeCells.find((dc) => dc.status === 'upcoming')?.status
            ?? 'completed'
          const hasAnyVideo = dayCells.some((dc) => dc.hasVideo)
          const colorCls = allCancelled
            ? 'bg-gray-100 text-gray-400 line-through'
            : DAY_COLOR[priorityStatus]

          return (
            <Link
              key={i}
              href={`${basePath}?view=month&ym=${ym}&day=${dayYmd}`}
              className={`text-center py-2 rounded font-semibold transition hover:opacity-80 ${colorCls} ${isToday ? 'ring-2 ring-indigo-500' : ''} ${isSelected ? 'outline outline-2 outline-indigo-600' : ''}`}
            >
              {c.day}
              {!allCancelled && ICON[priorityStatus] && <span className="ml-0.5">{ICON[priorityStatus]}</span>}
              {hasAnyVideo && <span className="ml-0.5">🎬</span>}
              {eventDots}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
