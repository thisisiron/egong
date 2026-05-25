'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function createClassAction(formData: FormData) {
  const owner = await requireRole(['owner'])
  if (!owner.academyId) throw new Error('소속 학원 정보가 없습니다.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .insert({
      academy_id: owner.academyId,
      name: String(formData.get('name')),
      level: String(formData.get('level')) as 'elementary' | 'middle' | 'high',
      description: String(formData.get('description') || '') || null,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  redirect(`/owner/classes/${data.id}`)
}
