'use server'

import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { requireRole } from '@/lib/auth'

export async function createParentAction(formData: FormData) {
  await requireRole(['owner'])

  await apiFetch('/owner/parents', {
    method: 'POST',
    body: JSON.stringify({
      email: String(formData.get('email')),
      name: String(formData.get('name')),
      phone: String(formData.get('phone') || '') || null,
      temp_password: String(formData.get('temp_password')),
    }),
  })
  redirect('/owner/parents')
}
