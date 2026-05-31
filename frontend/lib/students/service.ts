import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth'
import type {
  StudentRow,
  StudentDetailView,
  ParentLink,
  StudentAssignmentsView,
  ClassAssignment,
} from './types'

/** array-or-object join 결과를 단일 객체로 정규화. */
function pickOne<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

/** 학생 목록 — 이름순. RLS가 학원 범위 필터. */
export async function listStudents(): Promise<StudentRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('students')
    .select('id, name, school, grade, status')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as StudentRow[]
}

/** 학생 상세 + 학부모 연결. join-row 정규화는 여기서 끝냄. */
export async function getStudentDetail(
  id: string
): Promise<StudentDetailView | null> {
  const supabase = await createClient()
  const [studentRes, parentLinksRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, school, grade, status, academy_id')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('student_parent')
      .select('relationship, parents(id, name, phone)')
      .eq('student_id', id),
  ])

  const student = studentRes.data as StudentDetailView['student'] | null
  if (!student) return null

  const links = (parentLinksRes.data ?? []) as Array<{
    relationship: string
    parents: unknown
  }>
  const parentLinks: ParentLink[] = links
    .map((row) => {
      const p = pickOne(row.parents) as
        | { id: string; name: string; phone: string | null }
        | null
      if (!p) return null
      return {
        parent_id: p.id,
        name: p.name,
        phone: p.phone,
        relationship: row.relationship,
      }
    })
    .filter((x): x is ParentLink => x !== null)

  return { student, parentLinks }
}

/** 학생의 반 배정(active/history). 전체 반 드롭다운은 호출측이 lib/classes로 별도 조회. */
export async function getStudentClassAssignments(
  studentId: string
): Promise<StudentAssignmentsView> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_students')
    .select('id, joined_at, left_at, classes(id, name, level)')
    .eq('student_id', studentId)
    .order('joined_at', { ascending: false })
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{
    id: string
    joined_at: string
    left_at: string | null
    classes: unknown
  }>
  const assignments: ClassAssignment[] = rows.map((r) => {
    const c = pickOne(r.classes) as
      | { id: string; name: string; level: string }
      | null
    return {
      assignment_id: r.id,
      class_id: c?.id ?? '',
      class_name: c?.name ?? '(삭제됨)',
      class_level: c?.level ?? '-',
      joined_at: r.joined_at,
      left_at: r.left_at,
    }
  })

  return {
    active: assignments.filter((a) => !a.left_at),
    history: assignments.filter((a) => a.left_at),
  }
}

/** 학생 수 (RLS가 학원 범위). */
export async function countStudents(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** 현재 사용자가 보는 학생 목록.
 * - student: 본인 student 행 (단일)
 * - parent: 연결된 자녀들 (이름순)
 */
export async function getMyChildren(): Promise<
  Array<{ id: string; name: string; grade: string | null }>
> {
  const user = await getSessionUser()
  if (!user) return []
  const supabase = await createClient()

  if (user.role === 'student') {
    const { data } = await supabase
      .from('students')
      .select('id, name, grade')
      .eq('user_id', user.id)
      .maybeSingle()
    return data ? [{ id: data.id, name: data.name, grade: data.grade }] : []
  }

  if (user.role === 'parent') {
    const { data } = await supabase
      .from('student_parent')
      .select('students(id, name, grade)')
    return (data ?? [])
      .map((l: { students: unknown }) =>
        pickOne(l.students) as { id: string; name: string; grade: string | null } | null
      )
      .filter(
        (s): s is { id: string; name: string; grade: string | null } => s !== null
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }

  return []
}

/** 학생 프로필 (헤더 표시용). */
export async function getStudentProfile(
  id: string
): Promise<{ id: string; name: string; school: string | null; grade: string | null } | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('students')
    .select('id, name, school, grade')
    .eq('id', id)
    .maybeSingle()
  return data ?? null
}
