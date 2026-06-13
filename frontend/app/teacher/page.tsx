import { ScheduleCalendar } from '@/lib/schedule/components/ScheduleCalendar'
import { TeacherSessionAddButton } from '@/lib/sessions/components/TeacherSessionAddButton'
import { MyRecentSessions } from '@/lib/sessions/components/MyRecentSessions'
import { getTeacherSessionsInRange } from '@/lib/sessions/service'
import { getEventsInRange } from '@/lib/events/service'
import { getAttendanceCountsBySessionIds } from '@/lib/attendance/service'
import { getClassSizes } from '@/lib/classes/service'
import { parseCalendarParams, rangeForView, toCellInfo, type SessionSummary } from '@/lib/teacher-calendar'
import { ymdKST } from '@/lib/date'

type SearchParams = { view?: string; ym?: string; y?: string; day?: string }

export default async function TeacherSchedule({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const { view, ym, year, day } = parseCalendarParams(sp)
  const range = rangeForView(view, ym, year, day)

  const sessions = await getTeacherSessionsInRange(range.from, range.to)
  const sessionIds = sessions.map((s) => s.id)
  const classIds = Array.from(new Set(sessions.map((s) => s.class_id).filter(Boolean)))

  const [attCount, sizeByClass, events] = await Promise.all([
    getAttendanceCountsBySessionIds(sessionIds),
    getClassSizes(classIds),
    // 이벤트는 날짜 범위(KST)로 — range.from/to는 ISO이므로 ymdKST로 date 경계 산출
    getEventsInRange(ymdKST(new Date(range.from)), ymdKST(new Date(new Date(range.to).getTime() - 1))),
  ])

  const summaries: SessionSummary[] = sessions.map((s) => ({
    id: s.id,
    scheduled_at: s.scheduled_at,
    title: s.title,
    class_id: s.class_id,
    class_name: s.class_name,
    video_url: s.video_url,
    filled_count: attCount.get(s.id) ?? 0,
    class_size: sizeByClass.get(s.class_id) ?? 0,
    type: s.type,
    cancelled: s.cancelled,
  }))
  const now = new Date()
  const cells = summaries.map((s) => toCellInfo(s, now))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">일정</h1>
        <TeacherSessionAddButton />
      </div>
      <ScheduleCalendar
        basePath="/teacher"
        sessionLinkBase="/teacher"
        searchParams={sp}
        cells={cells}
        events={events}
      />
      <MyRecentSessions />
    </div>
  )
}
