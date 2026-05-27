import Link from 'next/link'

import { requireRole } from '@/lib/auth'
import { listApplications } from '@/lib/applications/service'
import { ApplicationStatusBadge } from '@/lib/applications/components/ApplicationStatusBadge'
import { formatPhoneKR } from '@/lib/format'

const BUSINESS_TYPE_KO: Record<string, string> = {
  individual: '개인',
  corporate: '법인',
  tutoring: '교습소',
  planned: '개원예정',
}

export default async function AdminApplicationsPage() {
  await requireRole(['admin'])
  const applications = await listApplications()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">도입 신청서</h1>
        <span className="text-sm text-slate-500">총 {applications.length}건</span>
      </div>

      <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-amber-50 text-left text-slate-700 border-b border-amber-200">
            <tr>
              <th className="px-4 py-3">신청일</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">학원명</th>
              <th className="px-4 py-3">원장</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">연락처</th>
              <th className="px-4 py-3">사업자 유형</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {applications.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  아직 접수된 신청서가 없습니다.
                </td>
              </tr>
            ) : null}
            {applications.map((a) => (
              <tr key={a.id} className="hover:bg-amber-50/50">
                <td className="px-4 py-3 text-slate-600">
                  {new Date(a.created_at).toLocaleString('ko-KR', {
                    year: '2-digit',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  <ApplicationStatusBadge status={a.status} />
                </td>
                <td className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-2">
                    {a.academy_name}
                    {a.verified_at && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700"
                        title={`진위확인 통과 (${a.verified_b_stt_cd === '01' ? '계속사업자' : '휴업자'})`}
                      >
                        ✓ 진위확인
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">{a.applicant_name}</td>
                <td className="px-4 py-3 text-slate-600">{a.applicant_email}</td>
                <td className="px-4 py-3 tabular-nums">{formatPhoneKR(a.applicant_phone)}</td>
                <td className="px-4 py-3">{BUSINESS_TYPE_KO[a.business_type] ?? a.business_type}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/applications/${a.id}`}
                    className="text-amber-700 hover:underline"
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Phase 2에서 승인·거절 액션이 추가됩니다. 현재는 보기만 가능합니다.
      </p>
    </div>
  )
}
