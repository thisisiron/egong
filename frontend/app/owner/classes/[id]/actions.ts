'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function setTeacherAction(formData: FormData) {
  await requireRole(['owner'])

  const classId = String(formData.get('class_id'))
  const newTeacherId = String(formData.get('teacher_id'))
  const currentTeacherId = formData.get('current_teacher_id')

  const supabase = await createClient()
  if (currentTeacherId) {
    const cur = String(currentTeacherId)
    if (cur === newTeacherId) {
      // No-op — selected the same teacher.
      return
    }
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

export async function addStudentAction(formData: FormData) {
  await requireRole(['owner'])

  const classId = String(formData.get('class_id'))
  const studentId = String(formData.get('student_id'))
  const supabase = await createClient()
  const { error } = await supabase
    .from('class_students')
    .insert({ class_id: classId, student_id: studentId })
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/classes/${classId}`)
}

export async function removeStudentAction(formData: FormData) {
  await requireRole(['owner'])

  const assignmentId = String(formData.get('assignment_id'))
  const classId = String(formData.get('class_id'))
  const today = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()
  const { error } = await supabase
    .from('class_students')
    .update({ left_at: today })
    .eq('id', assignmentId)
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/classes/${classId}`)
}
