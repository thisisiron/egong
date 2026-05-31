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

/** join 결과(객체 또는 배열)를 단일 객체로 정규화. */
const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

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

/** 한 반의 현재 배정 학생 명단 (출결 화면용). 이름순. */
export async function getClassRoster(
  classId: string
): Promise<Array<{ id: string; name: string; school: string | null }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_students')
    .select('students(id, name, school)')
    .eq('class_id', classId)
    .is('left_at', null)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ students: unknown }>
  const students = rows
    .map((r) => pickOne(r.students) as { id: string; name: string; school: string | null } | null)
    .filter((s): s is { id: string; name: string; school: string | null } => s !== null)
  students.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return students
}

/** 여러 반의 현재 배정 학생 수 (캘린더 class_size용). Map<class_id, count>. */
export async function getClassSizes(classIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (classIds.length === 0) return result
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_students')
    .select('class_id')
    .in('class_id', classIds)
    .is('left_at', null)
  if (error) throw new Error(error.message)
  for (const r of data ?? []) {
    result.set(r.class_id, (result.get(r.class_id) ?? 0) + 1)
  }
  return result
}
