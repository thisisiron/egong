import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { AttendanceRecord, AttendanceStatus } from './types'

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

/** 출석률 (가중치 적용 RPC). 데이터 없으면 null. */
export async function getAttendanceRate(
  studentId: string,
  fromYmd: string,
  toYmd: string
): Promise<number | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('attendance_rate', {
    p_student_id: studentId,
    p_from: fromYmd,
    p_to: toYmd,
  })
  return (data as number | null) ?? null
}

/** 상태별 카운트 (RPC). */
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
  const { data } = await supabase.rpc('attendance_counts', {
    p_student_id: studentId,
    p_from: fromYmd,
    p_to: toYmd,
  })
  return (
    data?.[0] ?? {
      present_count: 0,
      late_count: 0,
      absent_count: 0,
      excused_count: 0,
    }
  )
}

/** 학생의 전체 출결 (캘린더용 — 호출측이 이번 달로 필터). */
export async function getStudentAttendanceWithDates(
  studentId: string
): Promise<Array<{ status: AttendanceStatus; scheduled_at: string }>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('attendance')
    .select('status, sessions(scheduled_at)')
    .eq('student_id', studentId)
  return (data ?? [])
    .map((row: { status: AttendanceStatus; sessions: unknown }) => {
      const s = (Array.isArray(row.sessions) ? row.sessions[0] : row.sessions) as
        | { scheduled_at: string }
        | null
      return { status: row.status, scheduled_at: s?.scheduled_at ?? '' }
    })
    .filter((r) => r.scheduled_at !== '')
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
