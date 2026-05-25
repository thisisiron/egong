'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

// Multipart upload — can't reuse apiFetch (which forces application/json).
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000') + '/api/v1'

export type ImportActionResult = {
  ok: boolean
  message: string
}

export async function uploadStudentsCsvAction(
  formData: FormData,
): Promise<ImportActionResult> {
  // Re-verify role at action entry (Addendum C4).
  await requireRole(['owner'])

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { ok: false, message: '세션이 만료되었습니다. 다시 로그인하세요.' }
  }

  const resp = await fetch(`${BASE}/owner/import/students`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  })

  if (!resp.ok) {
    const text = await resp.text()
    return { ok: false, message: `오류: ${text}` }
  }

  const result = (await resp.json()) as {
    kind: string
    inserted: number
    errors: string[]
  }
  let msg = `${result.inserted}명 등록됨`
  if (result.errors?.length) {
    msg += ` (오류 ${result.errors.length}개)`
  }
  return { ok: true, message: msg }
}
