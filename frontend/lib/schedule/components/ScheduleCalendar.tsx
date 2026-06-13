import Link from 'next/link'
import type { SessionCellInfo } from '@/lib/teacher-calendar'
import { parseCalendarParams, rangeForView, shiftYm } from '@/lib/teacher-calendar'
import { ymdKST } from '@/lib/date'
import type { ScheduleEventWithClass } from '@/lib/events/types'
import { CalendarWeek } from './CalendarWeek'
import { CalendarMonth } from './CalendarMonth'
import { CalendarYear } from './CalendarYear'
import { SessionPopup } from './SessionPopup'
import { ScheduleLegend } from './ScheduleLegend'

type Props = {
  basePath: string                       // '/teacher' 또는 '/owner/schedule' (캘린더 day-URL 네비용)
  searchParams: { view?: string; ym?: string; y?: string; day?: string }
  cells: SessionCellInfo[]
  events: ScheduleEventWithClass[]
  extraParams?: string                   // 링크에 덧붙일 쿼리 (예: '&class=<id>')
  sessionLinkBase?: string               // 세션 상세 링크 base (예: '/teacher'). 없으면 팝업에 링크 미표시
}

const VIEW_BTN = (active: boolean) =>
  active
    ? 'px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-semibold'
    : 'px-3 py-1.5 rounded bg-white border border-gray-200 text-slate-600 text-sm hover:bg-gray-50 hover:border-gray-300'

export function ScheduleCalendar({ basePath, searchParams, cells, events, extraParams = '', sessionLinkBase }: Props) {
  const { view, ym, year, day } = parseCalendarParams(searchParams)
  const range = rangeForView(view, ym, year, day)
  const popupCells = day ? cells.filter((c) => ymdKST(new Date(c.session.scheduled_at)) === day) : []
  const dayEvents = day ? events.filter((e) => e.event_date === day) : []
  const prevYm = shiftYm(ym, -1)
  const nextYm = shiftYm(ym, +1)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Link href={`${basePath}?view=week${day ? `&day=${day}` : ''}${extraParams}`} className={VIEW_BTN(view === 'week')}>주간</Link>
          <Link href={`${basePath}?view=month&ym=${ym}${day ? `&day=${day}` : ''}${extraParams}`} className={VIEW_BTN(view === 'month')}>월간</Link>
          <Link href={`${basePath}?view=year&y=${year}${extraParams}`} className={VIEW_BTN(view === 'year')}>연간</Link>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {view === 'month' && (
            <>
              <Link href={`${basePath}?view=month&ym=${prevYm}${extraParams}`} className="px-2 py-1 rounded hover:bg-gray-50">‹</Link>
              <span className="font-semibold">{range.label}</span>
              <Link href={`${basePath}?view=month&ym=${nextYm}${extraParams}`} className="px-2 py-1 rounded hover:bg-gray-50">›</Link>
            </>
          )}
          {view === 'year' && (
            <>
              <Link href={`${basePath}?view=year&y=${year - 1}${extraParams}`} className="px-2 py-1 rounded hover:bg-gray-50">‹</Link>
              <span className="font-semibold">{range.label}</span>
              <Link href={`${basePath}?view=year&y=${year + 1}${extraParams}`} className="px-2 py-1 rounded hover:bg-gray-50">›</Link>
            </>
          )}
          {view === 'week' && <span className="font-semibold">{range.label}</span>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {view === 'week' && <CalendarWeek cells={cells} selectedDay={day} basePath={basePath} events={events} />}
        {view === 'month' && <CalendarMonth ym={ym} cells={cells} selectedDay={day} basePath={basePath} events={events} />}
        {view === 'year' && <CalendarYear year={year} cells={cells} basePath={basePath} />}
      </div>

      <ScheduleLegend />

      {day && view !== 'year' && (
        <SessionPopup
          day={day}
          cells={popupCells}
          events={dayEvents}
          basePath={basePath}
          sessionLinkBase={sessionLinkBase}
        />
      )}
    </div>
  )
}
