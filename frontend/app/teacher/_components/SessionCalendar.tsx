import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  parseCalendarParams,
  rangeForView,
  toCellInfo,
  shiftYm,
  type SessionSummary,
} from '@/lib/teacher-calendar'
import { CalendarWeek } from './CalendarWeek'
import { CalendarMonth } from './CalendarMonth'
import { CalendarYear } from './CalendarYear'
import { SessionPopup } from './SessionPopup'

type Props = {
  searchParams: {
    view?: string
    ym?: string
    y?: string
    day?: string
  }
}

const VIEW_BTN = (active: boolean) =>
  active
    ? 'px-3 py-1.5 rounded bg-slate-900 text-white text-sm'
    : 'px-3 py-1.5 rounded bg-white border text-slate-600 text-sm hover:bg-slate-50'

export async function SessionCalendar({ searchParams }: Props) {
  const { view, ym, year, day } = parseCalendarParams(searchParams)
  const range = rangeForView(view, ym, year)

  const supabase = await createClient()
  // RLS: teacher만 본인 담당 반의 sessions 보임
  const { data: sessionRows } = await supabase
    .from('sessions')
    .select('id, scheduled_at, title, video_url, classes!inner(id, name)')
    .gte('scheduled_at', range.from)
    .lt('scheduled_at', range.to)
    .order('scheduled_at')

  const sessions = (sessionRows ?? []).map((s) => {
    const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes
    return { ...s, class_id: cls?.id ?? '', class_name: cls?.name ?? '-' }
  })

  // 각 session 의 attendance count + class size 병렬 조회
  const sessionIds = sessions.map((s) => s.id)
  const classIds = Array.from(new Set(sessions.map((s) => s.class_id).filter(Boolean)))

  const [{ data: attRows }, { data: csRows }] = await Promise.all([
    sessionIds.length === 0
      ? Promise.resolve({ data: [] as { session_id: string }[] })
      : supabase.from('attendance').select('session_id').in('session_id', sessionIds),
    classIds.length === 0
      ? Promise.resolve({ data: [] as { class_id: string; student_id: string }[] })
      : supabase
          .from('class_students')
          .select('class_id, student_id')
          .in('class_id', classIds)
          .is('left_at', null),
  ])

  const attCount = new Map<string, number>()
  for (const r of attRows ?? []) {
    attCount.set(r.session_id, (attCount.get(r.session_id) ?? 0) + 1)
  }
  const sizeByClass = new Map<string, number>()
  for (const r of csRows ?? []) {
    sizeByClass.set(r.class_id, (sizeByClass.get(r.class_id) ?? 0) + 1)
  }

  const summaries: SessionSummary[] = sessions.map((s) => ({
    id: s.id,
    scheduled_at: s.scheduled_at,
    title: s.title,
    class_id: s.class_id,
    class_name: s.class_name,
    video_url: s.video_url,
    filled_count: attCount.get(s.id) ?? 0,
    class_size: sizeByClass.get(s.class_id) ?? 0,
  }))

  const now = new Date()
  const cells = summaries.map((s) => toCellInfo(s, now))

  // popup용 — 선택된 day 의 cells
  const popupCells = day ? cells.filter((c) => c.session.scheduled_at.slice(0, 10) === day) : []

  // 월 이동 링크용 ym
  const prevYm = shiftYm(ym, -1)
  const nextYm = shiftYm(ym, +1)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Link href={`/teacher?view=week${day ? `&day=${day}` : ''}`} className={VIEW_BTN(view === 'week')}>
            주간
          </Link>
          <Link href={`/teacher?view=month&ym=${ym}${day ? `&day=${day}` : ''}`} className={VIEW_BTN(view === 'month')}>
            월간
          </Link>
          <Link href={`/teacher?view=year&y=${year}`} className={VIEW_BTN(view === 'year')}>
            연간
          </Link>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {view === 'month' && (
            <>
              <Link href={`/teacher?view=month&ym=${prevYm}`} className="px-2 py-1 rounded hover:bg-slate-100">‹</Link>
              <span className="font-semibold">{range.label}</span>
              <Link href={`/teacher?view=month&ym=${nextYm}`} className="px-2 py-1 rounded hover:bg-slate-100">›</Link>
            </>
          )}
          {view === 'year' && (
            <>
              <Link href={`/teacher?view=year&y=${year - 1}`} className="px-2 py-1 rounded hover:bg-slate-100">‹</Link>
              <span className="font-semibold">{range.label}</span>
              <Link href={`/teacher?view=year&y=${year + 1}`} className="px-2 py-1 rounded hover:bg-slate-100">›</Link>
            </>
          )}
          {view === 'week' && <span className="font-semibold">{range.label}</span>}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        {view === 'week' && <CalendarWeek cells={cells} selectedDay={day} />}
        {view === 'month' && <CalendarMonth ym={ym} cells={cells} selectedDay={day} />}
        {view === 'year' && <CalendarYear year={year} cells={cells} />}
      </div>

      <div className="flex gap-3 text-xs text-slate-600">
        <Legend color="bg-green-100" label="완료" />
        <Legend color="bg-amber-100" label="진행중" />
        <Legend color="bg-red-100" label="미입력" />
        <Legend color="bg-indigo-50 border border-indigo-300 border-dashed" label="예정" />
        <span>🎬 영상</span>
      </div>

      {day && view !== 'year' && <SessionPopup day={day} cells={popupCells} />}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block w-3 h-3 ${color} rounded-sm`} />
      {label}
    </span>
  )
}
