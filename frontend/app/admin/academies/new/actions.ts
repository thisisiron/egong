'use server'

import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { requireRole } from '@/lib/auth'

type ApiDetailItem = {
  loc?: unknown[]
  msg?: string
  type?: string
}

/** FastAPI/Pydantic의 422 응답을 사용자 친화 메시지로 변환. */
function extractFriendlyMessage(rawMsg: string): string {
  // apiFetch는 "API 422: {json}" 형태로 throw. JSON 부분을 분리.
  const prefixMatch = rawMsg.match(/^API \d+:\s*/)
  const body = prefixMatch ? rawMsg.slice(prefixMatch[0].length) : rawMsg
  try {
    const parsed = JSON.parse(body) as { detail?: unknown }
    if (Array.isArray(parsed.detail)) {
      return (parsed.detail as ApiDetailItem[])
        .map((d) => {
          const field = (d.loc ?? [])
            .filter((x) => x !== 'body')
            .join('.')
          return field ? `${field}: ${d.msg ?? ''}` : (d.msg ?? '')
        })
        .filter(Boolean)
        .join('; ')
    }
    if (typeof parsed.detail === 'string') return parsed.detail
    return rawMsg
  } catch {
    return rawMsg
  }
}

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
  let result: CreateResponse
  try {
    result = await apiFetch<CreateResponse>('/admin/academies', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch (e) {
    const rawMsg = e instanceof Error ? e.message : String(e)
    const friendly = extractFriendlyMessage(rawMsg)
    // 폼 안에서 인라인 표시되도록 ?error= 와 함께 입력값도 보존
    const params = new URLSearchParams({
      error: friendly,
      name: payload.name,
      owner_email: payload.owner_email,
      owner_display_name: payload.owner_display_name,
      contract_started_at: payload.contract_started_at ?? '',
    })
    redirect(`/admin/academies/new?${params.toString()}`)
  }

  redirect(`/admin/academies/${result.id}`)
}
