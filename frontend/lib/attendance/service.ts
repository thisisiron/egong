import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { todayRangeKST } from '@/lib/date'
import { getClassRosterIds } from '@/lib/classes/service'
import type { AttendanceRecord, AttendanceStatus, TodaySessionSummary } from './types'

/** 한 세션의 출결 기록 전체. */
export async function getSessionAttendance(
  sessionId: string
): Promise<AttendanceRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, status, excused_reason, needs_makeup')
    .eq('session_id', sessionId)
  if (error) throw new Error(error.message)
  return (data ?? []) as AttendanceRecord[]
}

/** 여러 세션의 출결 입력 건수 (N+1 회피). Map<session_id, count>. */
export async function getAttendanceCountsBySessionIds(
  sessionIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (sessionIds.length === 0) return result
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select('session_id')
    .in('session_id', sessionIds)
  if (error) throw new Error(error.message)
  for (const r of data ?? []) {
    result.set(r.session_id, (result.get(r.session_id) ?? 0) + 1)
  }
  return result
}

/** 출석률 (가중치 적용 RPC). 데이터 없으면 null. DB 에러는 throw — 0건과 구분. */
export async function getAttendanceRate(
  studentId: string,
  fromYmd: string,
  toYmd: string
): Promise<number | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('attendance_rate', {
    p_student_id: studentId,
    p_from: fromYmd,
    p_to: toYmd,
  })
  if (error) throw new Error(error.message)
  return (data as number | null) ?? null
}

/** 상태별 카운트 (RPC). DB 에러는 throw — 0건과 구분. */
export async function getAttendanceCounts(
  studentId: string,
  fromYmd: string,
  toYmd: string
): Promise<{
  present_count: number
  late_count: number
  absent_count: number
  excused_count: number
}> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('attendance_counts', {
    p_student_id: studentId,
    p_from: fromYmd,
    p_to: toYmd,
  })
  if (error) throw new Error(error.message)
  return (
    data?.[0] ?? {
      present_count: 0,
      late_count: 0,
      absent_count: 0,
      excused_count: 0,
    }
  )
}

/** 학생의 기간 내 출결 (캘린더용). [fromIso, toIso) — monthRange().fromIso/toIso 사용.
 * 세션 시간 오름차순 정렬 — 같은 날 세션이 여러 개면 마지막 세션이 캘린더 색을
 * 결정 (buildMonthDays의 last-write-wins와 결합해 결정적). DB 에러는 throw.
 */
export async function getStudentAttendanceWithDates(
  studentId: string,
  fromIso: string,
  toIso: string
): Promise<Array<{ status: AttendanceStatus; scheduled_at: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select('status, sessions!inner(scheduled_at)')
    .eq('student_id', studentId)
    .gte('sessions.scheduled_at', fromIso)
    .lt('sessions.scheduled_at', toIso)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row: { status: AttendanceStatus; sessions: unknown }) => {
      const s = (Array.isArray(row.sessions) ? row.sessions[0] : row.sessions) as
        | { scheduled_at: string }
        | null
      return { status: row.status, scheduled_at: s?.scheduled_at ?? '' }
    })
    .filter((r) => r.scheduled_at !== '')
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
}

/** 최근 출결 + 세션 (영상 목록용). 최신순. */
export async function getRecentAttendanceSessions(
  studentId: string,
  limit = 6
): Promise<
  Array<{
    status: AttendanceStatus
    session: { id: string; title: string; scheduled_at: string; video_url: string | null }
  }>
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('attendance')
    .select('status, sessions(id, title, scheduled_at, video_url)')
    .eq('student_id', studentId)
    .limit(limit)
  return (data ?? [])
    .map((r: { status: AttendanceStatus; sessions: unknown }) => {
      const s = (Array.isArray(r.sessions) ? r.sessions[0] : r.sessions) as
        | { id: string; title: string; scheduled_at: string; video_url: string | null }
        | null
      return s ? { status: r.status, session: s } : null
    })
    .filter(
      (
        r
      ): r is {
        status: AttendanceStatus
        session: { id: string; title: string; scheduled_at: string; video_url: string | null }
      } => r !== null
    )
    .sort(
      (a, b) =>
        new Date(b.session.scheduled_at).getTime() -
        new Date(a.session.scheduled_at).getTime()
    )
}

/** 오늘(KST) 세션별 출결 집계 — owner 대시보드용. RLS(sessions_owner_all)가 학원 범위 적용.
 * marked/present/late/absent는 **현재 명단(left_at IS NULL) 학생만** 집계 —
 * 퇴원·반이동 학생의 잔여 출결 행이 '입력 완료'를 거짓으로 만들지 않도록
 * roster_count와 모집단을 일치시킨다.
 */
export async function getTodaySessionsSummary(): Promise<TodaySessionSummary[]> {
  const supabase = await createClient()
  const { fromIso, toIso } = todayRangeKST()

  // 휴강 세션은 출결 모집단에서 제외
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, class_id, scheduled_at, classes(name)')
    .gte('scheduled_at', fromIso)
    .lt('scheduled_at', toIso)
    .eq('cancelled', false)
    .order('scheduled_at')
  if (error) throw new Error(error.message)
  if (!sessions || sessions.length === 0) return []

  const sessionIds = sessions.map((s) => s.id)
  const classIds = [...new Set(sessions.map((s) => s.class_id))]
  const classBySession = new Map(sessions.map((s) => [s.id, s.class_id]))

  // 현재 명단(classes 도메인 service 재사용)과 출결 행을 병렬로
  const [rosters, attRes] = await Promise.all([
    getClassRosterIds(classIds),
    supabase
      .from('attendance')
      .select('session_id, student_id, status')
      .in('session_id', sessionIds),
  ])
  if (attRes.error) throw new Error(attRes.error.message)

  const agg = new Map<
    string,
    { present: number; late: number; absent: number; marked: number }
  >()
  for (const a of attRes.data ?? []) {
    // 현재 명단 밖(퇴원·반이동) 학생의 출결 행은 집계 제외 — roster_count와 모집단 일치
    const roster = rosters.get(classBySession.get(a.session_id) ?? '')
    if (!roster?.has(a.student_id)) continue
    const cur =
      agg.get(a.session_id) ?? { present: 0, late: 0, absent: 0, marked: 0 }
    cur.marked += 1
    if (a.status === 'present') cur.present += 1
    else if (a.status === 'late') cur.late += 1
    else cur.absent += 1 // absent + 레거시 excused 합산
    agg.set(a.session_id, cur)
  }

  return sessions.map((s) => {
    const a = agg.get(s.id) ?? { present: 0, late: 0, absent: 0, marked: 0 }
    return {
      session_id: s.id,
      class_id: s.class_id,
      class_name: s.classes?.name ?? '-',
      scheduled_at: s.scheduled_at,
      roster_count: rosters.get(s.class_id)?.size ?? 0,
      marked: a.marked,
      present: a.present,
      late: a.late,
      absent: a.absent,
    }
  })
}
