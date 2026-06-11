import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Announcement, AnnouncementWithClass } from './types'

/** array-or-object join 결과를 단일 객체로 정규화. */
function pickOne<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

const COLUMNS =
  'id, academy_id, class_id, title, body, created_by, author_name, created_at, updated_at'

type JoinedRow = Announcement & { classes: unknown }

function withClassName(row: JoinedRow): AnnouncementWithClass {
  const c = pickOne(row.classes) as { name: string } | null
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { classes: _classes, ...announcement } = row
  return { ...announcement, class_name: c?.name ?? null }
}

/** 공지 목록 (최신순). RLS가 역할별 범위 적용 — owner/teacher 페이지 공용. */
export async function listAnnouncements(): Promise<AnnouncementWithClass[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('announcements')
    .select(`${COLUMNS}, classes(name)`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as JoinedRow[]).map(withClassName)
}

/** /me 공지 — 학원 전체 공지 + 해당 학생의 현재 반 공지, 최근 limit개.
 * 반 조회는 cs_parent_read/cs_self_read RLS로 parent/student 모두 가능.
 */
export async function listAnnouncementsForStudent(
  studentId: string,
  limit = 10
): Promise<AnnouncementWithClass[]> {
  const supabase = await createClient()

  const { data: cs, error: csError } = await supabase
    .from('class_students')
    .select('class_id')
    .eq('student_id', studentId)
    .is('left_at', null)
  if (csError) throw new Error(csError.message)
  const classIds = (cs ?? []).map((r) => r.class_id)

  let query = supabase
    .from('announcements')
    .select(`${COLUMNS}, classes(name)`)
    .order('created_at', { ascending: false })
    .limit(limit)
  query =
    classIds.length > 0
      ? query.or(`class_id.is.null,class_id.in.(${classIds.join(',')})`)
      : query.is('class_id', null)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as JoinedRow[]).map(withClassName)
}
