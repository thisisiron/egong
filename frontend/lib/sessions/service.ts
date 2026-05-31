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

/** 선생님 출결 화면용 — 단일 세션 메타 + 반 정보. */
export async function getSessionForTeacher(id: string): Promise<{
  id: string
  scheduled_at: string
  title: string
  unit: string | null
  video_url: string | null
  class_id: string
  class_name: string
} | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sessions')
    .select('id, scheduled_at, title, unit, video_url, classes(id, name)')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const cls = (Array.isArray(data.classes) ? data.classes[0] : data.classes) as
    | { id: string; name: string }
    | null
  if (!cls) return null
  return {
    id: data.id,
    scheduled_at: data.scheduled_at,
    title: data.title,
    unit: data.unit,
    video_url: data.video_url,
    class_id: cls.id,
    class_name: cls.name,
  }
}

/** 선생님 캘린더용 — 기간 내 본인 반 세션 (RLS가 본인 반만). */
export async function getTeacherSessionsInRange(
  fromIso: string,
  toIso: string
): Promise<
  Array<{
    id: string
    scheduled_at: string
    title: string
    video_url: string | null
    class_id: string
    class_name: string
  }>
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sessions')
    .select('id, scheduled_at, title, video_url, classes!inner(id, name)')
    .gte('scheduled_at', fromIso)
    .lt('scheduled_at', toIso)
    .order('scheduled_at')
  return (data ?? []).map((s: { id: string; scheduled_at: string; title: string; video_url: string | null; classes: unknown }) => {
    const cls = (Array.isArray(s.classes) ? s.classes[0] : s.classes) as
      | { id: string; name: string }
      | null
    return {
      id: s.id,
      scheduled_at: s.scheduled_at,
      title: s.title,
      video_url: s.video_url,
      class_id: cls?.id ?? '',
      class_name: cls?.name ?? '-',
    }
  })
}
