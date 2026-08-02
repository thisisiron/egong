'use client'

import { useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

import { Button } from '@/components/ui/button'

import { cancelConsultationAction } from '../actions'
import { isOpen, SLOT_LABEL, type Consultation } from '../types'
import { ConsultationStatusBadge } from './ConsultationStatusBadge'

export function ConsultationList({
  rows,
  viewer,
}: {
  rows: Consultation[]
  /** 'parent'면 학생 이름을 숨기고 취소만 노출, 'staff'면 학생·학부모 이름을 보여준다. */
  viewer: 'parent' | 'staff'
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-12">상담 내역이 없습니다.</p>
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <ConsultationCard key={r.id} row={r} viewer={viewer} />
      ))}
    </div>
  )
}

function ConsultationCard({
  row,
  viewer,
}: {
  row: Consultation
  viewer: 'parent' | 'staff'
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function cancel() {
    setError(null)
    startTransition(async () => {
      try {
        await cancelConsultationAction({ id: row.id, note: null })
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
          {viewer === 'staff' && (
            <span className="text-sm font-medium">
              {row.student_name} · {row.parent_name}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">
          희망 {format(parseISO(row.preferred_date), 'M월 d일 (E)', { locale: ko })}{' '}
          {SLOT_LABEL[row.preferred_slot]}
        </span>
      </div>

      <p className="text-sm whitespace-pre-wrap">{row.reason}</p>

      {row.status === 'confirmed' && row.scheduled_at && (
        <p className="text-sm text-emerald-700" data-testid="consultation-scheduled-at">
          확정 {format(parseISO(row.scheduled_at), 'M월 d일 (E) HH:mm', { locale: ko })}
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
