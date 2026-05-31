import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { AttendanceRecord } from './types'

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
