import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type {
  Session,
  SessionWithClass,
  TeachingClassOption,
} from './types'

/** 반의 최근 세션 N개 — 원장 페이지 SessionsManager 용. */
export async function getClassSessions(
  classId: string,
  limit = 30
): Promise<Session[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('id, class_id, scheduled_at, title, unit, video_url, video_notes')
    .eq('class_id', classId)
    .order('scheduled_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

/** 여러 세션의 attendance 카운트 일괄 조회 (N+1 회피).
 * Returns Map<session_id, count>.
 */
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

/** 선생님이 가르치는 반 목록 — 추가 다이얼로그 드롭다운 용.
 * RLS: classes_teacher_read 정책으로 본인 가르치는 반만 보임.
 */
export async function getMyTeachingClasses(): Promise<TeachingClassOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((c) => ({ id: c.id, name: c.name }))
}

/** 선생님 페이지 — 최근 14일 내 본인 반 세션 (최신 우선). */
export async function getMyRecentSessions(
  daysBack = 14
): Promise<SessionWithClass[]> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - daysBack)
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, class_id, scheduled_at, title, unit, video_url, video_notes, classes!inner(id, name)'
    )
    .gte('scheduled_at', since.toISOString())
    .order('scheduled_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((s: { classes?: { name?: string } | { name?: string }[] } & Session) => {
    const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes
    return {
      id: s.id,
      class_id: s.class_id,
      scheduled_at: s.scheduled_at,
      title: s.title,
      unit: s.unit,
      video_url: s.video_url,
      video_notes: s.video_notes,
      class_name: cls?.name ?? '-',
    }
  })
}
