import { getSessionUser } from '@/lib/auth'

import { AttendanceCalendar } from './_components/AttendanceCalendar'
import { AttendanceStats } from './_components/AttendanceStats'
import { ChildSelector } from './_components/ChildSelector'
import { SessionVideoItem } from './_components/SessionVideoItem'

import { monthRange, ymd } from '@/lib/date'
import { getMyChildren, getStudentProfile } from '@/lib/students/service'
import {
  getAttendanceRate,
  getAttendanceCounts,
  getStudentAttendanceWithDates,
  getRecentAttendanceSessions,
} from '@/lib/attendance/service'
import { listAnnouncementsForStudent } from '@/lib/announcements/service'
import { AnnouncementCard } from '@/lib/announcements/components/AnnouncementCard'

type AttStatus = 'present' | 'late' | 'absent' | 'excused'

export default async function MyStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>
}) {
  const user = await getSessionUser()
  if (!user) return null
  const { child: childParam } = await searchParams

  const children = await getMyChildren()
  const targetStudentId = childParam ?? children[0]?.id ?? null

  if (!targetStudentId) {
    return (
      <div className="text-center text-slate-500 py-12">
        표시할 학생 정보가 없습니다.
      </div>
    )
  }

  const now = new Date()
  const range = monthRange(now)

  const [rate, counts, student, monthAttRaw, recentSessions, announcements] =
    await Promise.all([
      getAttendanceRate(targetStudentId, range.from, range.to),
      getAttendanceCounts(targetStudentId, range.from, range.to),
      getStudentProfile(targetStudentId),
      getStudentAttendanceWithDates(targetStudentId),
      getRecentAttendanceSessions(targetStudentId, 6),
      listAnnouncementsForStudent(targetStudentId),
    ])

  // 이번 달로 필터 (PostgREST join 필터가 brittle → JS에서)
  const monthAtt = monthAttRaw.filter((row) => {
    const d = new Date(row.scheduled_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })

  const todayYmd = ymd(now)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const statusByDay: Record<number, AttStatus> = {}
  for (const row of monthAtt) {
    const d = new Date(row.scheduled_at).getDate()
    statusByDay[d] = row.status as AttStatus
  }
  const days = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    status: statusByDay[i + 1] ?? null,
    isToday: ymd(new Date(now.getFullYear(), now.getMonth(), i + 1)) === todayYmd,
  }))

  return (
    <div className="space-y-6">
      <header className="bg-white border border-amber-100 rounded-lg p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-semibold">
          {student?.name?.[0] ?? '학'}
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold">{student?.name}</div>
          <div className="text-sm text-slate-600">
            {student?.school ?? '-'} · {student?.grade ?? '-'}
          </div>
        </div>
        {user.role === 'parent' && (
          <ChildSelector items={children} current={targetStudentId} />
        )}
      </header>

      <section className="space-y-2">
        <h2 className="font-semibold text-sm">📢 공지사항</h2>
        {announcements.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} canManage={false} />
        ))}
        {announcements.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">공지사항이 없습니다.</p>
        )}
      </section>

      <AttendanceStats
        rate={rate}
        present={counts.present_count}
        late={counts.late_count}
        absent={counts.absent_count + counts.excused_count}
      />

      <section className="bg-white border border-amber-100 rounded-lg p-4">
        <AttendanceCalendar
          year={now.getFullYear()}
          month={now.getMonth() + 1}
          days={days}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-sm">🎬 최근 수업 영상</h2>
        {recentSessions.map((r, idx) => (
          <SessionVideoItem
            key={idx}
            title={r.session.title}
            scheduledAt={r.session.scheduled_at}
            status={r.status}
            videoUrl={r.session.video_url}
          />
        ))}
        {recentSessions.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            아직 출결 기록이 없습니다.
          </p>
        )}
      </section>
    </div>
  )
}
