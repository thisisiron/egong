import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Assignment, AssignmentWithClass, AssignmentSubmission } from './types'

const A_COLS = 'id, academy_id, class_id, title, description, due_at, created_by, author_name, created_at'
const S_COLS = 'id, assignment_id, student_id, academy_id, class_id, memo, file_paths, submitted_at, score, feedback, feedback_by, feedback_by_name, feedback_at'

type JoinedAssignment = Assignment & { classes: { name: string } | { name: string }[] | null }
function withClassName(row: JoinedAssignment): AssignmentWithClass {
  const { classes, ...a } = row
  const cls = Array.isArray(classes) ? classes[0] : classes
  return { ...a, class_name: cls?.name ?? null }
}

/** 선생/원장 — 자기 권한 범위 과제 목록 (RLS 적용). 최신순. */
export async function listAssignments(): Promise<AssignmentWithClass[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assignments')
    .select(`${A_COLS}, classes(name)`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(withClassName)
}

/** 학생/학부모 — 해당 학생의 반 과제 (RLS가 자기/자녀 반만). 최신순. */
export async function listAssignmentsForStudent(studentId: string): Promise<AssignmentWithClass[]> {
  const supabase = await createClient()
  const { data: cs, error: csErr } = await supabase
    .from('class_students').select('class_id').eq('student_id', studentId).is('left_at', null)
  if (csErr) throw new Error(csErr.message)
  const classIds = (cs ?? []).map((r) => r.class_id)
  if (classIds.length === 0) return []
  const { data, error } = await supabase
    .from('assignments')
    .select(`${A_COLS}, classes(name)`)
    .in('class_id', classIds)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(withClassName)
}

export async function getAssignment(id: string): Promise<AssignmentWithClass | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assignments').select(`${A_COLS}, classes(name)`).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? withClassName(data as JoinedAssignment) : null
}

/** 선생/원장 보드 — 과제의 모든 제출 + 학생명(선생은 자기 반 학생 읽기 가능). */
export async function getSubmissionsForAssignment(
  assignmentId: string
): Promise<Array<AssignmentSubmission & { student_name: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select(`${S_COLS}, students(name)`)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: AssignmentSubmission & { students: { name: string } | { name: string }[] | null }) => {
    const { students, ...sub } = r
    const stu = Array.isArray(students) ? students[0] : students
    return { ...sub, student_name: stu?.name ?? '-' }
  })
}

/** 반 명단 (제출 보드에서 미제출 학생도 보여주기 위해). RLS: 선생 자기 반/owner 학원. */
export async function getClassRoster(classId: string): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_students')
    .select('students(id, name)')
    .eq('class_id', classId)
    .is('left_at', null)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((r: { students: { id: string; name: string } | { id: string; name: string }[] | null }) => {
      const s = Array.isArray(r.students) ? r.students[0] : r.students
      return s ?? null
    })
    .filter((s): s is { id: string; name: string } => !!s)
}

/** 학생/학부모 — 한 과제의 내(자녀) 제출. */
export async function getMySubmission(
  assignmentId: string,
  studentId: string
): Promise<AssignmentSubmission | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select(S_COLS)
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? null
}

/** 제출 파일 path[] → signed URL[] (비공개 버킷 열람). RLS SELECT 정책 통과 필요. */
export async function signSubmissionFiles(
  paths: string[]
): Promise<Array<{ path: string; url: string | null }>> {
  if (paths.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('assignment-submissions')
    .createSignedUrls(paths, 60 * 10)
  if (error) throw new Error(error.message)
  return (data ?? []).map((d) => ({ path: d.path ?? '', url: d.signedUrl ?? null }))
}
