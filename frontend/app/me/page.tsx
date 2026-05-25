import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth'

import { AttendanceCalendar } from './_components/AttendanceCalendar'
import { AttendanceStats } from './_components/AttendanceStats'
import { ChildSelector } from './_components/ChildSelector'
import { SessionVideoItem } from './_components/SessionVideoItem'

import { monthRange, ymd } from '@/lib/attendance'

type AttStatus = 'present' | 'late' | 'absent' | 'excused'

type SessionRef = {
  id: string
  title: string
  scheduled_at: string
  video_url: string | null
}

type SessionRefShort = { scheduled_at: string }

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

export default async function MyStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>
}) {
  const user = await getSessionUser()
  if (!user) return null
  const { child: childParam } = await searchParams

  const supabase = await createClient()

  let children: { id: string; name: string; grade: string | null }[] = []
  let targetStudentId: string | null = null

  if (user.role === 'student') {
    const { data } = await supabase
      .from('students')
      .select('id, name, grade')
      .eq('user_id', user.id)
      .single()
    if (data) {
      children = [{ id: data.id, name: data.name, grade: data.grade }]
      targetStudentId = data.id
    }
  } else if (user.role === 'parent') {
    const { data: links } = await supabase
      .from('student_parent')
      .select('students(id, name, grade)')
    children = (links ?? [])
      .map((l) => pickOne(l.students))
      .filter(
        (s): s is { id: string; name: string; grade: string | null } =>
          Boolean(s),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    targetStudentId = childParam ?? children[0]?.id ?? null
  }

  if (!targetStudentId) {
    return (
      <div className="text-center text-slate-500 py-12">
        표시할 학생 정보가 없습니다.
      </div>
    )
  }

  const now = new Date()
  const range = monthRange(now)

  // Parallel fetch — Addendum C2
  const [
    rateResult,
    countsResult,
    studentResult,
    monthAttResult,
    recentResult,
  ] = await Promise.all([
    supabase.rpc('attendance_rate', {
      p_student_id: targetStudentId,
      p_from: range.from,
      p_to: range.to,
    }),
    supabase.rpc('attendance_counts', {
      p_student_id: targetStudentId,
      p_from: range.from,
      p_to: range.to,
    }),
    supabase
      .from('students')
      .select('id, name, school, grade')
      .eq('id', targetStudentId)
      .single(),
    supabase
      .from('attendance')
      .select('status, sessions(scheduled_at)')
      .eq('student_id', targetStudentId),
    supabase
      .from('attendance')
      .select('status, sessions(id, title, scheduled_at, video_url)')
      .eq('student_id', targetStudentId)
      .limit(6),
  ])

  const student = studentResult.data
  const rate = (rateResult.data as number | null) ?? null
  const counts = countsResult.data?.[0] ?? {
    present_count: 0,
    late_count: 0,
    absent_count: 0,
    excused_count: 0,
  }

  // Filter month attendance to current month (PostgREST join filter is brittle; do it in JS)
  const monthAtt = (monthAttResult.data ?? []).filter((row) => {
    const s = pickOne<SessionRefShort>(row.sessions)
    if (!s?.scheduled_at) return false
    const d = new Date(s.scheduled_at)
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    )
  })

  // Sort recent sessions by scheduled_at desc in JS (PostgREST cross-table ordering is brittle)
  const recentSessions = (recentResult.data ?? [])
    .map((r) => ({
      status: r.status as AttStatus,
      session: pickOne<SessionRef>(r.sessions),
    }))
    .filter((r): r is { status: AttStatus; session: SessionRef } =>
      Boolean(r.session),
    )
    .sort(
      (a, b) =>
        new Date(b.session.scheduled_at).getTime() -
        new Date(a.session.scheduled_at).getTime(),
    )

  const todayYmd = ymd(now)
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate()
  const statusByDay: Record<number, AttStatus> = {}
  for (const row of monthAtt) {
    const s = pickOne<SessionRefShort>(row.sessions)
    if (!s?.scheduled_at) continue
    const d = new Date(s.scheduled_at).getDate()
    statusByDay[d] = row.status as AttStatus
  }
  const days = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    status: statusByDay[i + 1] ?? null,
    isToday:
      ymd(new Date(now.getFullYear(), now.getMonth(), i + 1)) === todayYmd,
  }))

  return (
    <div className="space-y-6">
      <header className="bg-white border rounded-lg p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
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

      <AttendanceStats
        rate={rate}
        present={counts.present_count}
        late={counts.late_count}
        absent={counts.absent_count + counts.excused_count}
      />

      <section className="bg-white border rounded-lg p-4">
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
