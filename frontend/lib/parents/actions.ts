'use server'

import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { requireRole, staffBasePath } from '@/lib/auth'

export async function createParentAction(formData: FormData) {
  const user = await requireRole(['owner', 'teacher'])

  await apiFetch('/owner/parents', {
    method: 'POST',
    body: JSON.stringify({
      email: String(formData.get('email')),
      name: String(formData.get('name')),
      phone: String(formData.get('phone') || '') || null,
      temp_password: String(formData.get('temp_password')),
    }),
  })
  redirect(`${staffBasePath(user.role)}/parents`)
}
