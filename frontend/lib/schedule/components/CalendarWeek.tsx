import Link from 'next/link'
import type { SessionCellInfo } from '@/lib/teacher-calendar'
import { kstParts, ymdKST } from '@/lib/date'
import { SESSION_TYPE_META } from '@/lib/sessions/types'
import { EVENT_TYPE_META, type ScheduleEventWithClass } from '@/lib/events/types'

type Props = {
  cells: SessionCellInfo[]
  selectedDay: string | null
  basePath: string
  events?: ScheduleEventWithClass[]
}

const ROW_STYLE: Record<SessionCellInfo['status'], string> = {
  completed: 'bg-green-50 border-green-200',
  in_progress: 'bg-amber-50 border-amber-200',
  empty: 'bg-red-50 border-red-200',
  upcoming: 'bg-indigo-50 border-indigo-200 border-dashed',
}

const STATUS_LABEL: Record<SessionCellInfo['status'], string> = {
  completed: '✓ 완료',
  in_progress: '⚠ 진행중',
  empty: '❗ 미입력',
  upcoming: '📅 예정',
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarWeek({ cells, selectedDay, basePath, events = [] }: Props) {
  if (cells.length === 0) {
    return (
      <p className="text-center text-sm text-slate-400 py-8">
        이번 주 수업이 없어요.
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {cells.map(({ session, status, hasVideo }) => {
        const d = new Date(session.scheduled_at)
        const day = ymdKST(d)
        const p = kstParts(d)
        const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
        const time = d.toLocaleTimeString('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit',
        })
        const ring = selectedDay === day ? 'ring-2 ring-indigo-500' : ''
        const cancelled = session.cancelled
        const typeMeta = SESSION_TYPE_META[session.type]
        const dayEvents = events.filter((e) => e.event_date === day)
        return (
          <li key={session.id}>
            <Link
              href={`${basePath}?view=week&day=${day}`}
              className={`block rounded-lg border p-3 hover:border-slate-400 transition ${cancelled ? 'bg-gray-50 border-gray-200 opacity-70' : ROW_STYLE[status]} ${ring}`}
            >
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-600 w-16 shrink-0">
                  {WEEKDAY_KO[dow]} {p.month}/{p.day}
                </div>
                <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${typeMeta.dot}`} title={typeMeta.label} />
                <div className={`flex-1 text-sm font-medium ${cancelled ? 'line-through text-slate-400' : ''}`}>
                  {time} · {session.class_name} — {session.title}
                </div>
                {dayEvents.map((e) => (
                  <span
                    key={e.id}
                    className={`inline-block w-2 h-2 rounded-full ${EVENT_TYPE_META[e.type].dot}`}
                    title={`${EVENT_TYPE_META[e.type].label} · ${e.title}`}
                  />
                ))}
                {hasVideo && <span className="text-sm">🎬</span>}
                <span className="text-xs text-slate-700 font-semibold">
                  {cancelled ? '휴강' : STATUS_LABEL[status]}
                </span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
