import { getSessionUser } from '@/lib/auth'

import { AttendanceCalendar } from '@/lib/attendance/components/AttendanceCalendar'
import { AttendanceStats } from '@/lib/attendance/components/AttendanceStats'
import { buildMonthDays } from '@/lib/attendance/calendar'
import { ChildSelector } from './_components/ChildSelector'
import { SessionVideoItem } from './_components/SessionVideoItem'

import { kstParts, monthRange } from '@/lib/date'
import { getMyChildren, getStudentProfile } from '@/lib/students/service'
import {
  getAttendanceRate,
  getAttendanceCounts,
  getStudentAttendanceWithDates,
  getRecentAttendanceSessions,
} from '@/lib/attendance/service'
import { listAnnouncementsForStudent } from '@/lib/announcements/service'
import { AnnouncementCard } from '@/lib/announcements/components/AnnouncementCard'
import { getEventsInRange } from '@/lib/events/service'

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
  const { year, month } = kstParts(now)

  // 출결 3종은 묶어서 fail-soft — 출결 조회 실패가 대시보드 전체를 죽이지 않게.
  const attendancePromise = Promise.all([
    getAttendanceRate(targetStudentId, range.from, range.to),
    getAttendanceCounts(targetStudentId, range.from, range.to),
    getStudentAttendanceWithDates(targetStudentId, range.fromIso, range.toIso),
  ]).catch((e: unknown) => {
    console.error('출결 조회 실패:', e)
    return null
  })

  // 이벤트(시험/상담) 읽기 전용 오버레이 — RLS가 자기 반 + 학원 전체만 반환.
  // fail-soft: 이벤트 조회 실패가 대시보드를 죽이지 않게.
  const eventsPromise = getEventsInRange(range.from, range.to).catch(
    (e: unknown) => {
      console.error('이벤트 조회 실패:', e)
      return []
    }
  )

  const [student, recentSessions, announcements, attendance, events] =
    await Promise.all([
      getStudentProfile(targetStudentId),
      getRecentAttendanceSessions(targetStudentId, 6),
      listAnnouncementsForStudent(targetStudentId),
      attendancePromise,
      eventsPromise,
    ])

  return (
    <div className="space-y-6">
      <header className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-slate-700 font-semibold">
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

      {attendance ? (
        <>
          <AttendanceStats
            rate={attendance[0]}
            present={attendance[1].present_count}
            late={attendance[1].late_count}
            absent={attendance[1].absent_count + attendance[1].excused_count}
          />

          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <AttendanceCalendar
              year={year}
              month={month}
              days={buildMonthDays(year, month, attendance[2], now, events)}
            />
          </section>
        </>
      ) : (
        <section className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-slate-400 text-center">
          출결 정보를 불러오지 못했습니다. 잠시 후 새로고침해주세요.
        </section>
      )}

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
