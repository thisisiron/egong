import 'server-only'

import { apiFetch } from '@/lib/api/client'

import type { Application } from './types'

type SignedUrlResponse = { url: string; expires_in: number } | null

/**
 * Admin: 전체 application 목록 (최신순).
 *
 * RSC에서만 호출. 'server-only' import로 browser bundle 차단.
 */
export async function listApplications(): Promise<Application[]> {
  return apiFetch<Application[]>('/admin/applications')
}

/** Admin: 단일 application. */
export async function getApplicationById(id: string): Promise<Application> {
  return apiFetch<Application>(`/admin/applications/${id}`)
}

/** Admin: 사업자등록증 다운로드용 signed URL (5분 유효). null = 첨부 없음. */
export async function getRegistrationFileUrl(
  applicationId: string,
): Promise<SignedUrlResponse> {
  return apiFetch<SignedUrlResponse>(
    `/admin/applications/${applicationId}/file-url`,
  )
}
