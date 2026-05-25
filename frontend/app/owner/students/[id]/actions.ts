'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { apiFetch } from '@/lib/api/client'

export async function updateStudentAction(formData: FormData) {
  await requireRole(['owner'])

  const id = String(formData.get('id'))
  const supabase = await createClient()
  const { error } = await supabase
    .from('students')
    .update({
      name: String(formData.get('name')),
      school: String(formData.get('school') || '') || null,
      grade: String(formData.get('grade') || '') || null,
      status: String(formData.get('status')) as 'enrolled' | 'paused' | 'graduated',
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${id}`)
}

export async function addParentLinkAction(formData: FormData) {
  await requireRole(['owner'])

  const studentId = String(formData.get('student_id'))
  const email = String(formData.get('parent_email'))
  const relationship = String(formData.get('relationship')) as 'mother' | 'father' | 'other'

  // The owner UI knows the parent's email; the backend resolves it to a
  // parent.id by walking auth.users (service-role lookup). On miss we
  // surface a clear message telling the owner to register the parent first.
  let parentId: string
  try {
    const result = await apiFetch<{ id: string }>(
      `/owner/parents/by-email?email=${encodeURIComponent(email)}`
    )
    parentId = result.id
  } catch {
    throw new Error(
      `해당 이메일의 학부모를 찾을 수 없습니다: ${email}. 먼저 /owner/parents/new 에서 학부모를 등록하세요.`
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.from('student_parent').insert({
    student_id: studentId,
    parent_id: parentId,
    relationship,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${studentId}`)
}

export async function removeParentLinkAction(formData: FormData) {
  await requireRole(['owner'])

  const studentId = String(formData.get('student_id'))
  const parentId = String(formData.get('parent_id'))
  const supabase = await createClient()
  const { error } = await supabase
    .from('student_parent')
    .delete()
    .eq('student_id', studentId)
    .eq('parent_id', parentId)
  if (error) throw new Error(error.message)
  revalidatePath(`/owner/students/${studentId}`)
}
