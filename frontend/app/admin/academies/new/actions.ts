'use server'

import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { requireRole } from '@/lib/auth'

export async function createAcademyAction(formData: FormData) {
  // Server Actions can be invoked directly — re-verify role here even
  // though the page is already guarded by admin layout (Addendum C4).
  await requireRole(['admin'])

  const payload = {
    name: String(formData.get('name')),
    owner_email: String(formData.get('owner_email')),
    owner_display_name: String(formData.get('owner_display_name')),
    owner_temp_password: String(formData.get('owner_temp_password')),
    contract_started_at: (formData.get('contract_started_at') as string) || null,
  }

  type CreateResponse = { id: string }
  const result = await apiFetch<CreateResponse>('/admin/academies', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  redirect(`/admin/academies/${result.id}`)
}
