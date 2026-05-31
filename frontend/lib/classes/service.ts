import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type {
  ClassRow,
  ClassDetailView,
  AssignedTeacher,
  AssignedStudent,
  TeacherOption,
  StudentOption,
} from './types'

/** 반 목록 — owner 반 목록 페이지. RLS가 학원 범위 필터. */
export async function listClasses(): Promise<ClassRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, level, description')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as ClassRow[]
}

/** 반 상세 화면이 필요로 하는 모든 데이터를 한 번에. 반환 전에 join row 형태를 모두 정규화. */
export async function getClassDetailView(id: string): Promise<ClassDetailView | null> {
  const supabase = await createClient()
  const [clsRes, teacherLinksRes, studentLinksRes, allTeachersRes, allStudentsRes] =
    await Promise.all([
      supabase.from('classes').select('id, name, level, description').eq('id', id).maybeSingle(),
      supabase.from('class_teachers').select('teacher_id, teachers(users(display_name))').eq('class_id', id),
      supabase
        .from('class_students')
        .select('id, students(id, name, school)')
        .eq('class_id', id)
        .is('left_at', null)
        .order('joined_at'),
      supabase.from('teachers').select('id, users(display_name)'),
      supabase.from('students').select('id, name').eq('status', 'enrolled').order('name'),
    ])

  const cls = clsRes.data as ClassRow | null
  if (!cls) return null

  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

  // 현재 담임 (첫 번째 링크)
  const tLinks = (teacherLinksRes.data ?? []) as Array<{
    teacher_id: string
    teachers: unknown
  }>
  let currentTeacher: AssignedTeacher | null = null
  if (tLinks[0]) {
    const t = pickOne(tLinks[0].teachers) as { users: unknown } | null
    const u = pickOne(t?.users) as { display_name: string } | null
    currentTeacher = {
      teacher_id: tLinks[0].teacher_id,
      display_name: u?.display_name ?? '-',
    }
  }

  // 배정된 학생
  const sLinks = (studentLinksRes.data ?? []) as Array<{ id: string; students: unknown }>
  const students: AssignedStudent[] = sLinks.map((row) => {
    const s = pickOne(row.students) as { id: string; name: string; school: string | null } | null
    return {
      assignment_id: row.id,
      student_id: s?.id ?? '',
      name: s?.name ?? '(삭제됨)',
      school: s?.school ?? null,
    }
  })

  // 담임 선택 옵션 (전체 선생님)
  const teacherOptions: TeacherOption[] = ((allTeachersRes.data ?? []) as Array<{
    id: string
    users: unknown
  }>).map((t) => {
    const u = pickOne(t.users) as { display_name: string } | null
    return { id: t.id, display_name: u?.display_name ?? '(이름 없음)' }
  })

  // 아직 배정 안 된 enrolled 학생
  const assignedIds = new Set(students.map((s) => s.student_id).filter(Boolean))
  const availableStudents: StudentOption[] = ((allStudentsRes.data ?? []) as StudentOption[]).filter(
    (s) => !assignedIds.has(s.id)
  )

  return { cls, currentTeacher, students, teacherOptions, availableStudents }
}
