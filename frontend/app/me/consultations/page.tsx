import { getSessionUser } from '@/lib/auth'
import { getMyChildren } from '@/lib/students/service'
import { listMyConsultations } from '@/lib/consultations/service'
import { ConsultationList } from '@/lib/consultations/components/ConsultationList'
import { ConsultationRequestForm } from '@/lib/consultations/components/ConsultationRequestForm'
import { ChildSelector } from '../_components/ChildSelector'

export default async function MyConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>
}) {
  const user = await getSessionUser()
  if (!user) return null
  const { child: childParam } = await searchParams

  const children = await getMyChildren()
  const targetStudentId = childParam ?? children[0]?.id ?? null
  if (!targetStudentId) {
    return <div className="text-center text-slate-500 py-12">표시할 학생 정보가 없습니다.</div>
  }

  const rows = await listMyConsultations(targetStudentId)
  const hasPending = rows.some((r) => r.status === 'requested')
  const isParent = user.role === 'parent'

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">상담</h1>
        {isParent && (
          <ChildSelector
            items={children}
            current={targetStudentId}
            basePath="/me/consultations"
          />
        )}
      </header>

      {isParent ? (
        <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <h2 className="font-semibold">상담 신청</h2>
          <ConsultationRequestForm studentId={targetStudentId} hasPending={hasPending} />
        </section>
      ) : (
        // 학생도 /me를 공유하지만 상담 신청 주체는 학부모다.
        <p className="text-sm text-slate-500">상담 신청은 학부모 계정에서 가능합니다.</p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-sm">신청 내역</h2>
        <ConsultationList rows={rows} viewer="parent" />
      </section>
    </div>
  )
}
