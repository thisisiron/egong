'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole, getSessionUser } from '@/lib/auth'
import { studentBelongsToAcademy } from '@/lib/students/service'
import { teacherBelongsToAcademy } from '@/lib/teachers/service'
import { createClassSchema } from './schemas'

/** owner의 학원에 속한 반인지 확인. 아니면 throw. (RLS 위 2차 방어선) */
async function verifyClassOwnership(classId: string): Promise<void> {
  const user = await getSessionUser()
  if (!user) throw new Error('로그인이 필요합니다.')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .select('academy_id')
    .eq('id', classId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.academy_id !== user.academyId) throw new Error('권한이 없습니다.')
}

export async function createClassAction(formData: FormData) {
  const owner = await requireRole(['owner'])
  if (!owner.academyId) throw new Error('소속 학원 정보가 없습니다.')

  const parsed = createClassSchema.parse({
    name: formData.get('name'),
    level: formData.get('level'),
    description: formData.get('description'),
  })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .insert({
      academy_id: owner.academyId,
      name: parsed.name,
      level: parsed.level,
      description: parsed.description,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  redirect(`/owner/classes/${data.id}`)
}

export async function setClassTeacherAction(formData: FormData) {
  const owner = await requireRole(['owner'])
  if (!owner.academyId) throw new Error('소속 학원 정보가 없습니다.')
  const classId = String(formData.get('class_id'))
  const newTeacherId = String(formData.get('teacher_id'))
  const currentTeacherId = formData.get('current_teacher_id')
  await verifyClassOwnership(classId)
  if (!(await teacherBelongsToAcademy(newTeacherId, owner.academyId))) {
    throw new Error('권한이 없습니다.')
  }

  const supabase = await createClient()
  if (currentTeacherId) {
    const cur = String(currentTeacherId)
    if (cur === newTeacherId) return  // 동일 선생님 — no-op
    const { error: delErr } = await supabase
      .from('class_teachers')
      .delete()
      .eq('class_id', classId)
      .eq('teacher_id', cur)
    if (delErr) throw new Error(delErr.message)
  }
  const { error } = await supabase
    .from('class_teachers')
    .insert({ class_id: classId, teacher_id: newTeacherId })
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/classes/${classId}`)
}

export async function addClassStudentAction(formData: FormData) {
  const owner = await requireRole(['owner'])
  if (!owner.academyId) throw new Error('소속 학원 정보가 없습니다.')
  const classId = String(formData.get('class_id'))
  const studentId = String(formData.get('student_id'))
  await verifyClassOwnership(classId)
  if (!(await studentBelongsToAcademy(studentId, owner.academyId))) {
    throw new Error('권한이 없습니다.')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('class_students')
    .insert({ class_id: classId, student_id: studentId })
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/classes/${classId}`)
}

export async function removeClassStudentAction(formData: FormData) {
  await requireRole(['owner'])
  const assignmentId = String(formData.get('assignment_id'))
  const classId = String(formData.get('class_id'))
  await verifyClassOwnership(classId)

  const today = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()
  const { error } = await supabase
    .from('class_students')
    .update({ left_at: today })
    .eq('id', assignmentId)
    .eq('class_id', classId)
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/classes/${classId}`)
}
