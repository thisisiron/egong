'use server'

import { redirect } from 'next/navigation'

import { applicationSubmitSchema } from './schemas'

const BACKEND_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000') + '/api/v1'

/**
 * Public submission action — no auth required.
 *
 * 1. zod validate
 * 2. backend POST /applications (anon endpoint)
 * 3. 성공 시 /apply/done 으로 redirect
 * 4. 실패 시 throw — 폼 boundary가 error.tsx로 잡음 (또는 useTransition catch)
 */
export async function submitApplicationAction(formData: FormData): Promise<void> {
  const raw = Object.fromEntries(formData.entries())

  // FormData 는 모두 string. null/empty 처리.
  const normalized = {
    applicant_name: str(raw.applicant_name),
    applicant_email: str(raw.applicant_email),
    applicant_phone: str(raw.applicant_phone),
    academy_name: str(raw.academy_name),
    academy_region: nullable(raw.academy_region),
    academy_student_count: nullable(raw.academy_student_count),
    inquiry_message: nullable(raw.inquiry_message),
    business_type: str(raw.business_type),
    business_name: str(raw.business_name),
    business_owner_name: str(raw.business_owner_name),
    business_number: nullable(raw.business_number),
    registration_file_path: nullable(raw.registration_file_path),
  }

  const parsed = applicationSubmitSchema.safeParse(normalized)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    throw new Error(`${firstIssue.path.join('.')}: ${firstIssue.message}`)
  }

  const resp = await fetch(`${BACKEND_BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  })
  if (!resp.ok) {
    // 백엔드 응답 본문을 사용자에게 노출하지 않음 — 서버 로그로만.
    const body = await resp.text().catch(() => '')
    console.error('submitApplicationAction backend error', resp.status, body.slice(0, 500))
    throw new Error('신청 처리에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }

  redirect('/apply/done')
}

function str(v: FormDataEntryValue | undefined): string {
  if (v == null) return ''
  return typeof v === 'string' ? v : ''
}

function nullable(v: FormDataEntryValue | undefined): string | null {
  const s = str(v).trim()
  return s.length === 0 ? null : s
}
