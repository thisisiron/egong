'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole, getSessionUser } from '@/lib/auth'
import { resolveParentIdByEmail } from '@/lib/parents/service'
import { classBelongsToAcademy } from '@/lib/classes/service'
import { studentTaughtByMe } from './service'
import {
  createStudentSchema,
  updateStudentSchema,
  addParentLinkSchema,
  addStudentNoteSchema,
  studentNoteIdSchema,
} from './schemas'

export type ImportActionResult = {
  ok: boolean
  message: string
}

// Multipart 업로드 — apiFetch(application/json 강제)를 못 쓰므로 직접 fetch.
const BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000') + '/api/v1'

/** 학생이 현재 owner의 학원에 속하는지 확인. 아니면 throw. (RLS 위 2차 방어선) */
async function verifyStudentOwnership(studentId: string): Promise<void> {
  const user = await getSessionUser()
  if (!user) throw new Error('로그인이 필요합니다.')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('students')
    .select('academy_id')
    .eq('id', studentId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.academy_id !== user.academyId) {
    throw new Error('권한이 없습니다.')
  }
}

export async function createStudentAction(formData: FormData) {
  const owner = await requireRole(['owner'])
  if (!owner.academyId) throw new Error('소속 학원 정보가 없습니다.')

  const parsed = createStudentSchema.parse({
    name: formData.get('name'),
    school: formData.get('school'),
    grade: formData.get('grade'),
  })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('students')
    .insert({
      academy_id: owner.academyId,
      name: parsed.name,
      school: parsed.school,
      grade: parsed.grade,
      status: 'enrolled',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  redirect(`/owner/students/${data.id}`)
}

export async function updateStudentAction(formData: FormData) {
  await requireRole(['owner'])
  const parsed = updateStudentSchema.parse({
    id: formData.get('id'),
    name: formData.get('name'),
    school: formData.get('school'),
    grade: formData.get('grade'),
    status: formData.get('status'),
  })
  await verifyStudentOwnership(parsed.id)

  const supabase = await createClient()
  const { error } = await supabase
    .from('students')
    .update({
      name: parsed.name,
      school: parsed.school,
      grade: parsed.grade,
      status: parsed.status,
    })
    .eq('id', parsed.id)
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${parsed.id}`)
}

export async function addParentLinkAction(formData: FormData) {
  await requireRole(['owner'])
  const parsed = addParentLinkSchema.parse({
    student_id: formData.get('student_id'),
    parent_email: formData.get('parent_email'),
    relationship: formData.get('relationship'),
  })
  await verifyStudentOwnership(parsed.student_id)

  // owner UI는 학부모 이메일만 안다. backend가 auth.users를 service-role로
  // 조회해 parent.id로 해석. 미발견 시 명확한 안내 메시지.
  const parentId = await resolveParentIdByEmail(parsed.parent_email)
  if (!parentId) {
    throw new Error(
      `해당 이메일의 학부모를 찾을 수 없습니다: ${parsed.parent_email}. 먼저 /owner/parents/new 에서 학부모를 등록하세요.`
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.from('student_parent').insert({
    student_id: parsed.student_id,
    parent_id: parentId,
    relationship: parsed.relationship,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${parsed.student_id}`)
}

export async function removeParentLinkAction(formData: FormData) {
  await requireRole(['owner'])
  const studentId = String(formData.get('student_id'))
  const parentId = String(formData.get('parent_id'))
  await verifyStudentOwnership(studentId)

  const supabase = await createClient()
  const { error } = await supabase
    .from('student_parent')
    .delete()
    .eq('student_id', studentId)
    .eq('parent_id', parentId)
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${studentId}`)
}

export async function assignToClassAction(formData: FormData) {
  const owner = await requireRole(['owner'])
  if (!owner.academyId) throw new Error('소속 학원 정보가 없습니다.')
  const studentId = String(formData.get('student_id'))
  const classId = String(formData.get('class_id'))
  await verifyStudentOwnership(studentId)
  if (!(await classBelongsToAcademy(classId, owner.academyId))) {
    throw new Error('권한이 없습니다.')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('class_students')
    .insert({ class_id: classId, student_id: studentId })
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${studentId}`)
}

export async function unassignFromClassAction(formData: FormData) {
  await requireRole(['owner'])
  const assignmentId = String(formData.get('assignment_id'))
  const studentId = String(formData.get('student_id'))
  await verifyStudentOwnership(studentId)

  const today = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()
  const { error } = await supabase
    .from('class_students')
    .update({ left_at: today })
    .eq('id', assignmentId)
    .eq('student_id', studentId)
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${studentId}`)
}

/** teacher가 이 학생의 담당인지 확인. 아니면 throw. */
async function verifyTeacherStudentAccess(studentId: string): Promise<void> {
  if (!(await studentTaughtByMe(studentId))) throw new Error('권한이 없습니다.')
}

export async function addStudentNoteAction(formData: FormData) {
  const user = await requireRole(['owner', 'teacher'])
  const parsed = addStudentNoteSchema.parse({
    student_id: formData.get('student_id'),
    body: formData.get('body'),
  })

  // 소유권 재검증 (RLS 위 2차 방어선)
  if (user.role === 'owner') {
    await verifyStudentOwnership(parsed.student_id)
  } else {
    await verifyTeacherStudentAccess(parsed.student_id)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('student_notes').insert({
    student_id: parsed.student_id,
    body: parsed.body,
    created_by: user.id,
    author_name: user.displayName,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${parsed.student_id}`)
  revalidatePath('/teacher/sessions/[id]', 'page')
}

export async function deleteStudentNoteAction(formData: FormData) {
  const user = await requireRole(['owner', 'teacher'])
  const noteId = studentNoteIdSchema.parse(formData.get('note_id'))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('student_notes')
    .select('id, student_id, created_by')
    .eq('id', noteId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('메모를 찾을 수 없습니다.')

  // owner: 학생이 자기 학원 소속이면 삭제 가능. teacher: 본인 작성분만.
  if (user.role === 'owner') {
    await verifyStudentOwnership(data.student_id)
  } else if (data.created_by !== user.id) {
    throw new Error('본인이 작성한 메모만 삭제할 수 있습니다.')
  }

  const { error: delError } = await supabase
    .from('student_notes')
    .delete()
    .eq('id', noteId)
  if (delError) throw new Error(delError.message)
  revalidatePath(`/owner/students/${data.student_id}`)
  revalidatePath('/teacher/sessions/[id]', 'page')
}

export async function uploadStudentsCsvAction(
  formData: FormData
): Promise<ImportActionResult> {
  await requireRole(['owner'])

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    return { ok: false, message: '세션이 만료되었습니다. 다시 로그인하세요.' }
  }

  const resp = await fetch(`${BASE}/owner/import/students`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  })

  if (!resp.ok) {
    const text = await resp.text()
    return { ok: false, message: `오류: ${text}` }
  }

  const result = (await resp.json()) as {
    kind: string
    inserted: number
    errors: string[]
  }
  let msg = `${result.inserted}명 등록됨`
  if (result.errors?.length) {
    msg += ` (오류 ${result.errors.length}개)`
  }
  return { ok: true, message: msg }
}
