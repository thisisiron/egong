'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function createStudentAction(formData: FormData) {
  // Re-verify role at action entry (Addendum C4).
  const owner = await requireRole(['owner'])
  if (!owner.academyId) throw new Error('소속 학원 정보가 없습니다.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('students')
    .insert({
      academy_id: owner.academyId,
      name: String(formData.get('name')),
      school: String(formData.get('school') || '') || null,
      grade: String(formData.get('grade') || '') || null,
      status: 'enrolled',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  redirect(`/owner/students/${data.id}`)
}
