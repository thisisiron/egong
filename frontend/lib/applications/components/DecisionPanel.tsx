'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { formatDateTimeKR } from '@/lib/format'

import { approveApplicationAction } from '../actions'
import type { Application } from '../types'

type Props = {
  application: Application
}

/**
 * Admin 상세 페이지의 결정 패널.
 *
 * - status='pending': 승인 버튼 + 확인 inline 패널
 * - status='approved': 결과 카드 (학원 링크 + 초대 메일 발송 안내)
 * - 그 외: 표시 안 함
 */
export function DecisionPanel({ application }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleConfirmApprove() {
    setError(null)
    startTransition(async () => {
      try {
        await approveApplicationAction(application.id)
        // revalidatePath가 페이지를 다시 렌더 → status='approved' 분기로 자동 전환
        setShowConfirm(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
      }
    })
  }

  if (application.status === 'approved') {
    const approvedDate = application.approved_at
      ? formatDateTimeKR(application.approved_at)
      : '-'
    return (
      <div
        aria-live="polite"
        className="rounded-lg border border-green-200 bg-green-50 p-4"
      >
        <p className="text-base font-semibold text-green-900">
          ✓ 승인 완료
        </p>
        <p className="mt-1 text-sm text-green-800">
          {approvedDate}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-green-800">
          <li>
            • 학원:{' '}
            {application.created_academy_id ? (
              <a
                href={`/admin/academies/${application.created_academy_id}`}
                className="font-medium underline hover:no-underline"
              >
                {application.academy_name} →
              </a>
            ) : (
              application.academy_name
            )}
          </li>
          <li>• 원장: {application.applicant_email}</li>
          <li className="text-xs text-green-700 opacity-80">
            초대 메일이 발송되었습니다. 원장님이 메일의 링크를 클릭해서
            비밀번호를 설정하면 로그인하실 수 있습니다.
          </li>
        </ul>
      </div>
    )
  }

  if (application.status !== 'pending') {
    return null
  }

  return (
    <div className="space-y-3">
      {showConfirm ? (
        <div className="rounded-lg border border-indigo-300 bg-indigo-50 p-4">
          <p className="font-semibold text-indigo-900">
            정말 승인하시겠습니까?
          </p>
          <ul className="mt-2 space-y-0.5 text-sm text-indigo-800">
            <li>• 학원 &quot;{application.academy_name}&quot; 생성됨</li>
            <li>• {application.applicant_email}로 초대 메일 발송</li>
            <li>• 이 작업은 되돌릴 수 없습니다</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Button onClick={handleConfirmApprove} disabled={pending}>
              {pending ? '처리 중...' : '예, 승인'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={pending}
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setShowConfirm(true)}
          size="lg"
          className="w-full sm:w-auto"
        >
          ✓ 승인하기
        </Button>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </div>
  )
}
