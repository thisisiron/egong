import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Announcement, AnnouncementWithClass } from './types'

const COLUMNS =
  'id, academy_id, class_id, type, title, body, created_by, author_name, created_at, updated_at'

type JoinedRow = Announcement & { classes: { name: string } | null }

function withClassName(row: JoinedRow): AnnouncementWithClass {
  const { classes, ...announcement } = row
  return { ...announcement, class_name: classes?.name ?? null }
}

/** 공지 목록 (최신순). RLS가 역할별 범위 적용 — owner/teacher 페이지 공용.
 * limit 지정 시 최근 N개만 (대시보드 위젯용).
 */
export async function listAnnouncements(limit?: number): Promise<AnnouncementWithClass[]> {
  const supabase = await createClient()
  let query = supabase
    .from('announcements')
    .select(`${COLUMNS}, classes(name)`)
    .order('created_at', { ascending: false })
  if (limit !== undefined) query = query.limit(limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(withClassName)
}

/** /me 공지 — 학원 전체 공지 + 해당 학생의 현재 반 공지, 최근 limit개.
 * 반 조회는 cs_parent_read/cs_self_read RLS로 parent/student 모두 가능.
 */
export async function listAnnouncementsForStudent(
  studentId: string,
  limit = 10
): Promise<AnnouncementWithClass[]> {
  const supabase = await createClient()

  // 선택된 학생의 학원 — 전체 공지는 이 학원 것만 (다학원 학부모 대비)
  const { data: stu, error: stuError } = await supabase
    .from('students')
    .select('academy_id')
    .eq('id', studentId)
    .maybeSingle()
  if (stuError) throw new Error(stuError.message)
  if (!stu) return []

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
      ? query.or(
          `and(class_id.is.null,academy_id.eq.${stu.academy_id}),class_id.in.(${classIds.join(',')})`
        )
      : query.is('class_id', null).eq('academy_id', stu.academy_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(withClassName)
}

/** 게시판 — 해당 학생이 볼 수 있는 공지 전체(학원 전체 + 현재 반), 최신순. /me/board 용. */
export async function listBoardAnnouncements(
  studentId: string
): Promise<AnnouncementWithClass[]> {
  const supabase = await createClient()

  const { data: stu, error: stuError } = await supabase
    .from('students')
    .select('academy_id')
    .eq('id', studentId)
    .maybeSingle()
  if (stuError) throw new Error(stuError.message)
  if (!stu) return []

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
  query =
    classIds.length > 0
      ? query.or(
          `and(class_id.is.null,academy_id.eq.${stu.academy_id}),class_id.in.(${classIds.join(',')})`
        )
      : query.is('class_id', null).eq('academy_id', stu.academy_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(withClassName)
}
