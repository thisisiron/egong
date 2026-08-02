'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { requestConsultationAction } from '../actions'
import { SLOT_OPTIONS, type ConsultationSlot } from '../types'

/** KST 기준 내일 0시 — Calendar의 disabled 경계. */
function tomorrowKST(): Date {
  const kstNow = new Date(Date.now() + 9 * 3600_000)
  const d = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() + 1)
  )
  return d
}

/** Date → KST 'YYYY-MM-DD'. Calendar가 주는 Date는 로컬 자정이라 그대로 포맷한다. */
function toYmd(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function ConsultationRequestForm({
  studentId,
  hasPending,
}: {
  studentId: string
  hasPending: boolean
}) {
  const [date, setDate] = useState<Date | undefined>()
  const [slot, setSlot] = useState<ConsultationSlot>('afternoon')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (hasPending) {
    return (
      <p className="text-sm text-slate-500">
        이미 대기 중인 상담 신청이 있습니다. 학원의 확정을 기다려주세요.
      </p>
    )
  }

  function submit() {
    setError(null)
    if (!date) {
      setError('희망 날짜를 선택해주세요.')
      return
    }
    const preferredDate = toYmd(date)
    startTransition(async () => {
      try {
        await requestConsultationAction({
          student_id: studentId,
          preferred_date: preferredDate,
          preferred_slot: slot,
          reason,
        })
        setDate(undefined)
        setReason('')
      } catch (e) {
        setError(e instanceof Error ? e.message : '신청에 실패했습니다.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>희망 날짜</Label>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={{ before: tomorrowKST() }}
          locale={ko}
          className="rounded-md border border-gray-200"
        />
        {date && (
          <p className="text-xs text-slate-500" data-testid="consultation-picked-date">
            {format(date, 'M월 d일 (E)', { locale: ko })} 선택됨
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="consultation-slot">희망 시간대</Label>
        <select
          id="consultation-slot"
          value={slot}
          onChange={(e) => setSlot(e.target.value as ConsultationSlot)}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          {SLOT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="consultation-reason">상담 사유</Label>
        <Textarea
          id="consultation-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="어떤 내용으로 상담을 원하시는지 적어주세요."
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Button onClick={submit} disabled={pending} className="w-full">
        {pending ? '신청 중…' : '상담 신청'}
      </Button>
    </div>
  )
}
