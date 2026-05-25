'use server'

import { revalidatePath } from 'next/cache'
import { apiFetch } from '@/lib/api/client'
import { requireRole } from '@/lib/auth'

export async function updateAcademyAction(formData: FormData) {
  await requireRole(['admin'])

  const id = String(formData.get('id'))
  const payload = {
    name: String(formData.get('name')),
    status: String(formData.get('status')),
  }
  await apiFetch(`/admin/academies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  revalidatePath(`/admin/academies/${id}`)
  revalidatePath('/admin')
}
