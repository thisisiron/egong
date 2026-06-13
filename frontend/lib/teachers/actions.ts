'use server'

import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { requireRole, staffBasePath } from '@/lib/auth'

export async function createTeacherAction(formData: FormData) {
  const user = await requireRole(['owner', 'teacher'])

  await apiFetch('/owner/teachers', {
    method: 'POST',
    body: JSON.stringify({
      email: String(formData.get('email')),
      display_name: String(formData.get('display_name')),
      temp_password: String(formData.get('temp_password')),
      phone: String(formData.get('phone') || '') || null,
    }),
  })
  redirect(`${staffBasePath(user.role)}/teachers`)
}
