'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function assignToClassAction(formData: FormData) {
  await requireRole(['owner'])

  const studentId = String(formData.get('student_id'))
  const classId = String(formData.get('class_id'))
  const supabase = await createClient()
  const { error } = await supabase.from('class_students').insert({
    class_id: classId,
    student_id: studentId,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${studentId}`)
}

export async function unassignFromClassAction(formData: FormData) {
  await requireRole(['owner'])

  const assignmentId = String(formData.get('assignment_id'))
  const studentId = String(formData.get('student_id'))
  const today = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()
  const { error } = await supabase
    .from('class_students')
    .update({ left_at: today })
    .eq('id', assignmentId)
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${studentId}`)
}
