'use client'

import { useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { formatDateTimeKR } from '@/lib/format'

import { cancelConsultationAction } from '../actions'
import { isOpen, SLOT_LABEL, type Consultation } from '../types'
import { ConsultationStatusBadge } from './ConsultationStatusBadge'

// 이 컴포넌트는 학부모 화면(/me/consultations) 전용이다. 예전에는 'staff' 뷰 분기가
// 있었으나 호출자가 없는 죽은 코드였다(스태프 화면은 StaffConsultationBoard.tsx가 별도로
// 담당 — 카드 모양은 비슷해도 서로 다른 액션 세트를 갖는 별개 컴포넌트다). 리뷰에서
// 지적돼 제거했다.
export function ConsultationList({ rows }: { rows: Consultation[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-12">상담 내역이 없습니다.</p>
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <ConsultationCard key={r.id} row={r} />
      ))}
    </div>
  )
}

function ConsultationCard({ row }: { row: Consultation }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function cancel() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await cancelConsultationAction({ id: row.id, note: null })
        if (!result.ok) {
          setError(result.message)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '취소에 실패했습니다.')
      }
    })
  }

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-2"
      data-consultation-reason={row.reason}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ConsultationStatusBadge status={row.status} />
        </div>
        <span className="text-xs text-slate-500">
          희망 {format(parseISO(row.preferred_date), 'M월 d일 (E)', { locale: ko })}{' '}
          {SLOT_LABEL[row.preferred_slot]}
        </span>
      </div>

      <p className="text-sm whitespace-pre-wrap">{row.reason}</p>

      {row.status === 'confirmed' && row.scheduled_at && (
        <p className="text-sm text-emerald-700" data-testid="consultation-scheduled-at">
          {/* scheduled_at은 timestamptz라 date-fns format(parseISO(...))은 기기 로컬
              타임존으로 읽는다 — KST 고정을 위해 formatDateTimeKR(Intl, timeZone:
              'Asia/Seoul' 고정)을 쓴다. preferred_date(바로 위)는 date-only라 영향 없음. */}
          확정 {formatDateTimeKR(row.scheduled_at)}
          {row.handler_name && ` · ${row.handler_name}`}
        </p>
      )}

      {row.response_note && (
        <p className="text-xs text-slate-500">학원 메모: {row.response_note}</p>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {isOpen(row.status) && (
        <Button variant="outline" size="sm" onClick={cancel} disabled={pending}>
          {pending ? '취소 중…' : '취소'}
        </Button>
      )}
    </div>
  )
}
