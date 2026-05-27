'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { apiFetch } from '@/lib/api/client'

import { applicationSubmitSchema } from './schemas'
import type { ApprovalResult } from './types'

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
    verified_b_stt_cd: nullable(raw.verified_b_stt_cd),
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

/**
 * Admin: 신청 승인.
 *
 * Server Action — 브라우저에서 클릭 시 호출됨. apiFetch가 admin session
 * bearer token 자동 첨부. 백엔드 service가 보상 트랜잭션으로 처리.
 *
 * 성공 시 페이지 revalidate → DecisionPanel이 status='approved' 분기로 다시 렌더.
 * 실패 시 throw — DecisionPanel 의 useTransition catch가 에러 표시.
 */
export async function approveApplicationAction(
  applicationId: string,
): Promise<void> {
  try {
    await apiFetch<ApprovalResult>(
      `/admin/applications/${applicationId}/approve`,
      { method: 'POST' },
    )
  } catch (err) {
    // apiFetch는 non-2xx 시 `API <status>: <text>` 형식으로 throw.
    // 사용자에게는 본문 노출 X — 서버 로그로만.
    console.error('approveApplicationAction backend error', err)
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('API 422')) {
      throw new Error(
        '승인 처리 실패: 원장 이메일이 이미 등록되어 있을 수 있습니다.',
      )
    }
    if (msg.includes('API 409')) {
      throw new Error('이미 처리된 신청입니다.')
    }
    throw new Error('승인 처리에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }
  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${applicationId}`)
}
