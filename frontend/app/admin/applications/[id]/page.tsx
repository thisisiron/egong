import { notFound } from 'next/navigation'

import { requireRole } from '@/lib/auth'
import {
  getApplicationById,
  getRegistrationFileUrl,
} from '@/lib/applications/service'
import { ApplicationStatusBadge } from '@/lib/applications/components/ApplicationStatusBadge'
import { DecisionPanel } from '@/lib/applications/components/DecisionPanel'
import { formatPhoneKR } from '@/lib/format'
import { BUSINESS_TYPE_OPTIONS, STUDENT_COUNT_OPTIONS } from '@/lib/applications/types'

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(['admin'])
  const { id } = await params

  let application
  try {
    application = await getApplicationById(id)
  } catch {
    notFound()
  }

  const fileInfo = application.registration_file_path
    ? await getRegistrationFileUrl(id).catch(() => null)
    : null

  const businessTypeMeta = BUSINESS_TYPE_OPTIONS.find(
    (o) => o.value === application.business_type,
  )
  const studentCountMeta = STUDENT_COUNT_OPTIONS.find(
    (o) => o.value === application.academy_student_count,
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{application.academy_name}</h1>
        <ApplicationStatusBadge status={application.status} />
      </div>

      <Section title="신청자">
        <Row label="이름" value={application.applicant_name} />
        <Row label="이메일" value={application.applicant_email} />
        <Row label="연락처" value={formatPhoneKR(application.applicant_phone)} />
      </Section>

      <Section title="학원">
        <Row label="학원명" value={application.academy_name} />
        <Row label="지역" value={application.academy_region ?? '-'} />
        <Row label="학생 수" value={studentCountMeta?.label ?? '-'} />
        <Row label="문의" value={application.inquiry_message ?? '-'} multiline />
      </Section>

      <Section title="사업자">
        <Row
          label="유형"
          value={`${businessTypeMeta?.icon ?? ''} ${businessTypeMeta?.label ?? application.business_type}`}
        />
        <Row label="사업자/상호명" value={application.business_name} />
        <Row label="대표자" value={application.business_owner_name} />
        <Row label="사업자번호" value={application.business_number ?? '-'} />
        <Row
          label="등록증"
          value={
            fileInfo?.url ? (
              <a
                href={fileInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 hover:underline"
              >
                다운로드 ({fileInfo.expires_in}초 유효)
              </a>
            ) : (
              '-'
            )
          }
        />
        {application.verified_at && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm mt-3">
            <p className="font-semibold text-green-800">
              ✓ NTS 진위확인 통과
            </p>
            <p className="mt-1 text-xs text-green-700">
              상태:{' '}
              <strong>
                {application.verified_b_stt_cd === '01' ? '계속사업자' : '휴업자'}
              </strong>
              <span className="opacity-70">
                {' · 확인 시각: '}
                {new Date(application.verified_at).toLocaleString('ko-KR')}
              </span>
            </p>
            <p className="mt-1 text-xs text-green-600 opacity-80">
              신청 시점 NTS 응답 기준. 최신 상태는 사업자번호로 재조회하세요.
            </p>
          </div>
        )}
      </Section>

      <Section title="접수">
        <Row
          label="신청일"
          value={new Date(application.created_at).toLocaleString('ko-KR')}
        />
      </Section>

      <Section title="결정">
        <DecisionPanel application={application} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-amber-100 rounded-lg p-5 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <dl className="divide-y divide-amber-50">{children}</dl>
    </section>
  )
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string
  value: React.ReactNode
  multiline?: boolean
}) {
  return (
    <div className={`grid grid-cols-3 gap-3 py-2 ${multiline ? 'items-start' : 'items-center'}`}>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`col-span-2 text-sm text-slate-900 ${multiline ? 'whitespace-pre-wrap' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
